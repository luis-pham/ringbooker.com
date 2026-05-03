import type { Context } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import {
  getResolvedHandoffTransport,
  getResolvedVoiceTransport,
  getTelnyxInboundRoutingMode,
} from '@/src/backend/config/voice-transport';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { withLogContext } from '@/src/backend/observability/logger';
import type {
  CallLogsRepository,
  HandoffSessionsRepository,
  JobsRepository,
  MissedCallsRepository,
  ProviderEventsRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { securityAudit } from '@/src/backend/security/audit-log';
import { verifyTelnyxSignature } from '@/src/backend/security/telnyx-signature';
import { getClientIp } from '@/src/backend/security/rate-limit';
import { maskPhone } from '@/src/backend/security/pii';
import {
  buildTelnyxCallRejectPayload,
  callControlAnswer,
  callControlDial,
  callControlReject,
} from '@/src/backend/services/calls/call-control-client';
import {
  handoffOnGatherEnded,
  handoffOnHangup,
  handoffOnOwnerCallAnswered,
  handoffOnOwnerOutboundInitiated,
  type HandoffOrchestratorDeps,
} from '@/src/backend/services/calls/handoff-orchestrator';
import { normalizeInboundE164, resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';
import {
  decodeCallControlClientState,
  evaluateTelnyxCallControlInboundInitiated,
  firstStringFromPayload,
  isCallAnsweredEvent,
  isCallGatherEndedEvent,
  isCallHangupEvent,
  isCallInitiatedEvent,
  isOutboundCallPayload,
  isTelnyxCallControlDryRunEnv,
  isTelnyxMissedInboundCall,
  parseTelnyxCallControlEnvelope,
  telnyxCallControlEnvelopeSchema,
} from '@/src/backend/webhooks/telnyx-call-control';

const CALL_CONTROL_EVENTS_PROVIDER = 'telnyx_call_control';

function inboundArchitectureLogFields() {
  const env = getEnv();
  return {
    inboundRoutingMode: getTelnyxInboundRoutingMode(),
    voiceTransport: getResolvedVoiceTransport(),
    handoffTransport: getResolvedHandoffTransport(),
    bridgeOpenAiSipEnabled: Boolean(env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP),
    openaiSipUriConfigured: /^sips?:/i.test(env.OPENAI_SIP_URI?.trim() ?? ''),
  };
}

function buildHandoffOrchestratorDeps(deps: {
  handoffSessionsRepository?: HandoffSessionsRepository;
  shopsRepository?: ShopsRepository;
  jobsRepository?: JobsRepository;
  callLogsRepository?: CallLogsRepository;
  testingTelnyxFetch?: typeof fetch;
}): HandoffOrchestratorDeps | null {
  if (!deps.handoffSessionsRepository || !deps.shopsRepository) return null;
  return {
    handoffSessionsRepository: deps.handoffSessionsRepository,
    shopsRepository: deps.shopsRepository,
    jobsRepository: deps.jobsRepository,
    callLogsRepository: deps.callLogsRepository,
    testingTelnyxFetch: deps.testingTelnyxFetch,
    apiKey: getEnv().TELNYX_API_KEY,
  };
}

export async function handleTelnyxCallControlWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository?: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    missedCallsRepository?: MissedCallsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    testingTelnyxFetch?: typeof fetch;
  },
) {
  const env = getEnv();
  if (!env.TELNYX_CALL_CONTROL_WEBHOOK_ENABLED) {
    return c.body(null, 404);
  }

  const shopsRepository = deps.shopsRepository;
  if (!shopsRepository) {
    return c.json({ ok: false, error: 'shops_repository_unavailable' }, 503);
  }

  const bodyText = await c.req.text();
  const signature = c.req.header('telnyx-signature-ed25519') ?? null;
  const timestamp = c.req.header('telnyx-timestamp') ?? null;

  const verified = verifyTelnyxSignature({
    body: bodyText,
    timestamp,
    signature,
    publicKey: env.TELNYX_WEBHOOK_PUBLIC_KEY,
    maxSkewSeconds: env.TELNYX_WEBHOOK_MAX_SKEW_SECONDS,
  });

  if (!verified) {
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'invalid_signature',
    });
    securityAudit({
      action: 'webhook_signature_invalid',
      actorType: 'provider',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      provider: 'telnyx_call_control',
    });
    return c.json({ ok: false }, 401);
  }

  const parsed = parseTelnyxCallControlEnvelope(bodyText);
  if (!parsed.ok) {
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'invalid_payload',
    });
    return c.json({ ok: false }, 400);
  }

  const event = parsed.event;
  const payload = event.payload;
  const plRec = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const clientStateRaw = firstStringFromPayload(payload, ['client_state']);
  const decodedShopHint = decodeCallControlClientState(clientStateRaw);
  const log = withLogContext({
    requestId: c.req.header('x-request-id') ?? undefined,
    provider: 'telnyx_call_control',
    telnyxEventId: event.id,
    shopId: decodedShopHint?.shopId,
    rbCallId: decodedShopHint?.rbCallId ?? decodedShopHint?.requestId,
  });

  log.info(
    {
      event_type: event.event_type,
      call_control_id: firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']),
      call_session_id: firstStringFromPayload(payload, ['call_session_id']),
      from_masked: maskPhone(firstStringFromPayload(payload, ['from', 'from_number', 'caller_number']) ?? ''),
      to_masked: maskPhone(firstStringFromPayload(payload, ['to', 'called_number', 'to_number']) ?? ''),
      direction:
        typeof plRec.direction === 'string'
          ? plRec.direction
          : typeof plRec.call_direction === 'string'
            ? plRec.call_direction
            : undefined,
      telnyx_call_control_id: firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']),
    },
    'telnyx_call_control_webhook_received',
  );

  if (isCallInitiatedEvent(event.event_type)) {
    return processCallInitiated(c, { ...deps, shopsRepository }, event, bodyText, log);
  }
  if (isCallAnsweredEvent(event.event_type)) {
    return processCallAnswered(c, { ...deps, shopsRepository }, event, bodyText, log);
  }
  if (isCallGatherEndedEvent(event.event_type)) {
    return processCallGatherEnded(c, { ...deps, shopsRepository }, event, bodyText, log);
  }
  if (isCallHangupEvent(event.event_type)) {
    return processCallHangup(c, { ...deps, shopsRepository }, event, bodyText, log);
  }

  return c.json({ ok: true, ignored: true }, 200);
}

async function processCallInitiated(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    testingTelnyxFetch?: typeof fetch;
  },
  event: { event_type: string; id: string; payload?: unknown },
  bodyText: string,
  log: ReturnType<typeof withLogContext>,
) {
  try {
    const alreadyProcessed = await deps.providerEventsRepository.hasProcessed(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    if (alreadyProcessed) {
      incrementMetric('webhook_requests_total', {
        provider: 'telnyx_call_control',
        outcome: 'duplicate',
      });
      log.info({ eventId: event.id }, 'telnyx_call_control_webhook_duplicate');
      return c.json({ ok: true, duplicate: true }, 200);
    }

    const validatedRoot = telnyxCallControlEnvelopeSchema.parse(JSON.parse(bodyText));
    await deps.providerEventsRepository.markProcessed({
      provider: CALL_CONTROL_EVENTS_PROVIDER,
      providerEventId: event.id,
      eventType: event.event_type,
      payload: validatedRoot,
    });

    const handoffDeps = buildHandoffOrchestratorDeps(deps);
    const pl = event.payload;
    if (handoffDeps && pl && isOutboundCallPayload(pl)) {
      const clientStateRaw = firstStringFromPayload(pl, ['client_state']);
      const dec = decodeCallControlClientState(clientStateRaw);
      if (dec?.purpose === 'owner_handoff_leg') {
        await handoffOnOwnerOutboundInitiated(pl, handoffDeps, log);
        await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
        incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'processed' });
        return c.json({ ok: true, phase: 'owner_outbound_initiated' }, 200);
      }
    }

    const env = getEnv();
    const plInbound = event.payload;
    const plInboundRec =
      plInbound && typeof plInbound === 'object' ? (plInbound as Record<string, unknown>) : {};
    const fromRawInbound = firstStringFromPayload(plInbound, ['from', 'from_number', 'caller_number']);
    const toRawInbound =
      firstStringFromPayload(plInbound, ['to', 'called_number', 'to_number']) ??
      firstStringFromPayload(plInbound, ['destination']);

    const result = await evaluateTelnyxCallControlInboundInitiated(event.payload, {
      shopsRepository: deps.shopsRepository,
    });

    const arch = inboundArchitectureLogFields();
    const directionInbound =
      typeof plInboundRec.direction === 'string'
        ? plInboundRec.direction
        : typeof plInboundRec.call_direction === 'string'
          ? plInboundRec.call_direction
          : undefined;

    if (!result.handled) {
      log.info(
        {
          ...arch,
          telnyxEventId: event.id,
          event_type: event.event_type,
          handled: false,
          not_handled_reason: result.reason,
          reject_reason: result.reason === 'not_incoming' ? 'unsupported_direction' : 'unknown',
          call_control_id: firstStringFromPayload(plInbound, ['call_control_id', 'call_leg_id']),
          call_session_id: firstStringFromPayload(plInbound, ['call_session_id']),
          direction: directionInbound,
          from_masked: maskPhone(fromRawInbound ?? ''),
          to_masked: maskPhone(toRawInbound ?? ''),
        },
        'telnyx_call_control_inbound_decision',
      );
    } else if (result.decision === 'answer') {
      log.info(
        {
          ...arch,
          telnyxEventId: event.id,
          event_type: event.event_type,
          decision: 'answer',
          reason: 'shop_resolved_and_mode_enabled',
          call_control_id: result.callControlId,
          call_session_id: firstStringFromPayload(plInbound, ['call_session_id']),
          direction: directionInbound,
          from_masked: maskPhone(fromRawInbound ?? ''),
          to_masked: maskPhone(toRawInbound ?? ''),
          from_e164_masked: result.callerPhone ? maskPhone(result.callerPhone) : null,
          to_e164_masked: result.destinationPhone ? maskPhone(result.destinationPhone) : null,
          rbCallId: result.internalRequestId ?? null,
          shopId: result.shopId ?? null,
          resolver: result.resolver,
        },
        'telnyx_call_control_inbound_decision',
      );
    } else if (result.decision === 'dry_run') {
      log.info(
        {
          ...arch,
          telnyxEventId: event.id,
          event_type: event.event_type,
          decision: 'dry_run',
          reason: 'shop_resolved_dry_run_env',
          call_control_id: result.callControlId,
          call_session_id: firstStringFromPayload(plInbound, ['call_session_id']),
          direction: directionInbound,
          from_masked: maskPhone(fromRawInbound ?? ''),
          to_masked: maskPhone(toRawInbound ?? ''),
          from_e164_masked: result.callerPhone ? maskPhone(result.callerPhone) : null,
          to_e164_masked: result.destinationPhone ? maskPhone(result.destinationPhone) : null,
          rbCallId: result.internalRequestId ?? null,
          shopId: result.shopId ?? null,
          resolver: result.resolver,
        },
        'telnyx_call_control_inbound_decision',
      );
    } else if (result.decision === 'reject') {
      log.info(
        {
          ...arch,
          telnyxEventId: event.id,
          event_type: event.event_type,
          decision: 'reject',
          reject_reason: result.reject_reason ?? 'unknown',
          reject_cause_telnyx: result.reject_cause_telnyx ?? 'CALL_REJECTED',
          internal_reason: result.reason,
          call_control_id: result.callControlId,
          call_session_id: firstStringFromPayload(plInbound, ['call_session_id']),
          direction: directionInbound,
          from_masked: maskPhone(fromRawInbound ?? ''),
          to_masked: maskPhone(toRawInbound ?? ''),
          from_e164_masked: result.callerPhone ? maskPhone(result.callerPhone) : null,
          to_e164_masked: result.destinationPhone ? maskPhone(result.destinationPhone) : null,
          rbCallId: result.internalRequestId ?? null,
          shopId: result.shopId ?? null,
          resolver: result.resolver,
        },
        'telnyx_call_control_inbound_decision',
      );
    }

    const dryRun = isTelnyxCallControlDryRunEnv();
    const fetchDeps = { fetchImpl: deps.testingTelnyxFetch, apiKey: env.TELNYX_API_KEY };

    if (
      result.handled &&
      result.shopId &&
      result.callControlId &&
      result.destinationPhone &&
      deps.callLogsRepository
    ) {
      await deps.callLogsRepository.createOrUpdateInboundCall({
        provider: 'telnyx_call_control',
        providerCallId: result.callControlId,
        shopId: result.shopId,
        callerPhone: result.callerPhone ?? undefined,
        destinationPhone: result.destinationPhone,
        requestId: result.internalRequestId,
        startedAt: new Date(),
      });
    }

    if (!dryRun && result.handled && result.callControlId) {
      if (result.decision === 'answer' && result.clientState) {
        const ar = await callControlAnswer(
          result.callControlId,
          { client_state: result.clientState },
          fetchDeps,
        );
        if (!ar.ok) {
          log.warn({ status: ar.status, body: ar.text }, 'telnyx_call_control_answer_failed');
        }
      } else if (result.decision === 'reject') {
        const cause = result.reject_cause_telnyx ?? 'CALL_REJECTED';
        const rr = await callControlReject(
          result.callControlId,
          buildTelnyxCallRejectPayload(cause),
          fetchDeps,
        );
        if (!rr.ok) {
          log.warn(
            { status: rr.status, body: rr.text, reject_cause_telnyx: cause },
            'telnyx_call_control_reject_failed',
          );
        }
      }
    }

    await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'processed',
    });

    log.info({ decision: result.handled ? result.decision : 'not_handled' }, 'telnyx_call_control_webhook_processed');

    return c.json(
      {
        ok: true,
        phase: 'initiated',
        handled: result.handled,
        ...(result.handled
          ? {
              decision: result.decision,
              shopId: result.shopId,
              dry_run: dryRun,
              ...(result.decision === 'reject'
                ? {
                    reject_reason: result.reject_reason,
                    reject_cause_telnyx: result.reject_cause_telnyx,
                  }
                : {}),
            }
          : { reason: result.reason }),
      },
      200,
    );
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      CALL_CONTROL_EVENTS_PROVIDER,
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'failed',
    });
    log.error({ err: error, eventId: event.id }, 'telnyx_call_control_webhook_failed');
    return c.json({ ok: false }, 500);
  }
}

async function processCallAnswered(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    testingTelnyxFetch?: typeof fetch;
  },
  event: { event_type: string; id: string; payload?: unknown },
  bodyText: string,
  log: ReturnType<typeof withLogContext>,
) {
  try {
    const alreadyProcessed = await deps.providerEventsRepository.hasProcessed(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    if (alreadyProcessed) {
      incrementMetric('webhook_requests_total', {
        provider: 'telnyx_call_control',
        outcome: 'duplicate',
      });
      return c.json({ ok: true, duplicate: true }, 200);
    }

    const validatedRoot = telnyxCallControlEnvelopeSchema.parse(JSON.parse(bodyText));
    await deps.providerEventsRepository.markProcessed({
      provider: CALL_CONTROL_EVENTS_PROVIDER,
      providerEventId: event.id,
      eventType: event.event_type,
      payload: validatedRoot,
    });

    const env = getEnv();
    const payload = event.payload;
    const callControlId = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
    const clientStateRaw = firstStringFromPayload(payload, ['client_state']);
    const decodedClient = decodeCallControlClientState(clientStateRaw);
    const handoffDeps = buildHandoffOrchestratorDeps(deps);
    if (handoffDeps && decodedClient?.purpose === 'owner_handoff_leg') {
      await handoffOnOwnerCallAnswered(payload, handoffDeps, log);
      await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
      incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'processed' });
      return c.json({ ok: true, phase: 'owner_handoff_screening' }, 200);
    }

    const dryRun = isTelnyxCallControlDryRunEnv();
    const fetchDeps = { fetchImpl: deps.testingTelnyxFetch, apiKey: env.TELNYX_API_KEY };

    let bridged = false;
    let bridgeReason: string | undefined;

    if (!dryRun && env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP && callControlId) {
      const sipUri = env.OPENAI_SIP_URI?.trim() ?? '';
      if (/^sips?:/i.test(sipUri)) {
        const connectionId = env.TELNYX_CALL_CONTROL_CONNECTION_ID?.trim() || env.TELNYX_APP_ID;
        const toRaw =
          firstStringFromPayload(payload, ['to', 'called_number', 'to_number']) ??
          firstStringFromPayload(payload, ['destination']);
        const fromCli = toRaw ? normalizeInboundE164(toRaw) : null;
        if (fromCli) {
          const dr = await callControlDial(
            callControlId,
            {
              to: sipUri,
              from: fromCli,
              connection_id: connectionId,
              link_to: callControlId,
              bridge_intent: true,
              bridge_on_answer: true,
              sip_transport_protocol: 'TLS',
              ...(clientStateRaw?.trim() ? { client_state: clientStateRaw.trim() } : {}),
            },
            fetchDeps,
          );
          bridged = dr.ok;
          if (!dr.ok) {
            log.warn(
              {
                status: dr.status,
                body: dr.text,
                rbCallId: decodedClient?.rbCallId ?? decodedClient?.requestId,
                shopId: decodedClient?.shopId,
                call_control_id: callControlId,
                phase: 'openai_sip_dial',
              },
              'telnyx_call_control_dial_openai_failed',
            );
            bridgeReason = 'dial_http_error';
          }
        } else {
          bridgeReason = 'missing_from_cli';
        }
      } else {
        bridgeReason = 'openai_sip_uri_missing';
      }
    } else {
      bridgeReason = dryRun
        ? 'dry_run'
        : !env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP
          ? 'bridge_disabled'
          : 'missing_call_control_id';
    }

    await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'processed',
    });
    log.info({ bridged, bridgeReason }, 'telnyx_call_control_answered_processed');

    return c.json(
      {
        ok: true,
        phase: 'answered',
        bridged,
        bridge_reason: bridgeReason,
      },
      200,
    );
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      CALL_CONTROL_EVENTS_PROVIDER,
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'failed',
    });
    log.error({ err: error, eventId: event.id }, 'telnyx_call_control_answered_failed');
    return c.json({ ok: false }, 500);
  }
}

async function processCallGatherEnded(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    testingTelnyxFetch?: typeof fetch;
  },
  event: { event_type: string; id: string; payload?: unknown },
  bodyText: string,
  log: ReturnType<typeof withLogContext>,
) {
  try {
    const alreadyProcessed = await deps.providerEventsRepository.hasProcessed(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    if (alreadyProcessed) {
      incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'duplicate' });
      return c.json({ ok: true, duplicate: true }, 200);
    }

    const validatedRoot = telnyxCallControlEnvelopeSchema.parse(JSON.parse(bodyText));
    await deps.providerEventsRepository.markProcessed({
      provider: CALL_CONTROL_EVENTS_PROVIDER,
      providerEventId: event.id,
      eventType: event.event_type,
      payload: validatedRoot,
    });

    const handoffDeps = buildHandoffOrchestratorDeps(deps);
    if (handoffDeps && event.payload) {
      await handoffOnGatherEnded(event.payload, handoffDeps, log);
    }

    await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'processed' });
    return c.json({ ok: true, phase: 'gather_ended' }, 200);
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      CALL_CONTROL_EVENTS_PROVIDER,
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'failed' });
    log.error({ err: error, eventId: event.id }, 'telnyx_call_control_gather_ended_failed');
    return c.json({ ok: false }, 500);
  }
}

async function processCallHangup(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    missedCallsRepository?: MissedCallsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    testingTelnyxFetch?: typeof fetch;
  },
  event: { event_type: string; id: string; payload?: unknown },
  _bodyText: string,
  log: ReturnType<typeof withLogContext>,
) {
  try {
    const alreadyProcessed = await deps.providerEventsRepository.hasProcessed(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    if (alreadyProcessed) {
      incrementMetric('webhook_requests_total', {
        provider: 'telnyx_call_control',
        outcome: 'duplicate',
      });
      return c.json({ ok: true, duplicate: true }, 200);
    }

    const validatedRoot = telnyxCallControlEnvelopeSchema.parse(JSON.parse(_bodyText));
    await deps.providerEventsRepository.markProcessed({
      provider: CALL_CONTROL_EVENTS_PROVIDER,
      providerEventId: event.id,
      eventType: event.event_type,
      payload: validatedRoot,
    });

    const handoffDeps = buildHandoffOrchestratorDeps(deps);
    if (handoffDeps && event.payload) {
      await handoffOnHangup(event.payload, handoffDeps, log);
    }

    const payload = event.payload;
    const providerCallId = firstStringFromPayload(payload, [
      'call_control_id',
      'call_leg_id',
      'call_session_id',
    ]);
    const clientStateRaw = firstStringFromPayload(payload, ['client_state']);
    const decoded = decodeCallControlClientState(clientStateRaw);

    const destinationRaw =
      firstStringFromPayload(payload, ['to', 'called_number', 'to_number']) ??
      firstStringFromPayload(payload, ['destination']);
    const destinationPhone = destinationRaw ? normalizeInboundE164(destinationRaw) : null;

    const callerRaw = firstStringFromPayload(payload, ['from', 'from_number', 'caller_number']);
    const callerPhone = callerRaw ? normalizeInboundE164(callerRaw) : null;

    let shop =
      decoded && deps.shopsRepository ? await deps.shopsRepository.findById(decoded.shopId) : null;
    if (!shop && destinationRaw && deps.shopsRepository) {
      shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, destinationRaw);
    }

    const answeredAt = firstStringFromPayload(payload, ['answered_at', 'answer_time', 'bridged_at']);
    const missed = isTelnyxMissedInboundCall(event.event_type, payload);

    if (deps.callLogsRepository && providerCallId) {
      await deps.callLogsRepository.markEndedByProviderCallId({
        provider: 'telnyx_call_control',
        providerCallId,
        endedAt: new Date(),
        outcome: missed ? 'missed' : undefined,
        humanAnswered: Boolean(answeredAt),
      });
    }

    if (
      deps.jobsRepository &&
      deps.shopsRepository &&
      missed &&
      destinationPhone &&
      callerPhone &&
      shop
    ) {
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
          idempotencyKey: `telnyx_cc_missed_call_followup:${event.id}`,
        });
        log.info({ eventId: event.id, shopId: shop.id, callerPhone }, 'telnyx_cc_missed_call_followup_queued');
      }
    }

    await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'processed',
    });
    log.info({ missed, providerCallId }, 'telnyx_call_control_hangup_processed');

    return c.json({ ok: true, phase: 'hangup', missed }, 200);
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      CALL_CONTROL_EVENTS_PROVIDER,
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', {
      provider: 'telnyx_call_control',
      outcome: 'failed',
    });
    log.error({ err: error, eventId: event.id }, 'telnyx_call_control_hangup_failed');
    return c.json({ ok: false }, 500);
  }
}
