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
  BillingSubscriptionsRepository,
  HandoffSessionsRepository,
  JobsRepository,
  MissedCallsRepository,
  ProviderEventsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
  VoiceCallLegsRepository,
  ForwardingTestSessionsRepository,
  CommercialAccountsRepository,
  ShopActiveCallSessionsRepository,
} from '@/src/backend/ports/repositories';
import { securityAudit } from '@/src/backend/security/audit-log';
import { verifyTelnyxSignature } from '@/src/backend/security/telnyx-signature';
import { getClientIp } from '@/src/backend/security/rate-limit';
import { maskPhone } from '@/src/backend/security/pii';
import {
  buildTelnyxCallRejectPayload,
  callControlAnswer,
  callControlBridgeCalls,
  callControlCreateCall,
  callControlHangup,
  callControlReject,
  callControlSpeak,
} from '@/src/backend/services/calls/call-control-client';
import {
  handoffOnGatherEnded,
  handoffOnHangup,
  handoffOnOwnerCallAnswered,
  handoffOnOwnerOutboundInitiated,
  type HandoffOrchestratorDeps,
} from '@/src/backend/services/calls/handoff-orchestrator';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
import { getTelnyxOpenAiSipLegTimeoutSecs } from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { resolveTelnyxOutboundCallsConnectionId } from '@/src/backend/adapters/telnyx/telnyx-outbound-connection-id';
import { normalizeInboundE164, resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';
import {
  bridgedPeerCallControlIdFromPayload,
  decodeCallControlClientState,
  evaluateTelnyxCallControlInboundInitiated,
  firstStringFromPayload,
  isCallAnsweredEvent,
  isCallBridgedEvent,
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
/** Idempotency for parent↔OpenAI bridge (survives duplicate `call.answered` with new event ids). */
const OPENAI_BRIDGE_COMMIT_PROVIDER = 'telnyx_cc_openai_bridge_commit';

/** Parent leg answered → OpenAI bridge not yet confirmed; used for silent-caller risk logging. */
const parentOpenAiBridgeWatch = new Map<
  string,
  { answeredAtMs: number; rbCallId: string; shopId: string; telnyxEventId?: string }
>();

function scheduleSilentCallerRiskWatch(params: {
  parentCallControlId: string;
  rbCallId: string;
  shopId: string;
  telnyxEventId?: string;
  log: ReturnType<typeof withLogContext>;
  answeredAtMs?: number;
}): void {
  const answeredAtMs = params.answeredAtMs ?? Date.now();
  parentOpenAiBridgeWatch.set(params.parentCallControlId, {
    answeredAtMs,
    rbCallId: params.rbCallId,
    shopId: params.shopId,
    telnyxEventId: params.telnyxEventId,
  });
  const parentCc = params.parentCallControlId;
  setTimeout(() => {
    const pending = parentOpenAiBridgeWatch.get(parentCc);
    if (!pending) return;
    params.log.warn(
      {
        rbCallId: pending.rbCallId,
        shopId: pending.shopId,
        parentCallControlId: parentCc,
        telnyxEventId: pending.telnyxEventId,
        elapsedMs: Date.now() - pending.answeredAtMs,
      },
      'silent_caller_risk_detected',
    );
    incrementMetric('silent_caller_risk_total', { shopId: pending.shopId });
  }, 7000);
}

function clearSilentCallerRiskWatch(parentCallControlId: string): void {
  parentOpenAiBridgeWatch.delete(parentCallControlId);
}

function openAiBridgeCommitKey(parentCallControlId: string, openaiLegCallControlId: string): string {
  return `v1:${parentCallControlId}:${openaiLegCallControlId}`;
}

type TelnyxOpenAiConnectMode = 'transfer' | 'create_and_bridge' | 'texml_fallback' | 'disabled';

function getTelnyxOpenAiConnectMode(): TelnyxOpenAiConnectMode {
  const raw = (process.env.TELNYX_OPENAI_CONNECT_MODE ?? 'create_and_bridge').trim().toLowerCase();
  if (raw === 'transfer') return 'transfer';
  if (raw === 'texml_fallback') return 'texml_fallback';
  if (raw === 'disabled') return 'disabled';
  return 'create_and_bridge';
}

function sipUriHostOnly(uri: string): string {
  const trimmed = uri.trim();
  const noScheme = trimmed.replace(/^sips?:/i, '');
  const hostPart = noScheme.includes('@') ? noScheme.split('@')[1] ?? '' : noScheme;
  const host = hostPart.split(';')[0]?.trim() ?? '';
  return host || 'unknown';
}

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
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  testingTelnyxFetch?: typeof fetch;
}): HandoffOrchestratorDeps | null {
  if (!deps.handoffSessionsRepository || !deps.shopsRepository) return null;
  return {
    handoffSessionsRepository: deps.handoffSessionsRepository,
    shopsRepository: deps.shopsRepository,
    jobsRepository: deps.jobsRepository,
    callLogsRepository: deps.callLogsRepository,
    voiceCallLegsRepository: deps.voiceCallLegsRepository,
    testingTelnyxFetch: deps.testingTelnyxFetch,
    apiKey: getEnv().TELNYX_API_KEY,
  };
}

export async function handleTelnyxCallControlWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository?: ShopsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
    commercialAccountsRepository?: CommercialAccountsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    missedCallsRepository?: MissedCallsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    voiceCallLegsRepository?: VoiceCallLegsRepository;
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
  if (isCallBridgedEvent(event.event_type)) {
    return processCallBridged(c, { ...deps, shopsRepository }, event, bodyText, log);
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
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
    commercialAccountsRepository?: CommercialAccountsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    voiceCallLegsRepository?: VoiceCallLegsRepository;
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
      if (dec?.purpose === 'openai_sip_leg') {
        log.info(
          {
            rbCallId: dec.rbCallId ?? dec.requestId,
            shopId: dec.shopId,
            parentCallControlId: dec.parentCallControlId ?? dec.telnyxCallControlId,
            openaiLegCallControlId: firstStringFromPayload(pl, ['call_control_id', 'call_leg_id']),
            purpose: dec.purpose,
            event_type: event.event_type,
          },
          'telnyx_call_control_openai_leg_webhook_received',
        );
        const rbCallId = dec.rbCallId ?? dec.requestId;
        const shopId = dec.shopId;
        const legCc = firstStringFromPayload(pl, ['call_control_id', 'call_leg_id']);
        if (deps.voiceCallLegsRepository && rbCallId && shopId) {
          try {
            await deps.voiceCallLegsRepository.createOrUpdateCallLeg({
              shopId,
              rbCallId,
              purpose: 'openai_sip_leg',
              callControlId: legCc ?? null,
              parentCallControlId: dec.parentCallControlId ?? dec.telnyxCallControlId ?? null,
              status: 'openai_leg_initiated',
            });
            log.info({ shopId, rbCallId, parentCallControlId: dec.parentCallControlId ?? dec.telnyxCallControlId }, 'openai_leg_webhook_upserted');
          } catch (err) {
            log.warn({ err, shopId, rbCallId }, 'openai_leg_webhook_upsert_failed');
          }
        }
        await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
        incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'processed' });
        return c.json({ ok: true, phase: 'openai_leg_initiated' }, 200);
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
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
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
          reason: result.reason ?? 'shop_resolved_and_mode_enabled',
          route_kind: result.routeKind ?? 'shop',
          demo_vertical: result.demoVertical ?? null,
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
          demo_number_matched: result.resolver?.demoNumberMatched === true,
          shop_lookup_skipped_for_demo: result.resolver?.shopLookupSkippedForDemo === true,
        },
        result.routeKind === 'demo' ? 'vertical_demo_did_matched' : 'telnyx_call_control_inbound_decision',
      );
    } else if (result.decision === 'dry_run') {
      log.info(
        {
          ...arch,
          telnyxEventId: event.id,
          event_type: event.event_type,
          decision: 'dry_run',
          reason: result.reason ?? 'shop_resolved_dry_run_env',
          route_kind: result.routeKind ?? 'shop',
          demo_vertical: result.demoVertical ?? null,
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
          demo_number_matched: result.resolver?.demoNumberMatched === true,
          shop_lookup_skipped_for_demo: result.resolver?.shopLookupSkippedForDemo === true,
        },
        result.routeKind === 'demo' ? 'vertical_demo_did_matched' : 'telnyx_call_control_inbound_decision',
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
      deps.callLogsRepository &&
      !result.forwardingConnectivityTest
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
        const answerBody: Record<string, unknown> = { client_state: result.clientState };
        if (result.shopId && !result.forwardingConnectivityTest && deps.callLogsRepository && deps.shopsRepository) {
          const shop = await deps.shopsRepository.findById(result.shopId).catch(() => null);
          if (shop) {
            const commercialAccount = deps.commercialAccountsRepository
              ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null)
              : null;
            const usage = await getShopUsageForPeriod(
              { callLogsRepository: deps.callLogsRepository, shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository },
              { shop, commercialAccount },
            );
            if (usage.overCapturedCallerLimit) {
              const rr = await callControlReject(result.callControlId, buildTelnyxCallRejectPayload('CALL_REJECTED'), fetchDeps);
              log.warn({ shopId: shop.id, status: rr.ok ? 'rejected' : rr.status }, 'telnyx_call_control_usage_limit_rejected');
              await deps.callLogsRepository.setOutcomeByProviderCallId({ provider: 'telnyx_call_control', providerCallId: result.callControlId, outcome: 'error' }).catch(() => {});
              return c.json({ ok: true, blocked: true, reason: 'usage_limit_reached' });
            }
            if (deps.shopActiveCallSessionsRepository) {
              const now = new Date();
              const acquired = await deps.shopActiveCallSessionsRepository.acquireSlot({
                shopId: shop.id,
                provider: 'telnyx_call_control',
                callSessionId: result.callControlId,
                limit: usage.maxConcurrentLiveCalls,
                startedAt: now,
                expiresAt: new Date(now.getTime() + usage.limits.maxCallDurationSeconds * 1000),
              });
              if (!acquired.acquired) {
                const rr = await callControlReject(result.callControlId, buildTelnyxCallRejectPayload('USER_BUSY'), fetchDeps);
                log.warn({ shopId: shop.id, status: rr.ok ? 'rejected' : rr.status }, 'telnyx_call_control_concurrency_limit_rejected');
                await deps.callLogsRepository.setOutcomeByProviderCallId({ provider: 'telnyx_call_control', providerCallId: result.callControlId, outcome: 'error' }).catch(() => {});
                return c.json({ ok: true, blocked: true, reason: 'concurrency_limit_reached' });
              }
            }
            answerBody.max_duration_secs = usage.limits.maxCallDurationSeconds;
          }
        }
        if (!answerBody.max_duration_secs && getEnv().TELNYX_ANSWER_MAX_DURATION_ENABLED) {
          answerBody.max_duration_secs = getEnv().TELNYX_INBOUND_MAX_DURATION_SECS;
        }
        const ar = await callControlAnswer(result.callControlId, answerBody, fetchDeps);
        if (!ar.ok) {
          log.warn({ status: ar.status, body: ar.text }, 'telnyx_call_control_answer_failed');
        } else {
          log.info(
            {
              telnyxEventId: event.id,
              shopId: result.shopId,
              rbCallId: result.internalRequestId,
              parentCallControlId: result.callControlId,
              maxDurationOnAnswer: Boolean(getEnv().TELNYX_ANSWER_MAX_DURATION_ENABLED),
            },
            'telnyx_call_control_answer_succeeded',
          );
          if (deps.voiceCallLegsRepository && result.shopId && result.internalRequestId && !result.forwardingConnectivityTest) {
            try {
              await deps.voiceCallLegsRepository.createOrUpdateCallLeg({
                shopId: result.shopId,
                rbCallId: result.internalRequestId,
                purpose: 'parent_caller_leg',
                callControlId: result.callControlId,
                callSessionId: firstStringFromPayload(plInbound, ['call_session_id']) ?? null,
                status: 'parent_leg_answered',
              });
              log.info(
                {
                  shopId: result.shopId,
                  rbCallId: result.internalRequestId,
                  purpose: 'parent_caller_leg',
                  parentCallControlId: result.callControlId,
                },
                'voice_call_leg_persisted',
              );
            } catch (err) {
              log.warn({ err, shopId: result.shopId, rbCallId: result.internalRequestId }, 'voice_call_leg_persist_parent_failed');
            }
          }
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
    voiceCallLegsRepository?: VoiceCallLegsRepository;
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

    if (decodedClient?.purpose === 'forwarding_connectivity_test' && callControlId) {
      const dryRunFwd = isTelnyxCallControlDryRunEnv();
      const fetchDepsFwd = { fetchImpl: deps.testingTelnyxFetch, apiKey: env.TELNYX_API_KEY };
      if (!dryRunFwd) {
        const speakResult = await callControlSpeak(
          callControlId,
          {
            payload: 'RingBooker received your forwarded test call. You can hang up now.',
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          fetchDepsFwd,
        );
        if (!speakResult.ok) {
          log.warn({ status: speakResult.status, body: speakResult.text }, 'telnyx_forwarding_test_speak_failed');
        }
        const hangResult = await callControlHangup(callControlId, {}, fetchDepsFwd);
        if (!hangResult.ok) {
          log.warn({ status: hangResult.status, body: hangResult.text }, 'telnyx_forwarding_test_hangup_failed');
        }
      }
      await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
      incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'processed' });
      log.info({ shopId: decodedClient.shopId, callControlId }, 'telnyx_call_control_forwarding_test_answered');
      return c.json({ ok: true, phase: 'forwarding_connectivity_test' }, 200);
    }

    const dryRun = isTelnyxCallControlDryRunEnv();
    const fetchDeps = { fetchImpl: deps.testingTelnyxFetch, apiKey: env.TELNYX_API_KEY };

    let bridged = false;
    let bridgeReason: string | undefined;
    const connectMode = getTelnyxOpenAiConnectMode();

    if (decodedClient?.purpose === 'openai_sip_leg') {
      const openaiLegCallControlId = callControlId;
      const parentCallControlId = decodedClient.parentCallControlId ?? decodedClient.telnyxCallControlId;
      if (!dryRun && parentCallControlId && openaiLegCallControlId) {
        const rbId = decodedClient.rbCallId ?? decodedClient.requestId;
        if (deps.voiceCallLegsRepository && decodedClient.shopId && rbId) {
          try {
            await deps.voiceCallLegsRepository.createOrUpdateCallLeg({
              shopId: decodedClient.shopId,
              rbCallId: rbId,
              purpose: 'openai_sip_leg',
              callControlId: openaiLegCallControlId,
              parentCallControlId,
              status: 'openai_leg_answered',
            });
            log.info(
              { shopId: decodedClient.shopId, rbCallId: rbId, parentCallControlId },
              'openai_leg_webhook_upserted',
            );
          } catch (err) {
            log.warn({ err, shopId: decodedClient.shopId, rbCallId: rbId }, 'openai_leg_webhook_upsert_failed');
          }
        }
        const commitKey = openAiBridgeCommitKey(parentCallControlId, openaiLegCallControlId);
        const alreadyBridged = await deps.providerEventsRepository.hasProcessed(OPENAI_BRIDGE_COMMIT_PROVIDER, commitKey);
        if (alreadyBridged) {
          bridged = true;
          bridgeReason = 'openai_bridge_idempotent_skip';
          clearSilentCallerRiskWatch(parentCallControlId);
        } else {
          log.info(
            {
              rbCallId: decodedClient.rbCallId ?? decodedClient.requestId,
              shopId: decodedClient.shopId,
              parentCallControlId,
              openaiLegCallControlId,
              bridgePurpose: 'openai',
            },
            'telnyx_call_control_bridge_openai_started',
          );
          const tBridge0 = Date.now();
          const br = await callControlBridgeCalls(parentCallControlId, openaiLegCallControlId, fetchDeps);
          bridged = br.ok;
          if (!br.ok) {
            log.warn(
              {
                status: br.status,
                body: br.text,
                rbCallId: decodedClient.rbCallId ?? decodedClient.requestId,
                shopId: decodedClient.shopId,
                parentCallControlId,
                openaiLegCallControlId,
                bridgePurpose: 'openai',
                bridgeDurationMs: Date.now() - tBridge0,
              },
              'telnyx_call_control_bridge_openai_failed',
            );
            await callControlSpeak(
              parentCallControlId,
              {
                payload:
                  "Sorry, we're having trouble connecting the AI receptionist right now. Please call back shortly.",
                voice: 'Polly.Joanna',
                language: 'en-US',
              },
              fetchDeps,
            );
            clearSilentCallerRiskWatch(parentCallControlId);
            bridgeReason = 'openai_bridge_http_error';
          } else {
            await deps.providerEventsRepository.markProcessed({
              provider: OPENAI_BRIDGE_COMMIT_PROVIDER,
              providerEventId: commitKey,
              eventType: 'openai_bridge_commit',
              payload: {
                sourceEventId: event.id,
                parentCallControlId,
                openaiLegCallControlId,
              },
            });
            const pending = parentOpenAiBridgeWatch.get(parentCallControlId);
            clearSilentCallerRiskWatch(parentCallControlId);
            const rbCallId = decodedClient.rbCallId ?? decodedClient.requestId;
            const shopId = decodedClient.shopId;
            if (pending) {
              log.info(
                {
                  rbCallId,
                  shopId,
                  parentCallControlId,
                  openaiLegCallControlId,
                  call_answered_to_openai_bridged_ms: Date.now() - pending.answeredAtMs,
                  bridgeDurationMs: Date.now() - tBridge0,
                },
                'call_timing_openai_bridged',
              );
            }
            log.info(
              {
                rbCallId,
                shopId,
                parentCallControlId,
                openaiLegCallControlId,
                bridgePurpose: 'openai',
              },
              'telnyx_call_control_bridge_openai_succeeded',
            );
            if (deps.voiceCallLegsRepository && rbCallId && shopId) {
              try {
                await deps.voiceCallLegsRepository.markCallLegStatus({
                  shopId,
                  rbCallId,
                  purpose: 'openai_sip_leg',
                  status: 'openai_bridge_confirmed',
                  callControlId: openaiLegCallControlId,
                });
                log.info({ shopId, rbCallId, openaiLegCallControlId }, 'voice_call_leg_persisted');
              } catch (err) {
                log.warn({ err, shopId, rbCallId }, 'voice_call_leg_openai_bridge_status_failed');
              }
            }
            bridgeReason = 'openai_bridge_api_ok';
          }
        }
      } else {
        bridgeReason = dryRun ? 'dry_run' : 'missing_parent_for_openai_leg';
      }
    } else if (connectMode === 'create_and_bridge' && !dryRun && env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP && callControlId) {
      const sipUri = env.OPENAI_SIP_URI?.trim() ?? '';
      if (/^sips?:/i.test(sipUri)) {
        const toRaw =
          firstStringFromPayload(payload, ['to', 'called_number', 'to_number']) ??
          firstStringFromPayload(payload, ['destination']);
        const fromCli = toRaw ? normalizeInboundE164(toRaw) : null;
        if (fromCli && decodedClient?.shopId) {
          const rbCallId = decodedClient.rbCallId ?? decodedClient.requestId;
          const parentCallSessionId = firstStringFromPayload(payload, ['call_session_id']) ?? decodedClient.telnyxCallSessionId;
          const parentAnsweredReceivedAt = Date.now();

          scheduleSilentCallerRiskWatch({
            parentCallControlId: callControlId,
            rbCallId,
            shopId: decodedClient.shopId,
            telnyxEventId: event.id,
            log,
            answeredAtMs: parentAnsweredReceivedAt,
          });

          if (deps.voiceCallLegsRepository) {
            try {
              await deps.voiceCallLegsRepository.createOrUpdateCallLeg({
                shopId: decodedClient.shopId,
                rbCallId,
                purpose: 'parent_caller_leg',
                callControlId,
                callSessionId: parentCallSessionId ?? null,
                status: 'parent_leg_answered',
              });
              log.info(
                {
                  shopId: decodedClient.shopId,
                  rbCallId,
                  purpose: 'parent_caller_leg',
                  parentCallControlId: callControlId,
                },
                'voice_call_leg_persisted',
              );
            } catch (err) {
              log.warn({ err, shopId: decodedClient.shopId, rbCallId }, 'voice_call_leg_persist_parent_failed');
            }
          }

          const resolvedConn = resolveTelnyxOutboundCallsConnectionId(log);
          if (!resolvedConn) {
            log.warn(
              { rbCallId, shopId: decodedClient.shopId, parentCallControlId: callControlId },
              'telnyx_create_openai_leg_skipped_no_connection_id',
            );
            await callControlSpeak(
              callControlId,
              {
                payload:
                  "Sorry, we're having trouble connecting the AI receptionist right now. Please call back shortly.",
                voice: 'Polly.Joanna',
                language: 'en-US',
              },
              fetchDeps,
            );
            clearSilentCallerRiskWatch(callControlId);
            bridgeReason = 'telnyx_connection_id_misconfigured';
          } else {
            log.info(
              {
                rbCallId,
                shopId: decodedClient.shopId,
                usingConnectionIdSource: resolvedConn.usingConnectionIdSource,
              },
              'telnyx_create_openai_leg_connection_resolved',
            );

            const openAiLegPayload: Record<string, unknown> = {
              shopId: decodedClient.shopId,
              requestId: decodedClient.requestId,
              rbCallId,
              callerPhone: decodedClient.callerPhone ?? null,
              ts: new Date().toISOString(),
              telnyxCallControlId: callControlId,
              parentCallControlId: callControlId,
              parentCallSessionId,
              inboundDid: decodedClient.inboundDid ?? fromCli,
              transport: 'openai_sip_direct',
              handoffTransport: 'telnyx_call_control',
              purpose: 'openai_sip_leg',
            };
            if (decodedClient.routeKind === 'demo' && decodedClient.demoVertical) {
              openAiLegPayload.routeKind = 'demo';
              openAiLegPayload.demoVertical = decodedClient.demoVertical;
            }
            const openAiClientState = Buffer.from(JSON.stringify(openAiLegPayload), 'utf8').toString('base64');

            const tCreate0 = Date.now();
            log.info(
              {
                rbCallId,
                shopId: decodedClient.shopId,
                parentCallControlId: callControlId,
                purpose: 'openai_sip_leg',
                openaiSipHost: sipUriHostOnly(sipUri),
              },
              'telnyx_call_control_create_openai_leg_started',
            );

            const cr = await callControlCreateCall(
              {
                to: sipUri,
                from: fromCli,
                connection_id: resolvedConn.connectionId,
                client_state: openAiClientState,
                timeout_secs: getTelnyxOpenAiSipLegTimeoutSecs(),
                sip_transport_protocol: 'TLS',
              },
              {
                ...fetchDeps,
                operation: 'call_control.create_openai_sip_leg',
                correlation: {
                  rbCallId,
                  shopId: decodedClient.shopId,
                },
              },
            );

            if (!cr.ok) {
              log.warn(
                {
                  status: cr.status,
                  body: cr.text,
                  rbCallId,
                  shopId: decodedClient.shopId,
                  parentCallControlId: callControlId,
                  phase: 'create_openai_leg',
                  createDurationMs: Date.now() - tCreate0,
                  call_answered_to_openai_created_ms: Date.now() - parentAnsweredReceivedAt,
                },
                'telnyx_call_control_create_openai_leg_failed',
              );
              await callControlSpeak(
                callControlId,
                {
                  payload:
                    "Sorry, we're having trouble connecting the AI receptionist right now. Please call back shortly.",
                  voice: 'Polly.Joanna',
                  language: 'en-US',
                },
                fetchDeps,
              );
              clearSilentCallerRiskWatch(callControlId);
              bridgeReason = 'create_openai_leg_http_error';
            } else {
              log.info(
                {
                  rbCallId,
                  shopId: decodedClient.shopId,
                  parentCallControlId: callControlId,
                  openaiLegCallControlId: cr.callControlId ?? null,
                  openaiLegCallLegId: cr.callLegId ?? null,
                  purpose: 'openai_sip_leg',
                  createDurationMs: Date.now() - tCreate0,
                  call_answered_to_openai_created_ms: Date.now() - parentAnsweredReceivedAt,
                },
                'telnyx_call_control_create_openai_leg_succeeded',
              );
              if (deps.voiceCallLegsRepository) {
                try {
                  await deps.voiceCallLegsRepository.createOrUpdateCallLeg({
                    shopId: decodedClient.shopId,
                    rbCallId,
                    purpose: 'openai_sip_leg',
                    callControlId: cr.callControlId ?? null,
                    callLegId: cr.callLegId ?? null,
                    parentCallControlId: callControlId,
                    parentCallSessionId: parentCallSessionId ?? null,
                    status: 'openai_leg_created',
                  });
                  log.info(
                    {
                      shopId: decodedClient.shopId,
                      rbCallId,
                      purpose: 'openai_sip_leg',
                      parentCallControlId: callControlId,
                    },
                    'voice_call_leg_persisted',
                  );
                  if (cr.callControlId) {
                    log.info(
                      { shopId: decodedClient.shopId, rbCallId, openaiLegCallControlId: cr.callControlId },
                      'openai_leg_callcontrolid_stored',
                    );
                  } else {
                    log.warn(
                      { shopId: decodedClient.shopId, rbCallId, parentCallControlId: callControlId },
                      'openai_leg_callcontrolid_missing',
                    );
                  }
                } catch (err) {
                  log.warn({ err, shopId: decodedClient.shopId, rbCallId }, 'voice_call_leg_persist_openai_failed');
                }
              } else if (!cr.callControlId) {
                log.warn(
                  { shopId: decodedClient.shopId, rbCallId, parentCallControlId: callControlId },
                  'openai_leg_callcontrolid_missing',
                );
              }
              bridgeReason = 'openai_leg_created_waiting_answered';
            }
          }
        } else {
          bridgeReason = 'missing_from_cli_or_shop';
        }
      } else {
        bridgeReason = 'openai_sip_uri_missing';
      }
    } else if (connectMode === 'disabled') {
      bridgeReason = 'connect_mode_disabled';
    } else if (connectMode === 'texml_fallback') {
      bridgeReason = 'texml_fallback_mode';
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
    voiceCallLegsRepository?: VoiceCallLegsRepository;
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

async function processCallBridged(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository: ShopsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    voiceCallLegsRepository?: VoiceCallLegsRepository;
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

    const payload = event.payload;
    const selfCc = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
    const peerCc = bridgedPeerCallControlIdFromPayload(payload);
    const clientStateRaw = firstStringFromPayload(payload, ['client_state']);
    const decoded = decodeCallControlClientState(clientStateRaw);

    if (decoded?.purpose === 'openai_sip_leg') {
      const parentCallControlId = decoded.parentCallControlId ?? decoded.telnyxCallControlId;
      const openaiLegCallControlId = selfCc;
      log.info(
        {
          rbCallId: decoded.rbCallId ?? decoded.requestId,
          shopId: decoded.shopId,
          parentCallControlId,
          openaiLegCallControlId,
          peerCallControlId: peerCc ?? undefined,
          bridgePurpose: 'openai',
          event_type: event.event_type,
        },
        'telnyx_call_control_openai_bridge_confirmed',
      );
    } else if (selfCc && peerCc) {
      const k1 = openAiBridgeCommitKey(selfCc, peerCc);
      const k2 = openAiBridgeCommitKey(peerCc, selfCc);
      const confirmed =
        (await deps.providerEventsRepository.hasProcessed(OPENAI_BRIDGE_COMMIT_PROVIDER, k1)) ||
        (await deps.providerEventsRepository.hasProcessed(OPENAI_BRIDGE_COMMIT_PROVIDER, k2));
      if (confirmed) {
        log.info(
          {
            callControlId: selfCc,
            peerCallControlId: peerCc,
            event_type: event.event_type,
          },
          'telnyx_call_control_openai_bridge_confirmed',
        );
      }
    }

    const handoffDeps = buildHandoffOrchestratorDeps(deps);
    if (handoffDeps && selfCc && peerCc) {
      const s1 = await handoffDeps.handoffSessionsRepository.findByParentCallControlId(selfCc);
      const s2 = await handoffDeps.handoffSessionsRepository.findByParentCallControlId(peerCc);
      const session =
        s1 && s1.ownerCallControlId === peerCc && ['bridged', 'handoff_completed'].includes(s1.status)
          ? s1
          : s2 && s2.ownerCallControlId === selfCc && ['bridged', 'handoff_completed'].includes(s2.status)
            ? s2
            : null;
      if (session) {
        log.info(
          {
            rbCallId: session.rbCallId,
            shopId: session.shopId,
            handoffId: session.id,
            parentCallControlId: session.parentCallControlId,
            ownerLegCallControlId: session.ownerCallControlId ?? undefined,
            openaiLegCallControlId: session.openaiCallId ?? undefined,
            peerCallControlId: peerCc,
            bridgePurpose: 'owner_handoff',
            status: session.status,
            event_type: event.event_type,
          },
          'telnyx_call_control_owner_bridge_confirmed',
        );
      }
    }

    await deps.providerEventsRepository.clearProcessingError(CALL_CONTROL_EVENTS_PROVIDER, event.id);
    incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'processed' });
    return c.json({ ok: true, phase: 'bridged' }, 200);
  } catch (error) {
    await deps.providerEventsRepository.markProcessingError(
      CALL_CONTROL_EVENTS_PROVIDER,
      event.id,
      error instanceof Error ? error.message : 'webhook_processing_failed',
    );
    incrementMetric('webhook_requests_total', { provider: 'telnyx_call_control', outcome: 'failed' });
    log.error({ err: error, eventId: event.id }, 'telnyx_call_control_bridged_failed');
    return c.json({ ok: false }, 500);
  }
}

async function processCallHangup(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    shopsRepository: ShopsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
    callLogsRepository?: CallLogsRepository;
    jobsRepository?: JobsRepository;
    missedCallsRepository?: MissedCallsRepository;
    handoffSessionsRepository?: HandoffSessionsRepository;
    voiceCallLegsRepository?: VoiceCallLegsRepository;
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

    const callControlLegId = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
    if (deps.voiceCallLegsRepository && decoded?.purpose === 'openai_sip_leg' && callControlLegId) {
      const hangCause = (
        firstStringFromPayload(payload, ['hangup_cause', 'sip_disconnect_cause', 'termination_reason']) ?? ''
      ).toLowerCase();
      if (hangCause.includes('timeout') || hangCause.includes('no_answer') || hangCause.includes('time')) {
        log.warn(
          {
            rbCallId: decoded.rbCallId ?? decoded.requestId,
            shopId: decoded.shopId,
            parentCallControlId: decoded.parentCallControlId ?? decoded.telnyxCallControlId,
            hangCause,
          },
          'telnyx_call_control_openai_leg_timeout',
        );
      }
      try {
        await deps.voiceCallLegsRepository.markCallLegEnded(callControlLegId, 'openai_sip_leg');
      } catch (err) {
        log.warn({ err, callControlLegId }, 'voice_call_leg_mark_openai_hangup_failed');
      }
    }

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

    if (deps.shopActiveCallSessionsRepository && providerCallId) {
      await deps.shopActiveCallSessionsRepository.releaseByCallSession({
        provider: 'telnyx_call_control',
        callSessionId: providerCallId,
        releasedAt: new Date(),
      }).catch((err: unknown) => log.warn({ err, providerCallId }, 'active_call_slot_release_failed'));
    }

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
          },
          { shopId: shop.id },
        );
        if (!access.canReceiveLiveCalls) {
          log.warn(
            { eventId: event.id, shopId: shop.id, callerPhone, blockReason: access.blockReason },
            'telnyx_cc_missed_call_followup_billing_blocked',
          );
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
            idempotencyKey: `telnyx_cc_missed_call_followup:${event.id}`,
          });
          log.info({ eventId: event.id, shopId: shop.id, callerPhone }, 'telnyx_cc_missed_call_followup_queued');
        }
      } else if (subsRepo && accessStatesRepo) {
        log.info({ eventId: event.id, shopId: shop.id, callerPhone }, 'telnyx_cc_missed_call_followup_not_queued');
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
