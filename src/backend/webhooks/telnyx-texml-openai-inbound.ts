/**
 * OpenAI SIP ingress adapter (TeXML) — **not** handoff, not a replacement for Call Control.
 *
 * Flow: PSTN → Telnyx number (Voice URL) → this handler →
 * `<Dial><Sip>OPENAI_SIP_URI</Sip></Dial>` → OpenAI Realtime SIP → `realtime.call.incoming` on `POST /webhooks/openai`.
 *
 * **Why this still exists when Call Control is implemented:** TeXML is the most reliable way to hand Telnyx
 * a full `sip:…@sip.api.openai.com;transport=tls` URI. Call Control can optionally `dial` the same URI on
 * `call.answered` when `TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP=true` (see `telnyx-call-control-webhook.ts`) —
 * confirm on your Telnyx account that `dial` accepts that SIP target.
 *
 * **Routing:** use `TELNYX_INBOUND_ROUTING_MODE=texml_to_openai_sip` if this URL is the number’s Voice URL.
 * If the number is attached to a Call Control Application, use `call_control_to_openai_sip` and do not
 * point Voice URL here.
 */
import { randomUUID } from 'node:crypto';

import type { Context } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import { getTelnyxInboundRoutingMode } from '@/src/backend/config/voice-transport';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { maskPhone } from '@/src/backend/security/pii';
import { consumeRateLimit, getClientIp, RATE_LIMIT_POLICIES } from '@/src/backend/security/rate-limit';
import type { BillingSubscriptionsRepository, ShopAccessStatesRepository, ShopsRepository } from '@/src/backend/ports/repositories';
import { resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTelnyxTexmlDialOpenAiXml(sipUri: string): string {
  const trimmed = sipUri.trim();
  return `${XML_DECL}\n<Response><Dial><Sip>${escapeXmlText(trimmed)}</Sip></Dial></Response>`;
}

function buildTelnyxTexmlRejectXml(): string {
  return `${XML_DECL}\n<Response><Reject reason="rejected"/></Response>`;
}

function texmlXmlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** Telnyx Voice URL (TeXML) — POST or GET, typically `application/x-www-form-urlencoded`. */
export async function handleTelnyxTexmlOpenAiInbound(
  c: Context,
  deps?: {
    shopsRepository?: ShopsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
  },
): Promise<Response> {
  const env = getEnv();
  const sipUriConfigured = env.OPENAI_SIP_URI?.trim() ?? '';
  const inboundRoutingMode = getTelnyxInboundRoutingMode();
  const rbCallId = randomUUID();

  const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      ip,
      telnyx_inbound_routing_mode: inboundRoutingMode,
      rb_call_id: rbCallId,
    },
    'telnyx_texml_openai_sip_ingress_hit',
  );

  if (inboundRoutingMode === 'call_control_to_openai_sip') {
    logger.warn(
      { rb_call_id: rbCallId },
      'telnyx_texml_reject_wrong_routing_mode_use_call_control_app',
    );
    incrementMetric('texml_openai_inbound_total', { outcome: 'reject_routing_mode_mismatch' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  const limited = await consumeRateLimit(RATE_LIMIT_POLICIES.texml_telnyx_openai_inbound, `texml_openai:${ip}`);
  if (!limited.ok) {
    logger.warn({ ip, path: c.req.path }, 'telnyx_texml_openai_inbound_rate_limited');
    incrementMetric('texml_openai_inbound_total', { outcome: 'reject_rate_limited' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  if (!sipUriConfigured || !/^sips?:/i.test(sipUriConfigured)) {
    logger.warn({ hasValue: Boolean(sipUriConfigured) }, 'telnyx_texml_openai_inbound_misconfigured');
    incrementMetric('texml_openai_inbound_total', { outcome: 'reject_misconfigured' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  let form: Record<string, string> = {};
  try {
    const parsed = await c.req.parseBody();
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') form[k] = v;
      }
    }
  } catch {
    form = {};
  }

  const sipHost =
    sipUriConfigured.includes('@') ? (sipUriConfigured.split('@')[1]?.split(';')[0] ?? 'unknown') : 'unknown';

  let shopId: string | undefined;
  let billingBlockedReason: string | undefined;
  if (deps?.shopsRepository && form.To) {
    try {
      const shop = await resolveShopByInboundDid({ shopsRepository: deps.shopsRepository }, form.To);
      shopId = shop?.id;
      if (shop && deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
        const access = await getShopBillingAccess(
          {
            shopsRepository: deps.shopsRepository,
            billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
            shopAccessStatesRepository: deps.shopAccessStatesRepository,
          },
          { shopId: shop.id, onboardingComplete: true },
        );
        if (!access.canReceiveLiveCalls) billingBlockedReason = access.blockReason;
      }
    } catch {
      shopId = undefined;
    }
  }

  logger.info(
    {
      sipUriHost: sipHost,
      callerCli: form.From ? maskPhone(form.From) : undefined,
      dialedDid: form.To ? maskPhone(form.To) : undefined,
      callSid: form.CallSid,
      rb_call_id: rbCallId,
      shop_id: shopId,
      billing_blocked_reason: billingBlockedReason,
    },
    'telnyx_texml_openai_sip_dial_selected',
  );

  if (billingBlockedReason) {
    incrementMetric('texml_openai_inbound_total', { outcome: 'billing_blocked' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  const xml = buildTelnyxTexmlDialOpenAiXml(sipUriConfigured);
  incrementMetric('texml_openai_inbound_total', { outcome: 'dial_openai' });
  logger.info({ responseChars: xml.length, rb_call_id: rbCallId }, 'telnyx_texml_openai_inbound_response_returned');
  return texmlXmlResponse(xml);
}
