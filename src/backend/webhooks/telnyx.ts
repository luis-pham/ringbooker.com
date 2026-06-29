import type { Context } from 'hono';
import { z } from 'zod';

import { getEnv } from '@/src/backend/config/env';
import type {
  CallLogsRepository,
  CallbacksRepository,
  BillingSubscriptionsRepository,
  CustomersRepository,
  DemoSessionsRepository,
  JobsRepository,
  MissedCallsRepository,
  OutboundMessagesRepository,
  ProviderEventsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
  SmsMessagesRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';
import { verifyTelnyxSignature } from '@/src/backend/security/telnyx-signature';
import { withLogContext } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { securityAudit } from '@/src/backend/security/audit-log';
import { getClientIp } from '@/src/backend/security/rate-limit';
import { resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import {
  getAllowedSmsInboxNumbers,
  normalizeSmsInboxPhoneNumber,
} from '@/src/backend/services/sms/sms-inbox-allowlist';
import { maskPhone } from '@/src/backend/utils/pii';

const telnyxEnvelopeSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    occurred_at: z.string().optional(),
    payload: z.unknown().optional(),
  }),
});

export type TelnyxOutboundMessageStatusEvent = {
  eventId: string;
  eventType: 'message.sent' | 'message.finalized';
  occurredAt: Date | null;
  telnyxMessageId: string;
  direction: 'outbound';
  fromNumber: string | null;
  toNumber: string | null;
  telnyxStatus: string | null;
  errors: unknown[];
  completedAt: Date | null;
  rawPayload: unknown;
};

function isTelnyxOutboundStatusEventType(eventType: string): eventType is 'message.sent' | 'message.finalized' {
  return eventType === 'message.sent' || eventType === 'message.finalized';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function firstToRecordStatus(payload: Record<string, unknown>): string | null {
  const to = payload.to;
  const firstTo = Array.isArray(to) ? to[0] : to;
  const record = asRecord(firstTo);
  const status = record?.status;
  return typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : null;
}

export function extractTelnyxError(errors: unknown): { errorCode: string | null; errorMessage: string | null } {
  if (!Array.isArray(errors) || errors.length === 0) return { errorCode: null, errorMessage: null };
  const first = errors[0];
  if (typeof first === 'string') return { errorCode: null, errorMessage: first };
  if (!first || typeof first !== 'object') return { errorCode: null, errorMessage: null };
  const record = first as Record<string, unknown>;
  const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : null;
  const detail = typeof record.detail === 'string' && record.detail.trim() ? record.detail.trim() : null;
  const title = typeof record.title === 'string' && record.title.trim() ? record.title.trim() : null;
  let fallback: string | null = null;
  try {
    fallback = JSON.stringify(first);
  } catch {
    fallback = null;
  }
  return {
    errorCode: code,
    errorMessage: detail ?? title ?? fallback,
  };
}

export function extractTelnyxOutboundMessageStatusEvent(body: unknown): TelnyxOutboundMessageStatusEvent | null {
  const envelope = asRecord(body);
  const data = asRecord(envelope?.data);
  if (!data) return null;
  const eventType = typeof data?.event_type === 'string' ? data.event_type : null;
  if (!eventType || !isTelnyxOutboundStatusEventType(eventType)) return null;
  const eventId = typeof data.id === 'string' && data.id.trim() ? data.id.trim() : null;
  const payload = asRecord(data.payload);
  if (!eventId || !payload) return null;

  const direction = typeof payload.direction === 'string' ? payload.direction.toLowerCase() : null;
  if (direction !== 'outbound') return null;

  const telnyxMessageId = firstString(payload, ['id', 'message_id', 'messageId']);
  if (!telnyxMessageId) return null;
  const errors = Array.isArray(payload.errors) ? payload.errors : [];

  return {
    eventId,
    eventType,
    occurredAt: parseOptionalDate(data.occurred_at),
    telnyxMessageId,
    direction: 'outbound',
    fromNumber: normalizePhone(firstPhone(payload, ['from', 'from_number'])),
    toNumber: normalizePhone(firstPhone(payload, ['to', 'to_number'])),
    telnyxStatus: firstToRecordStatus(payload),
    errors,
    completedAt: parseOptionalDate(payload.completed_at),
    rawPayload: payload,
  };
}

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

function firstPhone(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item.trim().length > 0) return item.trim();
        if (item && typeof item === 'object') {
          const itemRecord = item as Record<string, unknown>;
          if (typeof itemRecord.phone_number === 'string' && itemRecord.phone_number.trim().length > 0) {
            return itemRecord.phone_number.trim();
          }
          if (typeof itemRecord.phoneNumber === 'string' && itemRecord.phoneNumber.trim().length > 0) {
            return itemRecord.phoneNumber.trim();
          }
        }
      }
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (typeof nested.phone_number === 'string' && nested.phone_number.trim().length > 0) {
        return nested.phone_number.trim();
      }
      if (typeof nested.phoneNumber === 'string' && nested.phoneNumber.trim().length > 0) {
        return nested.phoneNumber.trim();
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

function isSmsOptOutMessage(eventType: string, payload: unknown): boolean {
  if (!(eventType.includes('message') || eventType.includes('messaging'))) return false;
  const message = firstString(payload, ['text', 'body'])?.toLowerCase().trim() ?? '';
  // STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT are required opt-out keywords per CTIA/carrier rules.
  return ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'].includes(message);
}

function isInboundSmsMessage(eventType: string): boolean {
  const normalized = eventType.toLowerCase();
  return normalized === 'message.received' || normalized.endsWith('.message.received');
}

function extractMediaUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  const values = [record.media_urls, record.mediaUrls, record.media].filter(Boolean);
  const urls: string[] = [];
  for (const value of values) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) {
        urls.push(item.trim());
        continue;
      }
      if (item && typeof item === 'object') {
        const itemRecord = item as Record<string, unknown>;
        for (const key of ['url', 'content_url', 'media_url']) {
          const nested = itemRecord[key];
          if (typeof nested === 'string' && nested.trim()) urls.push(nested.trim());
        }
      }
    }
  }
  return [...new Set(urls)];
}

let smsInboxWhitelistWarned = false;

async function saveInboundSmsForAdminInbox(params: {
  smsMessagesRepository?: SmsMessagesRepository;
  event: {
    id: string;
    event_type: string;
    payload?: unknown;
  };
  rawPayload: unknown;
  log: ReturnType<typeof withLogContext>;
}): Promise<void> {
  if (!isInboundSmsMessage(params.event.event_type)) return;
  if (!params.smsMessagesRepository) {
    params.log.warn({ eventId: params.event.id, eventType: params.event.event_type }, 'telnyx_sms_inbox_repository_unavailable');
    return;
  }

  const allowedNumbers = getAllowedSmsInboxNumbers();
  if (allowedNumbers.length === 0) {
    if (!smsInboxWhitelistWarned) {
      smsInboxWhitelistWarned = true;
      params.log.warn({ eventId: params.event.id }, 'telnyx_sms_inbox_whitelist_empty');
    }
    return;
  }

  const toNumber = normalizeSmsInboxPhoneNumber(firstPhone(params.event.payload, ['to', 'to_number']));
  const fromNumber = normalizeSmsInboxPhoneNumber(firstPhone(params.event.payload, ['from', 'from_number']));
  if (!toNumber || !fromNumber) {
    params.log.warn(
      {
        eventId: params.event.id,
        eventType: params.event.event_type,
        toNumber: toNumber ? maskPhone(toNumber) : null,
        fromNumber: fromNumber ? maskPhone(fromNumber) : null,
      },
      'telnyx_sms_inbox_missing_phone',
    );
    return;
  }
  if (!allowedNumbers.includes(toNumber)) {
    params.log.info(
      { eventId: params.event.id, toNumber: maskPhone(toNumber) },
      'telnyx_sms_inbox_number_not_allowed',
    );
    return;
  }

  const telnyxMessageId = firstString(params.event.payload, ['id', 'message_id', 'messageId']);
  const receivedAt = firstString(params.event.payload, ['received_at', 'created_at', 'sent_at']);
  const body = firstString(params.event.payload, ['text', 'body']) ?? '';
  const saved = await params.smsMessagesRepository.saveInboundFromTelnyxEvent({
    telnyxMessageId,
    telnyxEventId: params.event.id,
    fromNumber,
    toNumber,
    body,
    mediaUrls: extractMediaUrls(params.event.payload),
    eventType: params.event.event_type,
    rawPayload: params.rawPayload,
    receivedAt,
  });
  params.log.info(
    {
      eventId: params.event.id,
      telnyxMessageId: telnyxMessageId ?? null,
      fromNumber: maskPhone(fromNumber),
      toNumber: maskPhone(toNumber),
      created: saved.created,
    },
    'telnyx_sms_inbox_saved',
  );
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
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    testCallAttemptsRepository?: TestCallAttemptsRepository;
    customersRepository?: CustomersRepository;
    smsMessagesRepository?: SmsMessagesRepository;
    outboundMessagesRepository?: OutboundMessagesRepository;
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
    const processing = await deps.providerEventsRepository.tryMarkProcessing({
      provider: 'telnyx',
      providerEventId: event.id,
      eventType: event.event_type,
      payload: parsed.data,
    });
    if (!processing.acquired) {
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

    const outboundStatusEvent = extractTelnyxOutboundMessageStatusEvent(parsedBody);
    if (outboundStatusEvent) {
      const errorInfo = extractTelnyxError(outboundStatusEvent.errors);
      let result: 'updated' | 'not_found' | 'ignored_downgrade' | 'ignored_non_outbound' = 'not_found';
      let repositoryUnavailable = false;
      if (!deps.outboundMessagesRepository?.markDeliveryStatus) {
        repositoryUnavailable = true;
        log.warn(
          {
            eventId: outboundStatusEvent.eventId,
            eventType: outboundStatusEvent.eventType,
            telnyxMessageId: outboundStatusEvent.telnyxMessageId,
            telnyxStatus: outboundStatusEvent.telnyxStatus,
          },
          'telnyx_outbound_sms_status_repository_unavailable',
        );
      } else {
        const update = await deps.outboundMessagesRepository.markDeliveryStatus({
          telnyxMessageId: outboundStatusEvent.telnyxMessageId,
          telnyxEventId: outboundStatusEvent.eventId,
          eventType: outboundStatusEvent.eventType,
          telnyxStatus: outboundStatusEvent.telnyxStatus,
          providerStatusPayload: outboundStatusEvent.rawPayload,
          occurredAt: outboundStatusEvent.occurredAt,
          completedAt: outboundStatusEvent.completedAt,
          errorCode: errorInfo.errorCode,
          errorMessage: errorInfo.errorMessage,
        });
        result = update.result;
      }

      const logPayload = {
        eventId: outboundStatusEvent.eventId,
        eventType: outboundStatusEvent.eventType,
        telnyxMessageId: outboundStatusEvent.telnyxMessageId,
        telnyxStatus: outboundStatusEvent.telnyxStatus,
        fromNumber: outboundStatusEvent.fromNumber ? maskPhone(outboundStatusEvent.fromNumber) : null,
        toNumber: outboundStatusEvent.toNumber ? maskPhone(outboundStatusEvent.toNumber) : null,
        result,
      };
      if (repositoryUnavailable) {
        log.info(logPayload, 'telnyx_outbound_sms_status_acknowledged_without_repository');
      } else if (result === 'not_found') {
        log.warn(logPayload, 'telnyx_outbound_sms_status_message_not_found');
      } else {
        log.info(logPayload, 'telnyx_outbound_sms_status_processed');
      }
      await deps.providerEventsRepository.clearProcessingError('telnyx', event.id);
      incrementMetric('webhook_requests_total', {
        provider: 'telnyx',
        outcome: 'processed',
      });
      return c.json({ ok: true, outboundSms: result }, 200);
    }

    if (isTelnyxOutboundStatusEventType(event.event_type)) {
      const statusPayload = asRecord(event.payload);
      const direction = typeof statusPayload?.direction === 'string' ? statusPayload.direction.toLowerCase() : null;
      const ignoredResult = direction && direction !== 'outbound' ? 'ignored_non_outbound' : 'ignored';
      log.warn(
        { eventId: event.id, eventType: event.event_type, result: ignoredResult },
        'telnyx_outbound_sms_status_ignored_unmatchable',
      );
      await deps.providerEventsRepository.clearProcessingError('telnyx', event.id);
      incrementMetric('webhook_requests_total', {
        provider: 'telnyx',
        outcome: 'processed',
      });
      return c.json({ ok: true, outboundSms: ignoredResult }, 200);
    }

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
          const subsRepo = deps.billingSubscriptionsRepository;
          const accessStatesRepo = deps.shopAccessStatesRepository;
          let canEnqueueMissedPaidFollowup = false;
          if (!subsRepo || !accessStatesRepo) {
            log.warn(
              { eventId: event.id, shopId: shop.id, callerPhone },
              'paid_followup_gate_unavailable',
            );
          } else {
            const access = await getShopBillingAccess(
              {
                shopsRepository: deps.shopsRepository,
                billingSubscriptionsRepository: subsRepo,
                shopAccessStatesRepository: accessStatesRepo,
                testCallAttemptsRepository: deps.testCallAttemptsRepository,
              },
              { shopId: shop.id },
            );
            if (!access.canReceiveLiveCalls) {
              log.info(
                { eventId: event.id, shopId: shop.id, callerPhone, blockReason: access.blockReason },
                'telnyx_missed_call_followup_blocked_by_billing',
              );
              incrementMetric('billing_blocked_workflows_total', {
                workflow: 'missed_call_followup_sms',
                reason: access.blockReason,
              });
            } else {
              canEnqueueMissedPaidFollowup = true;
            }
          }

          if (canEnqueueMissedPaidFollowup) {
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
              log.info({ eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_missed_call_followup_queued');
            } else {
              log.info({ eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_missed_call_followup_deduped');
            }
          } else if (subsRepo && accessStatesRepo) {
            log.info({ eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_missed_call_followup_not_queued');
          }
        }
      }
    }

    await saveInboundSmsForAdminInbox({
      smsMessagesRepository: deps.smsMessagesRepository,
      event,
      rawPayload: parsedBody,
      log,
    });

    if (deps.jobsRepository && deps.shopsRepository && isCallbackRequestMessage(event.event_type, event.payload)) {
      const destinationPhone = normalizePhone(firstString(event.payload, ['to', 'to_number']));
      const callerPhone = normalizePhone(firstString(event.payload, ['from', 'from_number']));
      if (destinationPhone && callerPhone) {
        const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, destinationPhone);
        if (shop) {
          let canUsePaidFollowup = true;
          if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
            const access = await getShopBillingAccess(
              {
                shopsRepository: deps.shopsRepository,
                billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
                shopAccessStatesRepository: deps.shopAccessStatesRepository,
                testCallAttemptsRepository: deps.testCallAttemptsRepository,
              },
              { shopId: shop.id },
            );
            if (!access.canReceiveLiveCalls) {
              log.info(
                { eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone), blockReason: access.blockReason },
                'telnyx_callback_request_blocked_by_billing',
              );
              incrementMetric('billing_blocked_workflows_total', {
                workflow: 'callback_request_owner_alert',
                reason: access.blockReason,
              });
              canUsePaidFollowup = false;
            }
          }
          if (!canUsePaidFollowup) {
            log.info({ eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_callback_request_not_queued');
          } else {
            const callback = deps.callbacksRepository
              ? await deps.callbacksRepository.create({
                  shopId: shop.id,
                  customerPhone: callerPhone,
                  reason: 'Customer replied YES for callback SMS',
                })
              : null;
            await deps.jobsRepository.enqueue({
              shopId: shop.id,
              type: 'callback_request_owner_alert',
              payload: {
                callbackId: callback?.id,
                callerPhone,
                reason: 'Customer replied YES for callback SMS',
              },
              runAt: new Date(),
              idempotencyKey: `telnyx_callback_request_owner_alert:${event.id}`,
            });
            log.info({ eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_callback_request_owner_alert_queued');
          }
        }
      }
    }

    if (deps.customersRepository && deps.shopsRepository && isSmsOptOutMessage(event.event_type, event.payload)) {
      const destinationPhone = normalizePhone(firstString(event.payload, ['to', 'to_number']));
      const callerPhone = normalizePhone(firstString(event.payload, ['from', 'from_number']));
      if (destinationPhone && callerPhone) {
        await deps.customersRepository.setPlatformSmsOptOut(callerPhone);
        const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, destinationPhone);
        if (shop) {
          await deps.customersRepository.setSmsOptOut(shop.id, callerPhone, true);
          log.info({ eventId: event.id, shopId: shop.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_sms_stop_opt_out_recorded');
        } else {
          log.info({ eventId: event.id, callerPhone: maskPhone(callerPhone) }, 'telnyx_sms_stop_platform_opt_out_recorded');
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
