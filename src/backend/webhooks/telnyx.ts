import type { Context } from 'hono';
import { z } from 'zod';

import { getEnv } from '@/src/backend/config/env';
import type {
  CallLogsRepository,
  CallbacksRepository,
  DemoSessionsRepository,
  JobsRepository,
  MissedCallsRepository,
  ProviderEventsRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { verifyTelnyxSignature } from '@/src/backend/security/telnyx-signature';
import { withLogContext } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { securityAudit } from '@/src/backend/security/audit-log';
import { getClientIp } from '@/src/backend/security/rate-limit';
import { resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';

const telnyxEnvelopeSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    payload: z.unknown().optional(),
  }),
});

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const normalized = phone.replace(/[^\d+]/g, '');
  return normalized.length > 0 ? normalized : null;
}

function firstString(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (typeof nested.phone_number === 'string' && nested.phone_number.trim().length > 0) {
        return nested.phone_number.trim();
      }
    }
  }
  return null;
}

function isMissedInboundCall(eventType: string, payload: unknown): boolean {
  if (!eventType.includes('call')) return false;
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  const direction = typeof body.call_direction === 'string' ? body.call_direction.toLowerCase() : '';
  if (direction !== 'inbound') return false;

  const cause = typeof body.hangup_cause === 'string' ? body.hangup_cause.toLowerCase() : '';
  const answeredAt = firstString(payload, ['answered_at', 'answer_time', 'bridged_at']);
  if (answeredAt) return false;
  return cause.includes('no_answer') || cause.includes('busy') || cause.includes('cancel');
}

function isCallInitiated(eventType: string): boolean {
  return eventType.includes('call.initiated') || eventType.includes('call_initiated');
}

function isCallEnded(eventType: string): boolean {
  return eventType.includes('call.hangup') || eventType.includes('call.ended') || eventType.includes('call_hangup');
}

function isCallbackRequestMessage(eventType: string, payload: unknown): boolean {
  if (!(eventType.includes('message') || eventType.includes('messaging'))) return false;
  const message = firstString(payload, ['text', 'body'])?.toLowerCase() ?? '';
  return ['yes', 'y', 'callback', 'call me'].includes(message);
}

export async function handleTelnyxWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    jobsRepository?: JobsRepository;
    callbacksRepository?: CallbacksRepository;
    shopsRepository?: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    missedCallsRepository?: MissedCallsRepository;
    demoSessionsRepository?: DemoSessionsRepository;
  },
) {
  const bodyText = await c.req.text();
  const signature = c.req.header('telnyx-signature-ed25519') ?? null;
  const timestamp = c.req.header('telnyx-timestamp') ?? null;

  const verified = verifyTelnyxSignature({
    body: bodyText,
    timestamp,
    signature,
    publicKey: getEnv().TELNYX_WEBHOOK_PUBLIC_KEY,
    maxSkewSeconds: getEnv().TELNYX_WEBHOOK_MAX_SKEW_SECONDS,
  });

  if (!verified) {
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx',
      outcome: 'invalid_signature',
    });
    securityAudit({
      action: 'webhook_signature_invalid',
      actorType: 'provider',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      provider: 'telnyx',
    });
    return c.json({ ok: false }, 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    return c.json({ ok: false }, 400);
  }

  const parsed = telnyxEnvelopeSchema.safeParse(parsedBody);
  if (!parsed.success) {
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx',
      outcome: 'failed',
    });
    return c.json({ ok: false }, 400);
  }

  const event = parsed.data.data;
  const log = withLogContext({
    requestId: c.req.header('x-request-id') ?? undefined,
    provider: 'telnyx',
  });

  try {
    const alreadyProcessed = await deps.providerEventsRepository.hasProcessed('telnyx', event.id);
    if (alreadyProcessed) {
      incrementMetric('webhook_requests_total', {
        provider: 'telnyx',
        outcome: 'duplicate',
      });
      log.info({ eventId: event.id }, 'telnyx_webhook_duplicate');
      return c.json({ ok: true }, 200);
    }

    await deps.providerEventsRepository.markProcessed({
      provider: 'telnyx',
      providerEventId: event.id,
      eventType: event.event_type,
      payload: parsed.data,
    });

    const providerCallId = firstString(event.payload, ['call_control_id', 'call_leg_id', 'call_session_id']);
    const requestIdFromPayload = firstString(event.payload, ['client_state', 'request_id']);
    const demoRun =
      requestIdFromPayload && (requestIdFromPayload.startsWith('demo-') || deps.demoSessionsRepository)
        ? await deps.demoSessionsRepository?.findCallRunByRequestId(requestIdFromPayload)
        : null;
    if (demoRun && requestIdFromPayload) {
      if (providerCallId || isCallInitiated(event.event_type) || isCallEnded(event.event_type)) {
        await deps.demoSessionsRepository?.markCallRunStatusByRequestId({
          requestId: requestIdFromPayload,
          status: isCallEnded(event.event_type)
            ? isMissedInboundCall(event.event_type, event.payload)
              ? 'missed'
              : 'completed'
            : isCallInitiated(event.event_type)
              ? 'dialing'
              : demoRun.status,
          providerCallId,
          endedAt: isCallEnded(event.event_type) ? new Date() : undefined,
          outcome: isCallEnded(event.event_type)
            ? isMissedInboundCall(event.event_type, event.payload)
              ? 'missed'
              : 'completed'
            : undefined,
        });
      }
      await deps.demoSessionsRepository?.addStatusEvent({
        requestId: requestIdFromPayload,
        eventType: `telnyx_${event.event_type}`,
        payload: {
          providerCallId,
          demo: true,
        },
      });
      log.info(
        {
          eventType: event.event_type,
          eventId: event.id,
          requestId: requestIdFromPayload,
        },
        'telnyx_demo_webhook_processed',
      );
      return c.json({ ok: true, demo: true }, 200);
    }

    if (deps.callLogsRepository && deps.shopsRepository && providerCallId && isCallInitiated(event.event_type)) {
      const destinationPhone = normalizePhone(firstString(event.payload, ['to', 'called_number', 'to_number']));
      const callerPhone = normalizePhone(firstString(event.payload, ['from', 'from_number', 'caller_number']));
      if (destinationPhone) {
        const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, destinationPhone);
        if (shop) {
          await deps.callLogsRepository.createOrUpdateInboundCall({
            provider: 'telnyx',
            providerCallId,
            shopId: shop.id,
            callerPhone: callerPhone ?? undefined,
            destinationPhone,
            requestId: requestIdFromPayload ?? undefined,
            startedAt: new Date(),
          });
        }
      }
    }

    if (deps.callLogsRepository && providerCallId && isCallEnded(event.event_type)) {
      const answeredAt = firstString(event.payload, ['answered_at', 'answer_time', 'bridged_at']);
      await deps.callLogsRepository.markEndedByProviderCallId({
        provider: 'telnyx',
        providerCallId,
        endedAt: new Date(),
        outcome: isMissedInboundCall(event.event_type, event.payload) ? 'missed' : undefined,
        humanAnswered: Boolean(answeredAt),
      });
    }

    if (deps.jobsRepository && deps.shopsRepository && isMissedInboundCall(event.event_type, event.payload)) {
      const destinationPhone = normalizePhone(firstString(event.payload, ['to', 'called_number', 'to_number']));
      const callerPhone = normalizePhone(firstString(event.payload, ['from', 'from_number', 'caller_number']));
      if (destinationPhone && callerPhone) {
        const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, destinationPhone);
        if (shop) {
          const dedupe = deps.missedCallsRepository
            ? await deps.missedCallsRepository.createOncePerHour({
                shopId: shop.id,
                callerPhone,
                callLogProviderCallId: providerCallId ?? undefined,
              })
            : { created: true };

          if (dedupe.created) {
            await deps.jobsRepository.enqueue({
              shopId: shop.id,
              type: 'missed_call_followup_sms',
              payload: { customerPhone: callerPhone },
              runAt: new Date(),
              idempotencyKey: `telnyx_missed_call_followup:${event.id}`,
            });
            log.info({ eventId: event.id, shopId: shop.id, callerPhone }, 'telnyx_missed_call_followup_queued');
          } else {
            log.info({ eventId: event.id, shopId: shop.id, callerPhone }, 'telnyx_missed_call_followup_deduped');
          }
        }
      }
    }

    if (deps.jobsRepository && deps.shopsRepository && isCallbackRequestMessage(event.event_type, event.payload)) {
      const destinationPhone = normalizePhone(firstString(event.payload, ['to', 'to_number']));
      const callerPhone = normalizePhone(firstString(event.payload, ['from', 'from_number']));
      if (destinationPhone && callerPhone) {
        const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, destinationPhone);
        if (shop) {
          const callback = deps.callbacksRepository
            ? await deps.callbacksRepository.create({
                shopId: shop.id,
                customerPhone: callerPhone,
                reason: 'Customer replied YES for callback SMS',
              })
            : null;
          await deps.jobsRepository.enqueue({
            shopId: shop.id,
            type: 'callback_outbound_call',
            payload: callback
              ? { callbackId: callback.id }
              : { customerPhone: callerPhone, reason: 'Customer replied YES for callback SMS' },
            runAt: new Date(),
            idempotencyKey: `telnyx_callback_request:${event.id}`,
          });
          log.info({ eventId: event.id, shopId: shop.id, callerPhone }, 'telnyx_callback_request_queued');
        }
      }
    }

    log.info({ eventType: event.event_type, eventId: event.id }, 'telnyx_webhook_processed');
    await deps.providerEventsRepository.clearProcessingError('telnyx', event.id);
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx',
      outcome: 'processed',
    });
    return c.json({ ok: true }, 200);
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      'telnyx',
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx',
      outcome: 'failed',
    });
    log.error({ err: error, eventId: event.id, eventType: event.event_type }, 'telnyx_webhook_failed');
    return c.json({ ok: false }, 500);
  }
}
