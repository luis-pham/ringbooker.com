import type { Context } from 'hono';
import { z } from 'zod';

import { type VoicePromptVertical, openAiRealtimeVoiceForVertical } from '@/src/agent/prompts';
import { getEnv } from '@/src/backend/config/env';
import { buildPublicDemoSystemPrompt, type DemoConfigInput } from '@/src/backend/demo/public-demo-system-prompt';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import type { DemoSessionsRepository, ProviderEventsRepository, SipDemoSessionEnrichment } from '@/src/backend/ports/repositories';
import { securityAudit } from '@/src/backend/security/audit-log';
import { verifyOpenAiStandardWebhookV1 } from '@/src/backend/security/openai-standard-webhook';
import {
  consumeRateLimit,
  getClientIp,
  rateLimitUserMessage,
  RATE_LIMIT_POLICIES,
} from '@/src/backend/security/rate-limit';
import { buildOpenAiSipAcceptBody } from '@/src/backend/webhooks/openai-sip-accept-payload';
import {
  extractSipHeader,
  parseE164FromSipValue,
  parseOpenAiProjectUserFromSipTo,
  parseOpenAiSipDidMapJson,
  resolveOpenAiSipDidContext,
} from '@/src/backend/webhooks/openai-sip-did';
import { startOpenAiRealtimeSipSideband } from '@/src/backend/webhooks/openai-realtime-sip-sideband';

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
  const didMap = parseOpenAiSipDidMapJson(env.OPENAI_SIP_DEMO_DID_MAP_JSON);
  /** TeXML pilots often set `OPENAI_SIP_URI` but omit `OPENAI_REALTIME_PROJECT_ID` — derive proj id from URI. */
  const openAiProjectIdForDid =
    env.OPENAI_REALTIME_PROJECT_ID?.trim() || parseOpenAiProjectUserFromSipTo(env.OPENAI_SIP_URI ?? null) || null;
  const didCtx = resolveOpenAiSipDidContext({
    map: didMap,
    sipToValue: sipTo,
    openAiRealtimeProjectId: openAiProjectIdForDid,
  });

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

  if (!didCtx) {
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

  const didLim = await consumeRateLimit(RATE_LIMIT_POLICIES.openai_sip_per_did, `did:${didCtx.did}`);
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

  const shopName = enrichment?.shopName ?? didCtx.defaultShopName;
  const businessType = enrichment?.verticalSlug
    ? enrichment.verticalSlug.replace(/-/g, ' ')
    : didCtx.businessType;
  const demoVertical =
    asVoiceVertical(enrichment?.verticalSlug ?? didCtx.vertical) ?? didCtx.vertical;

  const instructions = buildPublicDemoSystemPrompt({
    shopName,
    businessType,
    demoVertical,
    staffName: enrichment?.demoConfig?.staffNames?.[0],
    notes: enrichment?.notes ?? undefined,
    demoConfig: enrichment?.demoConfig ? sipDemoConfigToPromptInput(enrichment.demoConfig) : undefined,
    demoChannel: 'inbound_sip',
    voiceCallType: 'inbound_booking',
  });

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

  const model = env.AGENT_VOICE_MODEL?.trim() || 'gpt-realtime';
  const voiceOverride = env.OPENAI_REALTIME_SIP_VOICE?.trim();
  const voice = voiceOverride || openAiRealtimeVoiceForVertical(demoVertical, 'alloy');
  const acceptBody = buildOpenAiSipAcceptBody({
    instructions,
    model,
    voice,
    includeDemoNoopTool: env.OPENAI_SIP_SIDEBAND_ENABLED,
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
      startOpenAiRealtimeSipSideband({
        callId,
        apiKey: apiKey!,
        enableToolLoop: true,
      });
    }
  }

  await deps.providerEventsRepository.markProcessed({
    provider: 'openai',
    providerEventId: webhookId,
    eventType: 'realtime.call.incoming',
    payload: {
      callId,
      outcome: acceptRes.ok ? 'accepted' : 'accept_failed',
      acceptStatus: acceptRes.status,
    },
  });

  return c.json({ ok: true });
}
