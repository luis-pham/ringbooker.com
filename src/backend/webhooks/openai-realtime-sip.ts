import type { Context } from 'hono';
import { z } from 'zod';

import { type VoicePromptVertical, openAiRealtimeVoiceForVertical } from '@/src/agent/prompts';
import { getSipShopToolsForOpenAiAccept } from '@/src/agent/sip/sip-tool-definitions';
import {
  createSipAgentToolContext,
  executeSipShopToolCall,
  type SipToolExecutorDeps,
} from '@/src/agent/sip/sip-tool-executor';
import { getEnv } from '@/src/backend/config/env';
import { getResolvedVoiceTransport } from '@/src/backend/config/voice-transport';
import type { Shop, ShopVertical } from '@/src/backend/domain/types';
import { buildMergedOpenAiSipDemoDidMap } from '@/src/backend/demo/demo-vertical-phone-map';
import { buildPublicDemoSystemPrompt, type DemoConfigInput } from '@/src/backend/demo/public-demo-system-prompt';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';
import type {
  BookingsRepository,
  CallbacksRepository,
  DemoSessionsRepository,
  JobsRepository,
  ProviderEventsRepository,
  ShopsRepository,
  SipDemoSessionEnrichment,
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
import type { TelephonyService } from '@/src/backend/services/telephony/types';
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
import { decodeCallControlClientState } from '@/src/backend/webhooks/telnyx-call-control';

const incomingEventSchema = z.object({
  type: z.string(),
  data: z
    .object({
      call_id: z.string().min(1),
      sip_headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    })
    .optional(),
});

function asVoiceVertical(slug: string): VoicePromptVertical | undefined {
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

type OpenAiSipRoute = { kind: 'demo'; ctx: OpenAiSipDidContext } | { kind: 'shop'; shop: Shop; matchedRaw: string };

function resolveOpenAiSipShopRoomContext(params: {
  sipHeaders: Array<{ name: string; value: string }> | undefined;
  shop: Shop;
  callId: string;
}): {
  requestId: string;
  roomName: string;
  parentTelnyxCallControlId: string | null;
  rbCallId: string;
  openAiLegCallControlId: string | null;
} {
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
    jobsRepository?: JobsRepository;
    bookingsRepository?: BookingsRepository;
    callbacksRepository?: CallbacksRepository;
    telephonyService?: TelephonyService;
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
  const already = await deps.providerEventsRepository.hasProcessed('openai', webhookId);
  if (already) {
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
  const didMap = buildMergedOpenAiSipDemoDidMap({
    OPENAI_SIP_DEMO_DID_MAP_JSON: env.OPENAI_SIP_DEMO_DID_MAP_JSON,
    DEMO_PHONE_NAIL_SALON: env.DEMO_PHONE_NAIL_SALON,
    DEMO_PHONE_HAIR_SALON: env.DEMO_PHONE_HAIR_SALON,
    DEMO_PHONE_DAY_SPA: env.DEMO_PHONE_DAY_SPA,
    DEMO_PHONE_MED_SPA: env.DEMO_PHONE_MED_SPA,
    DEMO_PHONE_BEAUTY_CLINIC: env.DEMO_PHONE_BEAUTY_CLINIC,
    DEMO_PHONE_FALLBACK_VERTICAL: env.DEMO_PHONE_FALLBACK_VERTICAL,
  });
  /** TeXML pilots often set `OPENAI_SIP_URI` but omit `OPENAI_REALTIME_PROJECT_ID` — derive proj id from URI. */
  const openAiProjectIdForDid =
    env.OPENAI_REALTIME_PROJECT_ID?.trim() || parseOpenAiProjectUserFromSipTo(env.OPENAI_SIP_URI ?? null) || null;
  const didCtx = resolveOpenAiSipDemoDidFromHeaders({
    sipHeaders: data.sip_headers,
    map: didMap,
    sipToValue: sipTo,
    openAiRealtimeProjectId: openAiProjectIdForDid,
  });

  let route: OpenAiSipRoute | null = didCtx ? { kind: 'demo', ctx: didCtx } : null;
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

  const normalizedFrom = parseE164FromSipValue(extractSipHeader(data.sip_headers, 'From'));

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

    instructions = buildPublicDemoSystemPrompt({
      shopName,
      businessType,
      demoVertical,
      staffName: enrichment?.demoConfig?.staffNames?.[0],
      notes: enrichment?.notes ?? undefined,
      demoConfig: enrichment?.demoConfig ? sipDemoConfigToPromptInput(enrichment.demoConfig) : undefined,
      demoChannel: 'inbound_sip',
      voiceCallType: 'inbound_booking',
    });
  } else {
    demoVertical = voiceVerticalFromShopVertical(route.shop.vertical);
    instructions = buildSystemPrompt({
      shop: route.shop,
      customer: null,
      mode: 'inbound',
      vertical: demoVertical,
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

  const shopRoomContext =
    route.kind === 'shop'
      ? resolveOpenAiSipShopRoomContext({
          sipHeaders: data.sip_headers,
          shop: route.shop,
          callId,
        })
      : null;

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

  if (route.kind === 'shop' && env.OPENAI_SIP_SIDEBAND_ENABLED && !shopSidebandDepsReady) {
    logger.warn({ callId }, 'openai_sip_shop_tools_missing_dependencies');
  }

  const includeDemoNoopTool = Boolean(env.OPENAI_SIP_SIDEBAND_ENABLED) && route.kind === 'demo';
  const acceptBody = buildOpenAiSipAcceptBody({
    instructions,
    model,
    voice,
    includeDemoNoopTool,
    shopBusinessTools: shopToolsAndSideband ? getSipShopToolsForOpenAiAccept() : undefined,
    toolChoice: shopToolsAndSideband ? 'auto' : undefined,
  });

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
  } else {
    logger.info({ callId, model }, 'openai_sip_call_accepted');
    incrementMetric('openai_sip_call_outcomes_total', { outcome: 'accepted' });
    if (env.OPENAI_SIP_SIDEBAND_ENABLED) {
      const acceptedAtMs = Date.now();
      if (route.kind === 'demo') {
        startOpenAiRealtimeSipSideband({
          variant: 'demo',
          callId,
          apiKey: apiKey!,
          enableToolLoop: true,
        });
      } else if (shopToolsAndSideband && shopRoomContext && route.kind === 'shop') {
        const executorDeps: SipToolExecutorDeps = {
          shopsRepository: deps.shopsRepository!,
          jobsRepository: deps.jobsRepository!,
          bookingsRepository: deps.bookingsRepository!,
          callbacksRepository: deps.callbacksRepository!,
          telephonyService: deps.telephonyService!,
        };
        const toolCtx = createSipAgentToolContext({
          shop: route.shop,
          callerPhone: normalizedFrom ?? '',
          requestId: shopRoomContext.requestId,
          roomName: shopRoomContext.roomName,
          deps: executorDeps,
          parentTelnyxCallControlId: shopRoomContext.parentTelnyxCallControlId,
          rbCallId: shopRoomContext.rbCallId,
          openAiLegCallControlId: shopRoomContext.openAiLegCallControlId,
        });
        startOpenAiRealtimeSipSideband({
          variant: 'shop',
          callId,
          apiKey: apiKey!,
          acceptedAtMs,
          initialResponseInstructions:
            route.shop.ai_welcome_message?.trim() || 'Thanks for calling. How can I help you today?',
          executeBusinessTool: (name, argsJson) => {
            let parsed: unknown = {};
            try {
              parsed = argsJson.trim() ? JSON.parse(argsJson) : {};
            } catch {
              parsed = {};
            }
            return executeSipShopToolCall(toolCtx, name, parsed);
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
