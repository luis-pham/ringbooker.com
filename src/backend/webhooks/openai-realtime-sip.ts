import type { Context } from 'hono';
import { z } from 'zod';

import { type VoicePromptVertical, openAiRealtimeVoiceForVertical } from '@/src/agent/prompts';
import { getSipShopToolsForOpenAiAccept } from '@/src/agent/sip/sip-tool-definitions';
import {
  createSipAgentToolContext,
  executeSipShopToolCall,
  prePopulateFromTranscript,
  updateSipBookingDraftFromTranscript,
  type SipToolExecutorDeps,
} from '@/src/agent/sip/sip-tool-executor';
import { summarizeBookingDraftForLog } from '@/src/agent/booking/booking-draft';
import { getEnv } from '@/src/backend/config/env';
import { getResolvedVoiceTransport } from '@/src/backend/config/voice-transport';
import type { Shop, ShopVertical } from '@/src/backend/domain/types';
import {
  buildMergedOpenAiSipDemoDidMap,
  SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL,
} from '@/src/backend/demo/demo-vertical-phone-map';
import {
  buildPublicDemoScriptedWelcomeLine,
  buildPublicDemoSystemPrompt,
  type DemoConfigInput,
} from '@/src/backend/demo/public-demo-system-prompt';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';
import { resolveProductionRealtimeTranscriptionDefaultLanguage } from '@/src/backend/prompts/production-language-policy';
import {
  buildProductionInitialGreetingInstructions,
  resolveEffectiveRuntimeConfig,
} from '@/src/backend/domain/resolve-effective-runtime-config';
import type {
  BillingSubscriptionsRepository,
  BookingsRepository,
  CallLogsRepository,
  CommercialAccountsRepository,
  CallbacksRepository,
  DemoSessionsRepository,
  JobsRepository,
  ProviderEventsRepository,
  ShopAccessStatesRepository,
  ShopActiveCallSessionsRepository,
  ShopRoutingRulesRepository,
  ShopsRepository,
  SipDemoSessionEnrichment,
  VoiceCallLegsRepository,
} from '@/src/backend/ports/repositories';
import { securityAudit } from '@/src/backend/security/audit-log';
import { verifyOpenAiStandardWebhookV1 } from '@/src/backend/security/openai-standard-webhook';
import {
  consumeRateLimit,
  getClientIp,
  rateLimitUserMessage,
  RATE_LIMIT_POLICIES,
} from '@/src/backend/security/rate-limit';
import { normalizeInboundE164, resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';
import { getShopBillingAccess, type ShopBillingAccess } from '@/src/backend/services/billing/access';
import { checkLiveCallUsageGate } from '@/src/backend/services/usage/live-call-usage-gate';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { callControlHangup } from '@/src/backend/services/calls/call-control-client';
import { buildOpenAiSipAcceptBody } from '@/src/backend/webhooks/openai-sip-accept-payload';
import {
  collectOpenAiSipDidCandidates,
  extractSipHeader,
  parseE164FromSipValue,
  parseOpenAiProjectUserFromSipTo,
  resolveOpenAiSipDemoDidFromHeaders,
  type OpenAiSipDidContext,
} from '@/src/backend/webhooks/openai-sip-did';
import { startOpenAiRealtimeSipSideband } from '@/src/backend/webhooks/openai-realtime-sip-sideband';
import { markSidebandReadyForAnswer } from '@/src/backend/webhooks/openai-sip-bridge-greeting-coordinator';
import { decodeCallControlClientState, type CallControlClientStatePayload } from '@/src/backend/webhooks/telnyx-call-control';
import { callControlSpeak } from '@/src/backend/services/calls/call-control-client';
import { evaluateOwnerHandoffDestination } from '@/src/backend/services/calls/destination-policy';
import { isHandoffAvailable } from '@/src/agent/tools/request-human-handoff';

/** 5-minute hard cap on Path-B (OpenAI SIP direct) demo calls. */
const DEMO_SIP_MAX_DURATION_MS = 300_000;

/** Fallback reconnect: wait this long before attempting to re-open the sideband WS. */
const WS_FALLBACK_HOLD_MS = 1_500;
/** Fallback reconnect: if the new sideband WS doesn't open within this window, declare failure. */
const WS_RECONNECT_TIMEOUT_MS = 3_000;
/** After playing the goodbye message, wait this long before issuing hangup. */
const HARD_LIMIT_HANGUP_DELAY_MS = 5_000;
/** After end_call tool fires and audio finishes, wait this long before issuing hangup. */
const END_CALL_TOOL_HANGUP_DELAY_MS = 500;
/** After playing the transfer announcement, wait this long before dialling the owner. */
const FALLBACK_TRANSFER_ANNOUNCE_DELAY_MS = 2_000;
/** Retry budget for callControlHangupWithRetry: max attempts. */
const HANGUP_RETRY_ATTEMPTS = 3;
/** Retry budget for callControlHangupWithRetry: delay between attempts. */
const HANGUP_RETRY_DELAY_MS = 1_000;
/**
 * After end_call fires on a demo SIP call that has no Telnyx Call Control ID
 * (can't issue a programmatic hangup), wait this long then force-persist the
 * transcript so data isn't lost if the WS never closes cleanly.
 */
const DEMO_END_CALL_NO_CCID_FALLBACK_MS = 30_000;

const PROD_CALL_HARD_LIMIT_MESSAGE =
  "I need to end our call now. Please call back if you need further assistance. Goodbye.";
const PROD_CALL_SOFT_LIMIT_INSTRUCTION =
  "You must now wrap up the call politely. Say something like: 'Is there anything else I can help you with before we finish?'";
const FALLBACK_HOLD_MESSAGE = 'Please hold for just a moment.';
const FALLBACK_TRANSFER_MESSAGE = "Let me connect you with someone who can help.";
const FALLBACK_ISSUE_MESSAGE =
  "We're experiencing a technical issue. We'll follow up with you shortly.";

type DemoCallTimer = { timer: ReturnType<typeof setTimeout>; telnyxCallControlId: string };
const demoCallTimers = new Map<string, DemoCallTimer>();

/**
 * Wraps callControlHangup with up to HANGUP_RETRY_ATTEMPTS retries spaced
 * HANGUP_RETRY_DELAY_MS apart.
 *
 * Retry policy:
 *   - Retries on network errors and timeouts (transient).
 *   - Stops immediately on HTTP 4xx (call already ended / auth issue — no recovery value).
 *   - Logs a warning on each failure and an error if all attempts are exhausted.
 */
async function callControlHangupWithRetry(
  callControlId: string,
  deps: { apiKey: string; fetchImpl: typeof fetch },
  logCtx: Record<string, unknown>,
): Promise<void> {
  for (let attempt = 1; attempt <= HANGUP_RETRY_ATTEMPTS; attempt++) {
    const result = await callControlHangup(callControlId, {}, deps);
    if (result.ok) {
      if (attempt > 1) logger.info({ ...logCtx, attempt }, 'openai_sip_hangup_retry_succeeded');
      return;
    }
    // HTTP 4xx → call already terminated or auth mismatch; retrying won't help.
    if (result.errorKind === 'http' && result.status >= 400 && result.status < 500) {
      logger.warn({ ...logCtx, attempt, status: result.status }, 'openai_sip_hangup_http_error_no_retry');
      return;
    }
    if (attempt < HANGUP_RETRY_ATTEMPTS) {
      logger.warn({ ...logCtx, attempt, errorKind: result.errorKind }, 'openai_sip_hangup_failed_will_retry');
      await new Promise<void>((resolve) => setTimeout(resolve, HANGUP_RETRY_DELAY_MS));
    } else {
      logger.error({ ...logCtx, attempt, errorKind: result.errorKind }, 'openai_sip_hangup_all_retries_exhausted');
    }
  }
}

function startDemoCallMaxDurationTimer(
  callId: string,
  telnyxCallControlId: string,
  apiKey: string,
  fetchImpl: typeof fetch,
): () => void {
  const existing = demoCallTimers.get(callId);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    demoCallTimers.delete(callId);
    logger.warn({ callId }, 'openai_sip_demo_max_duration_hangup');
    void callControlHangupWithRetry(telnyxCallControlId, { apiKey, fetchImpl }, { callId });
  }, DEMO_SIP_MAX_DURATION_MS);

  demoCallTimers.set(callId, { timer, telnyxCallControlId });
  logger.info({ callId, maxDurationMs: DEMO_SIP_MAX_DURATION_MS }, 'openai_sip_demo_max_duration_timer_started');

  return () => {
    const entry = demoCallTimers.get(callId);
    if (entry) {
      clearTimeout(entry.timer);
      demoCallTimers.delete(callId);
    }
  };
}

const incomingEventSchema = z.object({
  type: z.string(),
  data: z
    .object({
      call_id: z.string().min(1),
      sip_headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    })
    .optional(),
});

function asVoiceVertical(slug: string | null | undefined): VoicePromptVertical | undefined {
  const allowed: VoicePromptVertical[] = ['nail-salon', 'hair-salon', 'day-spa', 'med-spa', 'beauty-clinic'];
  return allowed.includes(slug as VoicePromptVertical) ? (slug as VoicePromptVertical) : undefined;
}

function sipDemoConfigToPromptInput(raw: NonNullable<SipDemoSessionEnrichment['demoConfig']>): DemoConfigInput {
  return {
    city: raw.city ?? undefined,
    primaryHours: raw.primaryHours ?? undefined,
    secondaryHours: raw.secondaryHours ?? undefined,
    staffNames: raw.staffNames,
    services: raw.services,
  };
}

function voiceVerticalFromShopVertical(v: ShopVertical | null | undefined): VoicePromptVertical | undefined {
  if (!v) return undefined;
  const map: Record<ShopVertical, VoicePromptVertical> = {
    nail_salon: 'nail-salon',
    hair_salon: 'hair-salon',
    day_spa: 'day-spa',
    med_spa: 'med-spa',
    beauty_clinic: 'beauty-clinic',
  };
  return map[v];
}

function liveAnsweringBillingBlockedLogFields(params: {
  shopId: string;
  access: Pick<
    ShopBillingAccess,
    'blockReason' | 'subscriptionStatus' | 'paymentMethodStatus' | 'providerSubscriptionId' | 'liveCallsEnabled'
  >;
  callId?: string | null;
}) {
  return {
    event: 'live_answering_billing_blocked',
    shop_id: params.shopId,
    user_id: null,
    billing_status: params.access.subscriptionStatus,
    payment_method_status: params.access.paymentMethodStatus,
    provider_subscription_id: params.access.providerSubscriptionId,
    go_live_state: params.access.liveCallsEnabled ? 'live_enabled' : 'live_disabled',
    reason: params.access.blockReason,
    call_control_id: null,
    call_session_id: params.callId ?? null,
  };
}

type OpenAiSipRoute = { kind: 'demo'; ctx: OpenAiSipDidContext } | { kind: 'shop'; shop: Shop; matchedRaw: string };

export function resolveSipCallerPhoneForTools(params: {
  routeKind: OpenAiSipRoute['kind'];
  normalizedFrom: string | null;
  callControlState: Pick<CallControlClientStatePayload, 'routeKind' | 'callerPhone'> | null;
}): string {
  if (params.routeKind === 'shop' && params.callControlState?.routeKind === 'shop') {
    const originalCallerPhone = params.callControlState.callerPhone?.trim();
    if (originalCallerPhone) return originalCallerPhone;
  }
  if (params.routeKind === 'shop') {
    if (params.normalizedFrom) {
      logger.warn(
        { normalizedFrom: params.normalizedFrom },
        'Warning: callControlState.callerPhone missing for shop call - callerPhone set to empty. Use call log recovery if available.',
      );
    }
    return '';
  }
  return params.normalizedFrom ?? '';
}

export async function resolveSipCallerPhoneForShopContext(params: {
  routeKind: OpenAiSipRoute['kind'];
  normalizedFrom: string | null;
  callControlState: Pick<CallControlClientStatePayload, 'routeKind' | 'callerPhone'> | null;
  shopId: string;
  rbCallId?: string | null;
  requestId?: string | null;
  callLogsRepository?: CallLogsRepository;
}): Promise<string> {
  const callerPhone = resolveSipCallerPhoneForTools({
    routeKind: params.routeKind,
    normalizedFrom: params.normalizedFrom,
    callControlState: params.callControlState,
  });
  if (callerPhone || params.routeKind !== 'shop' || !params.callLogsRepository) return callerPhone;

  const requestIds = Array.from(
    new Set(
      [params.rbCallId?.trim(), params.requestId?.trim()].filter((value): value is string => Boolean(value)),
    ),
  );
  for (const requestId of requestIds) {
    try {
      const callLog = await params.callLogsRepository.findTranscriptByShopAndRequestId({
        shopId: params.shopId,
        requestId,
      });
      const recoveredPhone = callLog?.callerPhone?.trim();
      if (recoveredPhone) {
        logger.info({ shopId: params.shopId, requestId }, 'recovered caller phone from call_log');
        return recoveredPhone;
      }
    } catch (err) {
      logger.warn(
        { err, shopId: params.shopId, requestId },
        'openai_sip_call_log_caller_phone_recovery_failed',
      );
    }
  }

  return '';
}

export async function resolveOpenAiSipShopRoomContext(params: {
  sipHeaders: Array<{ name: string; value: string }> | undefined;
  shop: Shop;
  callId: string;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
}): Promise<{
  requestId: string;
  roomName: string;
  parentTelnyxCallControlId: string | null;
  rbCallId: string;
  openAiLegCallControlId: string | null;
}> {
  const openAiLegCallControlId =
    extractSipHeader(params.sipHeaders, 'X-Telnyx-Call-Control-Id') ??
    extractSipHeader(params.sipHeaders, 'X-Call-Control-Id') ??
    null;
  const rawState =
    extractSipHeader(params.sipHeaders, 'X-Ringbooker-Call-Control-State') ??
    extractSipHeader(params.sipHeaders, 'X-Telnyx-Client-State');
  const decoded = decodeCallControlClientState(rawState);
  if (decoded && decoded.shopId === params.shop.id) {
    const safeReq = decoded.requestId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const rbCallId = decoded.rbCallId ?? decoded.requestId;
    return {
      requestId: decoded.requestId,
      roomName: `sip-${safeReq || 'session'}`,
      parentTelnyxCallControlId: decoded.telnyxCallControlId ?? null,
      rbCallId,
      openAiLegCallControlId,
    };
  }
  if (openAiLegCallControlId && params.voiceCallLegsRepository) {
    try {
      const leg = await params.voiceCallLegsRepository.findCallLegByCallControlId(openAiLegCallControlId);
      if (leg?.purpose === 'openai_sip_leg' && leg.shopId === params.shop.id) {
        const safeReq = leg.rbCallId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        logger.info(
          {
            shopId: params.shop.id,
            callId: params.callId,
            rbCallId: leg.rbCallId,
            openAiLegCallControlId,
            parentTelnyxCallControlId: leg.parentCallControlId,
          },
          'openai_sip_correlation_recovered_from_voice_call_leg',
        );
        return {
          requestId: leg.rbCallId,
          roomName: `sip-${safeReq || 'session'}`,
          parentTelnyxCallControlId: leg.parentCallControlId,
          rbCallId: leg.rbCallId,
          openAiLegCallControlId,
        };
      }
    } catch (err) {
      logger.warn(
        { err, shopId: params.shop.id, callId: params.callId, openAiLegCallControlId },
        'openai_sip_voice_call_leg_correlation_lookup_failed',
      );
    }
  }
  const safeCall = params.callId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  const fallbackReq = `sip-${params.callId}`;
  logger.warn(
    {
      shopId: params.shop.id,
      callId: params.callId,
      rbCallId: fallbackReq,
    },
    'openai_sip_missing_telnyx_client_state_live_handoff_limited',
  );
  return {
    requestId: fallbackReq,
    roomName: `sip-${safeCall || 'call'}`,
    parentTelnyxCallControlId: null,
    rbCallId: fallbackReq,
    openAiLegCallControlId,
  };
}

async function postOpenAiCallAction(params: {
  callId: string;
  pathSuffix: 'accept' | 'reject';
  apiKey: string;
  body?: Record<string, unknown>;
  fetchImpl: typeof fetch;
}): Promise<{ ok: boolean; status: number; text: string }> {
  const url = `https://api.openai.com/v1/realtime/calls/${encodeURIComponent(params.callId)}/${params.pathSuffix}`;
  const res = await params.fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: params.body ? JSON.stringify(params.body) : '{}',
  });
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, text: text.slice(0, 500) };
}

export async function handleOpenAiRealtimeSipWebhook(
  c: Context,
  deps: {
    providerEventsRepository: ProviderEventsRepository;
    demoSessionsRepository?: DemoSessionsRepository;
    shopsRepository?: ShopsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    shopRoutingRulesRepository?: ShopRoutingRulesRepository;
    jobsRepository?: JobsRepository;
    bookingsRepository?: BookingsRepository;
    callbacksRepository?: CallbacksRepository;
    telephonyService?: TelephonyService;
    callLogsRepository?: CallLogsRepository;
    voiceCallLegsRepository?: VoiceCallLegsRepository;
    commercialAccountsRepository?: CommercialAccountsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
    fetchImpl?: typeof fetch;
  },
): Promise<Response> {
  const env = getEnv();
  if (!env.OPENAI_SIP_WEBHOOK_ENABLED) {
    return c.body(null, 404);
  }

  const webhookSecret = env.OPENAI_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    logger.error({}, 'openai_sip_webhook_missing_secret');
    return c.json({ ok: false }, 503);
  }

  const rawBody = await c.req.text();
  const webhookId = c.req.header('webhook-id')?.trim() ?? '';
  const webhookTs = c.req.header('webhook-timestamp')?.trim() ?? '';
  const webhookSig = c.req.header('webhook-signature')?.trim() ?? '';

  if (!webhookId || !webhookTs || !webhookSig) {
    incrementMetric('webhook_requests_total', { provider: 'openai', outcome: 'missing_headers' });
    return c.json({ ok: false }, 400);
  }

  const verified = verifyOpenAiStandardWebhookV1({
    rawBody,
    webhookId,
    webhookTimestamp: webhookTs,
    signatureHeader: webhookSig,
    secret: webhookSecret,
    maxSkewSeconds: env.OPENAI_WEBHOOK_MAX_SKEW_SECONDS,
  });

  if (!verified) {
    incrementMetric('webhook_requests_total', { provider: 'openai', outcome: 'invalid_signature' });
    securityAudit({
      action: 'webhook_signature_invalid',
      actorType: 'provider',
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      provider: 'openai',
    });
    return c.json({ ok: false }, 401);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return c.json({ ok: false }, 400);
  }

  const parsed = incomingEventSchema.safeParse(parsedJson);
  if (!parsed.success || parsed.data.type !== 'realtime.call.incoming') {
    return c.json({ ok: true, ignored: true });
  }

  const data = parsed.data.data;
  if (!data?.call_id) return c.json({ ok: false }, 400);

  const callId = data.call_id;
  const processing = await deps.providerEventsRepository.tryMarkProcessing({
    provider: 'openai',
    providerEventId: webhookId,
    eventType: 'realtime.call.incoming',
    payload: { callId, state: 'processing' },
  });
  if (!processing.acquired) {
    return c.json({ ok: true, deduped: true });
  }

  const callLimited = await consumeRateLimit(RATE_LIMIT_POLICIES.openai_sip_per_call_id, `call:${callId}`);
  if (!callLimited.ok) {
    logger.warn({ callId }, 'openai_sip_call_id_rate_limited');
    return c.json(
      {
        ok: false,
        error: 'rate_limited',
        message: rateLimitUserMessage(callLimited.retryAfterSec),
        retryAfterSec: callLimited.retryAfterSec,
      },
      429,
    );
  }

  const sipTo = extractSipHeader(data.sip_headers, 'To');
  const sipFrom = extractSipHeader(data.sip_headers, 'From');
  const normalizedFrom = parseE164FromSipValue(sipFrom);
  const didMap = buildMergedOpenAiSipDemoDidMap({
    OPENAI_SIP_DEMO_DID_MAP_JSON: env.OPENAI_SIP_DEMO_DID_MAP_JSON,
    DEMO_PHONE_NAIL_SALON: env.DEMO_PHONE_NAIL_SALON,
    DEMO_PHONE_HAIR_SALON: env.DEMO_PHONE_HAIR_SALON,
    DEMO_PHONE_DAY_SPA: env.DEMO_PHONE_DAY_SPA,
    DEMO_PHONE_MED_SPA: env.DEMO_PHONE_MED_SPA,
    DEMO_PHONE_BEAUTY_CLINIC: env.DEMO_PHONE_BEAUTY_CLINIC,
    DEMO_PHONE_FALLBACK_VERTICAL: env.DEMO_PHONE_FALLBACK_VERTICAL,
  });
  const rawCallControlState =
    extractSipHeader(data.sip_headers, 'X-Ringbooker-Call-Control-State') ??
    extractSipHeader(data.sip_headers, 'X-Telnyx-Client-State');
  const ccDecoded = decodeCallControlClientState(rawCallControlState);

  /** Telnyx Call Control → SIP bridge: prefer encoded client_state so demo lines never fall through to shop DB. */
  let route: OpenAiSipRoute | null = null;
  if (ccDecoded?.routeKind === 'demo' && ccDecoded.demoVertical) {
    const v = asVoiceVertical(ccDecoded.demoVertical);
    if (v) {
      const inboundKey = ccDecoded.inboundDid ? normalizeInboundE164(ccDecoded.inboundDid) : null;
      const fromMap = inboundKey ? didMap.get(inboundKey) : undefined;
      const demoCtxForRoute: OpenAiSipDidContext =
        fromMap ??
        ({
          did: (ccDecoded.inboundDid && ccDecoded.inboundDid.trim()) || inboundKey || '+0',
          mode: 'demo',
          vertical: v,
          defaultShopName: SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL[v].defaultShopName,
          businessType: SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL[v].businessType,
        } as OpenAiSipDidContext);
      route = { kind: 'demo', ctx: demoCtxForRoute };
      logger.info(
        {
          callId,
          route_kind: 'demo',
          demo_vertical: v,
          demo_prompt_selected: true,
          demoNumberMatched: true,
          shop_lookup_skipped_for_demo: true,
        },
        'demo_prompt_selected',
      );
    }
  }
  if (!route && ccDecoded?.shopId && ccDecoded.routeKind !== 'demo' && deps.shopsRepository) {
    const shop = await deps.shopsRepository.findById(ccDecoded.shopId).catch((err) => {
      logger.warn({ err, callId, shopId: ccDecoded.shopId }, 'openai_sip_client_state_shop_lookup_failed');
      return null;
    });
    if (shop) {
      route = { kind: 'shop', shop, matchedRaw: ccDecoded.inboundDid ?? sipTo ?? ccDecoded.shopId };
      logger.info(
        {
          callId,
          shopId: shop.id,
          route_kind: 'shop',
          inboundDid: ccDecoded.inboundDid ?? null,
        },
        'openai_sip_routed_via_call_control_client_state',
      );
    }
  }

  /** TeXML pilots often set `OPENAI_SIP_URI` but omit `OPENAI_REALTIME_PROJECT_ID` — derive proj id from URI. */
  const openAiProjectIdForDid =
    env.OPENAI_REALTIME_PROJECT_ID?.trim() || parseOpenAiProjectUserFromSipTo(env.OPENAI_SIP_URI ?? null) || null;
  const didCtx = resolveOpenAiSipDemoDidFromHeaders({
    sipHeaders: data.sip_headers,
    map: didMap,
    sipToValue: sipTo,
    openAiRealtimeProjectId: openAiProjectIdForDid,
  });

  if (!route && didCtx) route = { kind: 'demo', ctx: didCtx };
  if (!route && deps.demoSessionsRepository && normalizedFrom) {
    const enrichment = await deps.demoSessionsRepository.findLatestSipDemoContext({ callerPhone: normalizedFrom }).catch((err) => {
      logger.warn({ err, callId, callerPhone: normalizedFrom }, 'openai_sip_demo_context_route_lookup_failed');
      return null;
    });
    const v = asVoiceVertical(enrichment?.verticalSlug);
    if (v) {
      route = {
        kind: 'demo',
        ctx: {
          did: normalizedFrom,
          mode: 'demo',
          vertical: v,
          defaultShopName: enrichment?.shopName ?? SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL[v].defaultShopName,
          businessType: SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL[v].businessType,
        },
      };
      logger.info(
        {
          callId,
          route_kind: 'demo',
          demo_vertical: v,
          demo_prompt_selected: true,
          routed_by: 'caller_demo_session',
        },
        'demo_prompt_selected',
      );
    }
  }
  if (!route && deps.shopsRepository) {
    for (const raw of collectOpenAiSipDidCandidates(data.sip_headers)) {
      const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, raw);
      if (shop) {
        route = { kind: 'shop', shop, matchedRaw: raw };
        logger.info({ callId, shopId: shop.id }, 'openai_sip_routed_via_shop_db');
        break;
      }
    }
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const apiKey = env.OPENAI_API_KEY?.trim();

  async function rejectCall(statusCode: number, reason: string) {
    await postOpenAiCallAction({
      callId,
      pathSuffix: 'reject',
      apiKey: apiKey ?? '',
      body: { status_code: statusCode },
      fetchImpl,
    });
    logger.info({ callId, reason, sipTo, sipFrom }, 'openai_sip_call_rejected');
    incrementMetric('openai_sip_call_outcomes_total', { outcome: 'reject', reason });
  }

  if (!route) {
    if (sipTo?.toLowerCase().includes('sip.api.openai.com')) {
      logger.warn(
        {
          mapEntries: didMap.size,
          projectIdForResolve: openAiProjectIdForDid ?? null,
          sipToParsedUser: parseOpenAiProjectUserFromSipTo(sipTo),
        },
        'openai_sip_unknown_did_texml_debug',
      );
    }
    if (apiKey) {
      await rejectCall(603, 'unknown_did');
    }
    await deps.providerEventsRepository.markProcessed({
      provider: 'openai',
      providerEventId: webhookId,
      eventType: 'realtime.call.incoming',
      payload: { callId, outcome: 'unknown_did' },
    });
    return c.json({ ok: true });
  }

  let shopCallLimits: { softWarningAfterSeconds: number; maxCallDurationSeconds: number } | null = null;

  if (
    route.kind === 'shop' &&
    deps.shopsRepository &&
    deps.billingSubscriptionsRepository &&
    deps.shopAccessStatesRepository
  ) {
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
      },
      { shopId: route.shop.id },
    );
    if (!access.canReceiveLiveCalls) {
      logger.warn(
        liveAnsweringBillingBlockedLogFields({
          shopId: route.shop.id,
          access,
          callId,
        }),
        'live_answering_billing_blocked',
      );
      if (apiKey) await rejectCall(603, access.blockReason);
      await deps.providerEventsRepository.markProcessed({
        provider: 'openai',
        providerEventId: webhookId,
        eventType: 'realtime.call.incoming',
        payload: { callId, shopId: route.shop.id, outcome: 'billing_blocked', reason: access.blockReason },
      });
      return c.json({ ok: true, blocked: true, reason: access.blockReason });
    }

    if (deps.callLogsRepository) {
      const commercialAccount = deps.commercialAccountsRepository
        ? await deps.commercialAccountsRepository.findByShopId(route.shop.id).catch(() => null)
        : null;
      const gate = await checkLiveCallUsageGate(
        {
          callLogsRepository: deps.callLogsRepository,
          shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        },
        { shop: route.shop, commercialAccount },
      );
      if (!gate.ok) {
        if (apiKey) await rejectCall(gate.reason === 'concurrency_limit_reached' ? 486 : 603, gate.reason);
        await deps.providerEventsRepository.markProcessed({
          provider: 'openai',
          providerEventId: webhookId,
          eventType: 'realtime.call.incoming',
          payload: { callId, shopId: route.shop.id, outcome: gate.reason === 'concurrency_limit_reached' ? 'concurrency_blocked' : 'usage_blocked', reason: gate.reason },
        });
        return c.json({ ok: true, blocked: true, reason: gate.reason });
      }
      const usage = gate.usage;
      shopCallLimits = usage.limits;
      const callControlAlreadyOwnsSlot = Boolean(ccDecoded?.shopId === route.shop.id && ccDecoded.telnyxCallControlId);
      if (deps.shopActiveCallSessionsRepository && !callControlAlreadyOwnsSlot) {
        const now = new Date();
        const acquired = await deps.shopActiveCallSessionsRepository.acquireSlot({
          shopId: route.shop.id,
          provider: 'openai_sip',
          callSessionId: callId,
          limit: usage.maxConcurrentLiveCalls,
          startedAt: now,
          expiresAt: new Date(now.getTime() + usage.limits.maxCallDurationSeconds * 1000),
        });
        if (!acquired.acquired) {
          if (apiKey) await rejectCall(486, 'concurrency_limit_reached');
          await deps.providerEventsRepository.markProcessed({
            provider: 'openai',
            providerEventId: webhookId,
            eventType: 'realtime.call.incoming',
            payload: { callId, shopId: route.shop.id, outcome: 'concurrency_blocked' },
          });
          return c.json({ ok: true, blocked: true, reason: 'concurrency_limit_reached' });
        }
      }
    }
  }

  if (normalizedFrom) {
    const fromLim = await consumeRateLimit(
      RATE_LIMIT_POLICIES.openai_sip_per_caller,
      `sip_caller:${normalizedFrom}`,
    );
    if (!fromLim.ok) {
      if (apiKey) await rejectCall(486, 'caller_rate_limited');
      await deps.providerEventsRepository.markProcessed({
        provider: 'openai',
        providerEventId: webhookId,
        eventType: 'realtime.call.incoming',
        payload: { callId, outcome: 'caller_rate_limited' },
      });
      return c.json({ ok: true });
    }
  }

  const rateLimitDid =
    route.kind === 'demo'
      ? route.ctx.did
      : normalizeInboundE164(route.matchedRaw) ?? route.shop.phone_number;
  const didLim = await consumeRateLimit(RATE_LIMIT_POLICIES.openai_sip_per_did, `did:${rateLimitDid}`);
  if (!didLim.ok) {
    if (apiKey) await rejectCall(486, 'did_rate_limited');
    await deps.providerEventsRepository.markProcessed({
      provider: 'openai',
      providerEventId: webhookId,
      eventType: 'realtime.call.incoming',
      payload: { callId, outcome: 'did_rate_limited' },
    });
    return c.json({ ok: true });
  }

  let instructions: string;
  let demoVertical: VoicePromptVertical | undefined;
  let demoInitialResponseInstructions: string | null = null;
  const shopRoomContext =
    route.kind === 'shop'
      ? await resolveOpenAiSipShopRoomContext({
          sipHeaders: data.sip_headers,
          shop: route.shop,
          callId,
          voiceCallLegsRepository: deps.voiceCallLegsRepository,
        })
      : null;
  const callerPhoneForPrompt =
    route.kind === 'shop'
      ? (await resolveSipCallerPhoneForShopContext({
          routeKind: route.kind,
          normalizedFrom,
          callControlState: ccDecoded,
          shopId: route.shop.id,
          rbCallId: shopRoomContext?.rbCallId,
          requestId: shopRoomContext?.requestId,
          callLogsRepository: deps.callLogsRepository,
        })) || null
      : null;

  if (route.kind === 'demo') {
    let enrichment: SipDemoSessionEnrichment | null = null;
    if (deps.demoSessionsRepository && normalizedFrom) {
      try {
        enrichment = await deps.demoSessionsRepository.findLatestSipDemoContext({
          callerPhone: normalizedFrom,
        });
      } catch (err) {
        logger.warn({ err, callId }, 'openai_sip_demo_context_lookup_failed');
      }
    }

    const demoCtx = route.ctx;
    const shopName = enrichment?.shopName ?? demoCtx.defaultShopName;
    const businessType = enrichment?.verticalSlug
      ? enrichment.verticalSlug.replace(/-/g, ' ')
      : demoCtx.businessType;
    demoVertical = asVoiceVertical(enrichment?.verticalSlug ?? demoCtx.vertical) ?? demoCtx.vertical;

    const demoPromptInput = {
      shopName,
      businessType,
      demoVertical,
      staffName: enrichment?.demoConfig?.staffNames?.[0],
      notes: enrichment?.notes ?? undefined,
      demoConfig: enrichment?.demoConfig ? sipDemoConfigToPromptInput(enrichment.demoConfig) : undefined,
      demoChannel: 'inbound_sip' as const,
      voiceCallType: 'inbound_booking' as const,
    };
    instructions = buildPublicDemoSystemPrompt(demoPromptInput);
    const scriptedWelcomeLine = buildPublicDemoScriptedWelcomeLine(demoPromptInput);
    demoInitialResponseInstructions = `Speak first now. Say this opening line exactly once, naturally, then stop and listen for the caller: ${scriptedWelcomeLine}`;
  } else {
    demoVertical = voiceVerticalFromShopVertical(route.shop.vertical);
    const routingRules = deps.shopRoutingRulesRepository
      ? await deps.shopRoutingRulesRepository.listByShopId(route.shop.id, { activeOnly: true }).catch((error) => {
          logger.warn({ err: error, shopId: route.shop.id }, 'openai_sip_routing_rules_lookup_failed');
          return [];
        })
      : [];
    instructions = buildSystemPrompt({
      shop: route.shop,
      customer: null,
      mode: 'inbound',
      vertical: demoVertical,
      routingRules,
      callerPhone: callerPhoneForPrompt,
    });
  }

  const acceptEnabled = env.OPENAI_SIP_ACCEPT_ENABLED && !!apiKey;
  if (!acceptEnabled) {
    if (apiKey) {
      await rejectCall(603, 'accept_disabled_or_missing_key');
    }
    await deps.providerEventsRepository.markProcessed({
      provider: 'openai',
      providerEventId: webhookId,
      eventType: 'realtime.call.incoming',
      payload: { callId, outcome: 'accept_disabled' },
    });
    return c.json({ ok: true });
  }

  const model = env.OPENAI_REALTIME_MODEL?.trim() || env.AGENT_VOICE_MODEL?.trim() || 'gpt-realtime';
  const voiceOverride = env.OPENAI_REALTIME_SIP_VOICE?.trim();
  const voice = voiceOverride || openAiRealtimeVoiceForVertical(demoVertical, 'alloy');

  if (route.kind === 'shop' && shopRoomContext) {
    logger.info(
      {
        callId,
        shopId: route.shop.id,
        voiceTransport: getResolvedVoiceTransport(),
        rbCallId: shopRoomContext.rbCallId,
        parentTelnyxCallControlId: shopRoomContext.parentTelnyxCallControlId,
      },
      'openai_sip_shop_correlation',
    );
  }

  const shopSidebandDepsReady =
    route.kind === 'shop' &&
    !!deps.shopsRepository &&
    !!deps.jobsRepository &&
    !!deps.bookingsRepository &&
    !!deps.callbacksRepository &&
    !!deps.telephonyService;

  const shopToolsAndSideband =
    Boolean(env.OPENAI_SIP_SIDEBAND_ENABLED) && route.kind === 'shop' && shopSidebandDepsReady;
  const shopBridgeGatedGreeting =
    shopToolsAndSideband &&
    !!shopRoomContext?.parentTelnyxCallControlId &&
    !!shopRoomContext?.openAiLegCallControlId;

  if (route.kind === 'shop' && env.OPENAI_SIP_SIDEBAND_ENABLED && !shopSidebandDepsReady) {
    logger.warn({ callId }, 'openai_sip_shop_tools_missing_dependencies');
  }
  if (route.kind === 'shop' && !shopToolsAndSideband) {
    logger.warn(
      {
        callId,
        sidebandEnabled: Boolean(env.OPENAI_SIP_SIDEBAND_ENABLED),
        shopSidebandDepsReady,
      },
      'openai_sip_end_call_tool_missing_for_shop_prompt',
    );
  }

  const includeDemoNoopTool = Boolean(env.OPENAI_SIP_SIDEBAND_ENABLED) && route.kind === 'demo';
  const acceptBody = buildOpenAiSipAcceptBody({
    instructions,
    model,
    voice,
    includeDemoNoopTool,
    sipPilotSuppressVadCreateResponse: includeDemoNoopTool || shopBridgeGatedGreeting,
    shopBusinessTools: shopToolsAndSideband
      ? getSipShopToolsForOpenAiAccept(route.kind === 'shop' ? route.shop : null)
      : undefined,
    toolChoice: shopToolsAndSideband ? 'auto' : undefined,
    transcriptionLanguage:
      route.kind === 'shop'
        ? resolveProductionRealtimeTranscriptionDefaultLanguage(route.shop.plan, route.shop.languages)
        : 'en',
  });
  logger.info(
    {
      callSessionId: shopRoomContext?.rbCallId ?? callId,
      providerCallId: callId,
      model,
      transcriptionModel: acceptBody.audio?.input?.transcription?.model ?? null,
      languageHint: acceptBody.audio?.input?.transcription?.language ?? null,
      vadType: (acceptBody.audio?.input?.turn_detection as { type?: unknown } | null | undefined)?.type ?? null,
      vadSettings: acceptBody.audio?.input?.turn_detection ?? null,
      eventType: 'realtime_session_accept',
      toolChoice: acceptBody.tool_choice ?? null,
      toolCount: acceptBody.tools?.length ?? 0,
    },
    'openai_sip_realtime_session_config',
  );

  const acceptRes = await postOpenAiCallAction({
    callId,
    pathSuffix: 'accept',
    apiKey: apiKey!,
    body: acceptBody as unknown as Record<string, unknown>,
    fetchImpl,
  });

  if (!acceptRes.ok) {
    logger.error(
      { callId, status: acceptRes.status, body: acceptRes.text },
      'openai_sip_accept_failed',
    );
    incrementMetric('openai_sip_call_outcomes_total', { outcome: 'accept_http_error' });
    // Accept failed → the call is still pending at OpenAI. Reject it so the caller drops
    // immediately instead of hanging on dead air until a provider-side timeout fires.
    if (apiKey) {
      await rejectCall(503, 'accept_failed').catch((err) => {
        logger.warn({ err, callId }, 'openai_sip_post_accept_failure_reject_failed');
      });
    }
    await deps.providerEventsRepository.markProcessed({
      provider: 'openai',
      providerEventId: webhookId,
      eventType: 'realtime.call.incoming',
      payload: {
        callId,
        route: route.kind,
        shopId: route.kind === 'shop' ? route.shop.id : undefined,
        outcome: 'accept_failed',
        acceptStatus: acceptRes.status,
      },
    });
    return c.json({ ok: true, accepted: false });
  } else {
    logger.info({ callId, model }, 'openai_sip_call_accepted');
    incrementMetric('openai_sip_call_outcomes_total', { outcome: 'accepted' });
    // Path B demo duration cap: start server-side 5-minute timer regardless of sideband.
    // Only demo calls reach this branch (shop calls are handled above with billing-plan limits).
    if (route.kind === 'demo') {
      // Accumulate the sideband transcript and persist it onto the demo_call_runs row on call end,
      // so Admin → Demos can show the phone-demo transcript. Only when the call has a demo requestId.
      const demoTranscriptRequestId = ccDecoded?.requestId ?? null;
      const demoTranscriptTurns: Array<{ role: 'caller' | 'assistant'; text: string }> = [];
      const persistDemoTranscript = () => {
        if (!demoTranscriptRequestId || !deps.demoSessionsRepository || demoTranscriptTurns.length === 0) return;
        void deps.demoSessionsRepository
          .saveDemoCallTranscriptByRequestId(demoTranscriptRequestId, demoTranscriptTurns.slice())
          .catch((err: unknown) => logger.warn({ err, callId }, 'openai_sip_demo_transcript_persist_failed'));
      };
      const demoOnTranscript = (speaker: 'caller' | 'assistant', text: string) => {
        demoTranscriptTurns.push({ role: speaker, text });
      };

      const telnyxCcId = extractSipHeader(data.sip_headers, 'X-Telnyx-Call-Control-Id') ?? null;
      if (telnyxCcId && env.TELNYX_API_KEY) {
        const demoTelnyxKey = env.TELNYX_API_KEY;
        const clearDemoTimer = startDemoCallMaxDurationTimer(callId, telnyxCcId, demoTelnyxKey, fetchImpl);
        let demoHangupInitiated = false;
        // clearDemoTimer is passed to sideband so WS close (call ended) cancels it immediately.
        if (env.OPENAI_SIP_SIDEBAND_ENABLED) {
          const acceptedAtMs = Date.now();
          startOpenAiRealtimeSipSideband({
            variant: 'demo',
            callId,
            apiKey: apiKey!,
            enableToolLoop: true,
            acceptedAtMs,
            initialResponseInstructions: demoInitialResponseInstructions,
            onTranscript: demoOnTranscript,
            onEnded: () => {
              clearDemoTimer();
              persistDemoTranscript();
            },
            onEndCall: () => {
              if (demoHangupInitiated) return;
              demoHangupInitiated = true;
              logger.info({ callId }, 'openai_sip_demo_end_call_tool_hangup');
              void callControlHangupWithRetry(telnyxCcId, { apiKey: demoTelnyxKey, fetchImpl }, { callId });
            },
          });
        }
      } else {
        logger.warn(
          { callId, hasCcId: Boolean(telnyxCcId), hasTelnyxKey: Boolean(env.TELNYX_API_KEY) },
          'openai_sip_demo_max_duration_timer_skipped',
        );
        if (env.OPENAI_SIP_SIDEBAND_ENABLED) {
          const acceptedAtMs = Date.now();

          // 30-second server-side cleanup timer: fired when end_call is invoked but
          // there is no Telnyx CC ID to issue a programmatic hangup. Guarantees the
          // transcript is persisted even if the WS never closes naturally.
          let demoNoHangupEndCallFired = false;
          let demoNoHangupFallbackTimer: ReturnType<typeof setTimeout> | null = null;
          const clearNoHangupFallbackTimer = () => {
            if (demoNoHangupFallbackTimer) {
              clearTimeout(demoNoHangupFallbackTimer);
              demoNoHangupFallbackTimer = null;
            }
          };

          startOpenAiRealtimeSipSideband({
            variant: 'demo',
            callId,
            apiKey: apiKey!,
            enableToolLoop: true,
            acceptedAtMs,
            initialResponseInstructions: demoInitialResponseInstructions,
            onTranscript: demoOnTranscript,
            onEnded: () => {
              // Call ended normally — cancel the fallback timer and persist transcript.
              clearNoHangupFallbackTimer();
              persistDemoTranscript();
            },
            onEndCall: () => {
              if (demoNoHangupEndCallFired) return;
              demoNoHangupEndCallFired = true;
              logger.warn({ callId }, 'openai_sip_demo_end_call_no_call_control_id_no_hangup');
              logger.info({ callId }, 'openai_sip_demo_end_call_no_ccid_fallback_started');
              // No Telnyx CC ID — cannot issue a programmatic hangup. Start a 30-second
              // timer so the transcript is persisted even if the caller never hangs up
              // and the WS doesn't close within a reasonable window.
              demoNoHangupFallbackTimer = setTimeout(() => {
                demoNoHangupFallbackTimer = null;
                logger.warn({ callId }, 'openai_sip_demo_end_call_no_ccid_fallback_fired');
                persistDemoTranscript();
              }, DEMO_END_CALL_NO_CCID_FALLBACK_MS);
            },
          });
        }
      }
    }

    if (env.OPENAI_SIP_SIDEBAND_ENABLED) {
      const acceptedAtMs = Date.now();
      if (route.kind === 'demo') {
        // already handled above — sideband started inside demo branch
        void 0;
      } else if (shopToolsAndSideband && shopRoomContext && route.kind === 'shop') {
        const executorDeps: SipToolExecutorDeps = {
          shopsRepository: deps.shopsRepository!,
          jobsRepository: deps.jobsRepository!,
          bookingsRepository: deps.bookingsRepository!,
          callbacksRepository: deps.callbacksRepository!,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
          telephonyService: deps.telephonyService!,
        };
        const callerPhone = callerPhoneForPrompt ?? '';
        const toolCtx = createSipAgentToolContext({
          shop: route.shop,
          callerPhone,
          requestId: shopRoomContext.requestId,
          roomName: shopRoomContext.roomName,
          deps: executorDeps,
          parentTelnyxCallControlId: shopRoomContext.parentTelnyxCallControlId,
          rbCallId: shopRoomContext.rbCallId,
          openAiLegCallControlId: shopRoomContext.openAiLegCallControlId,
        });
        const shop = route.shop;
        const sidebandCtx = shopRoomContext;
        const parentCcId = sidebandCtx.parentTelnyxCallControlId;
        const telnyxKey = env.TELNYX_API_KEY ?? '';

        const softLimitMs = (shopCallLimits?.softWarningAfterSeconds ?? 480) * 1000;
        const hardLimitMs = (shopCallLimits?.maxCallDurationSeconds ?? 600) * 1000;

        /** One-shot guard: prevent double-trigger if WS emits close multiple times. */
        let fallbackTriggered = false;
        /** One-shot guard: prevents double-hangup when caller hangs up during the end_call delay. */
        let hangupInitiated = false;
        const effectiveRuntimeConfig = resolveEffectiveRuntimeConfig(shop);

        function buildShopSidebandCore() {
          return {
            variant: 'shop' as const,
            callId,
            apiKey: apiKey!,
            acceptedAtMs,
            initialResponseInstructions: buildProductionInitialGreetingInstructions(effectiveRuntimeConfig.aiWelcomeMessage),
            initialResponseBridgeGate:
              parentCcId && sidebandCtx.openAiLegCallControlId
                ? {
                    parentCallControlId: parentCcId,
                    openaiLegCallControlId: sidebandCtx.openAiLegCallControlId,
                    rbCallId: sidebandCtx.rbCallId,
                    shopId: shop.id,
                  }
                : undefined,
            executeBusinessTool: (name: string, argsJson: string) => {
              let parsed: unknown = {};
              try {
                parsed = argsJson.trim() ? JSON.parse(argsJson) : {};
              } catch {
                parsed = {};
              }
              logger.info(
                {
                  callSessionId: sidebandCtx.rbCallId ?? sidebandCtx.requestId,
                  providerCallId: callId,
                  shopId: shop.id,
                  eventType: 'tool_context',
                  proposedTool: name,
                  backendDecision: 'execute_business_tool',
                  bookingDraft: summarizeBookingDraftForLog(toolCtx.bookingDraft),
                  reason: 'booking_draft_attached_to_tool_call',
                },
                'openai_sip_tool_context',
              );
              return executeSipShopToolCall(toolCtx, name, parsed);
            },
            onTranscript: (speaker: 'caller' | 'assistant', text: string) => {
              if (speaker === 'caller') {
                const draftUpdate = updateSipBookingDraftFromTranscript(toolCtx, text);
                if (draftUpdate) {
                  const bookingDraftLog = draftUpdate.bookingDraft;
                  logger.info(
                    {
                      callSessionId: sidebandCtx.rbCallId ?? sidebandCtx.requestId,
                      providerCallId: callId,
                      shopId: shop.id,
                      eventType: 'booking_draft_updated',
                      rawUserTranscript: text,
                      normalizedUserText: text.replace(/\s+/g, ' ').trim(),
                      extractedSlots: bookingDraftLog,
                      bookingDraft: bookingDraftLog,
                      confidence:
                        bookingDraftLog && typeof bookingDraftLog === 'object'
                          ? (bookingDraftLog as { confidence?: unknown }).confidence
                          : undefined,
                      reason: draftUpdate.reasonCodes.length > 0 ? draftUpdate.reasonCodes : ['caller_transcript_processed'],
                    },
                    'openai_sip_booking_draft_updated',
                  );
                }
              }

              if (deps.callLogsRepository) {
                void deps.callLogsRepository.appendTranscriptByRequestId({
                  shopId: shop.id,
                  requestId: sidebandCtx.requestId,
                  speaker,
                  text,
                  occurredAt: new Date(),
                }).catch((err: unknown) => {
                  logger.warn({ err, callId, shopId: shop.id }, 'openai_sip_transcript_append_failed');
                });
              }
            },
            softLimitMs,
            softLimitInstruction: PROD_CALL_SOFT_LIMIT_INSTRUCTION,
            hardLimitMs,
            onCallerTranscriptPrePopulate: (transcript: string) => {
              return prePopulateFromTranscript(toolCtx, transcript);
            },
            onEndCall: () => {
              if (hangupInitiated) return;
              hangupInitiated = true;
              logger.info({ callId, shopId: shop.id }, 'openai_sip_end_call_tool_hangup');
              setTimeout(() => {
                if (parentCcId && telnyxKey) {
                  void callControlHangupWithRetry(parentCcId, { apiKey: telnyxKey, fetchImpl }, { callId, shopId: shop.id });
                } else {
                  logger.warn(
                    {
                      callId,
                      shopId: shop.id,
                      hasParentCallControlId: Boolean(parentCcId),
                      hasTelnyxKey: Boolean(telnyxKey),
                    },
                    'openai_sip_end_call_hangup_skipped_missing_call_control',
                  );
                }
              }, END_CALL_TOOL_HANGUP_DELAY_MS);
            },
          };
        }

        async function doFinalFallback() {
          const handoffAvailability = isHandoffAvailable(shop);
          const fallbackHandoffPhone = shop.handoff_phone?.trim();
          const canTransfer =
            shop.allow_transfers &&
            handoffAvailability.available &&
            !!fallbackHandoffPhone &&
            !!parentCcId &&
            !!telnyxKey;

          if (canTransfer) {
            await callControlSpeak(parentCcId!, {
              payload: FALLBACK_TRANSFER_MESSAGE,
              voice: 'Polly.Joanna',
              language: 'en-US',
              payload_type: 'text',
            }, { apiKey: telnyxKey, fetchImpl }).catch(() => {});

            await new Promise((resolve) => setTimeout(resolve, FALLBACK_TRANSFER_ANNOUNCE_DELAY_MS));

            const destination = evaluateOwnerHandoffDestination({ shop, ownerPhone: fallbackHandoffPhone! });
            if (destination.ok && deps.telephonyService) {
              await deps.telephonyService.requestHumanHandoffViaCallControl({
                shopId: shop.id,
                parentCallControlId: parentCcId!,
                openAiLegCallControlId: sidebandCtx.openAiLegCallControlId ?? undefined,
                ownerPhone: destination.e164,
                inboundDid: shop.phone_number,
                rbCallId: sidebandCtx.rbCallId,
                reason: 'ai_service_interruption',
                urgency: 'high',
                summary: 'AI service was interrupted mid-call. Customer needs assistance.',
                callerPhone,
                idempotencyKey: `fallback_handoff:${callId}`,
              }).catch(() => {
                void callControlHangupWithRetry(parentCcId!, { apiKey: telnyxKey!, fetchImpl }, { callId, shopId: shop.id });
              });
            } else {
              void callControlHangupWithRetry(parentCcId!, { apiKey: telnyxKey!, fetchImpl }, { callId, shopId: shop.id });
            }
          } else {
            if (shop.allow_transfers && handoffAvailability.available && !fallbackHandoffPhone) {
              logger.warn({ callId, shopId: shop.id }, 'openai_sip_fallback_handoff_phone_not_configured');
            }
            if (parentCcId && telnyxKey) {
              await callControlSpeak(parentCcId, {
                payload: FALLBACK_ISSUE_MESSAGE,
                voice: 'Polly.Joanna',
                language: 'en-US',
                payload_type: 'text',
              }, { apiKey: telnyxKey, fetchImpl }).catch(() => {});
            }
            if (deps.jobsRepository) {
              void deps.jobsRepository.enqueue({
                shopId: shop.id,
                type: 'technical_failure_callback',
                payload: { shopId: shop.id, callerPhone, callId },
                runAt: new Date(),
                idempotencyKey: `tech_failure_callback:${callId}`,
              }).catch(() => {});
            }
            if (parentCcId && telnyxKey) {
              await new Promise((resolve) => setTimeout(resolve, HARD_LIMIT_HANGUP_DELAY_MS));
              void callControlHangupWithRetry(parentCcId, { apiKey: telnyxKey, fetchImpl }, { callId, shopId: shop.id });
            }
          }
        }

        async function handleWsDrop(closeCode: number) {
          if (fallbackTriggered) return;
          fallbackTriggered = true;

          logger.error(
            { callId, shopId: shop.id, callerPhone, wsCloseCode: closeCode, reconnectAttempted: true },
            'openai_sip_shop_ws_unexpected_drop',
          );

          if (deps.jobsRepository) {
            void deps.jobsRepository.enqueue({
              shopId: shop.id,
              type: 'ai_failure_owner_alert',
              payload: { shopId: shop.id, callerPhone, callId, wsCloseCode: closeCode },
              runAt: new Date(),
              idempotencyKey: `ai_failure_alert:${callId}`,
            }).catch(() => {});
          }

          if (parentCcId && telnyxKey) {
            await callControlSpeak(parentCcId, {
              payload: FALLBACK_HOLD_MESSAGE,
              voice: 'Polly.Joanna',
              language: 'en-US',
              payload_type: 'text',
            }, { apiKey: telnyxKey, fetchImpl }).catch(() => {});
          }

          await new Promise((resolve) => setTimeout(resolve, WS_FALLBACK_HOLD_MS));

          let reconnected = false;
          startOpenAiRealtimeSipSideband({
            ...buildShopSidebandCore(),
            onConnected: () => { reconnected = true; },
            onWsDropped: undefined,
          });

          await new Promise((resolve) => setTimeout(resolve, WS_RECONNECT_TIMEOUT_MS));

          if (reconnected) {
            logger.info({ callId, shopId: shop.id }, 'openai_sip_ws_reconnect_succeeded');
            fallbackTriggered = false;
            return;
          }

          logger.warn({ callId, shopId: shop.id }, 'openai_sip_ws_reconnect_failed_doing_final_fallback');
          await doFinalFallback();
        }

        startOpenAiRealtimeSipSideband({
          ...buildShopSidebandCore(),
          onConnected: () => {
            fallbackTriggered = false;
            if (parentCcId && sidebandCtx.openAiLegCallControlId) {
              markSidebandReadyForAnswer({
                parentCallControlId: parentCcId,
                openaiLegCallControlId: sidebandCtx.openAiLegCallControlId,
                rbCallId: sidebandCtx.rbCallId,
                shopId: shop.id,
              });
            }
          },
          onWsDropped: (closeCode) => { void handleWsDrop(closeCode); },
          onHardLimit: () => {
            hangupInitiated = true; // prevent stale onEndCall from double-hanging
            logger.warn({ callId, shopId: shop.id, hardLimitMs }, 'openai_sip_shop_hard_limit_hit');
            if (deps.jobsRepository) {
              void deps.jobsRepository.enqueue({
                shopId: shop.id,
                type: 'max_duration_alert',
                payload: { shopId: shop.id, callId, reason: 'max_duration_exceeded' },
                runAt: new Date(),
                idempotencyKey: `max_duration_alert:${callId}`,
              }).catch(() => {});
            }
            if (parentCcId && telnyxKey) {
              void callControlSpeak(parentCcId, {
                payload: PROD_CALL_HARD_LIMIT_MESSAGE,
                voice: 'Polly.Joanna',
                language: 'en-US',
                payload_type: 'text',
              }, { apiKey: telnyxKey, fetchImpl })
                .then(() => new Promise((resolve) => setTimeout(resolve, HARD_LIMIT_HANGUP_DELAY_MS)))
                .then(() => callControlHangupWithRetry(parentCcId!, { apiKey: telnyxKey!, fetchImpl }, { callId, shopId: shop.id }))
                .catch(() => { void callControlHangupWithRetry(parentCcId!, { apiKey: telnyxKey!, fetchImpl }, { callId, shopId: shop.id }); });
            } else {
              void callControlHangupWithRetry(shopRoomContext.openAiLegCallControlId ?? callId, { apiKey: telnyxKey!, fetchImpl }, { callId, shopId: shop.id });
            }
          },
        });
      }
    }
  }

  await deps.providerEventsRepository.markProcessed({
    provider: 'openai',
    providerEventId: webhookId,
    eventType: 'realtime.call.incoming',
    payload: {
      callId,
      route: route.kind,
      shopId: route.kind === 'shop' ? route.shop.id : undefined,
      outcome: acceptRes.ok ? 'accepted' : 'accept_failed',
      acceptStatus: acceptRes.status,
    },
  });

  return c.json({ ok: true });
}
