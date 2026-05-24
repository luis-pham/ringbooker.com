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
 * **Routing:** demo vertical DIDs may use this Voice URL while real shop DIDs use Call Control. Use
 * `TELNYX_DEMO_INBOUND_ROUTING_MODE=texml_to_openai_sip` and
 * `TELNYX_SHOP_INBOUND_ROUTING_MODE=call_control_to_openai_sip` to keep those paths separated.
 */
import { randomUUID } from 'node:crypto';

import type { Context } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import {
  getTelnyxDemoInboundRoutingMode,
  getTelnyxInboundRoutingMode,
  getTelnyxShopInboundRoutingMode,
} from '@/src/backend/config/voice-transport';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { securityAudit } from '@/src/backend/security/audit-log';
import { maskPhone } from '@/src/backend/security/pii';
import { consumeRateLimit, getClientIp, RATE_LIMIT_POLICIES } from '@/src/backend/security/rate-limit';
import { verifyTelnyxSignature } from '@/src/backend/security/telnyx-signature';
import type {
  BillingSubscriptionsRepository,
  ForwardingTestSessionsRepository,
  CallLogsRepository,
  CommercialAccountsRepository,
  ShopActiveCallSessionsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { resolveShopByInboundDidWithMeta, normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import { checkLiveCallUsageGate } from '@/src/backend/services/usage/live-call-usage-gate';
import { resolveVerticalDemoInboundRoute } from '@/src/backend/demo/demo-vertical-phone-map';
import type { ShopBillingAccess } from '@/src/backend/services/billing/access';
import { completeForwardingTestFromInboundCall } from '@/src/backend/services/go-live/forwarding-test-inbound';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTelnyxTexmlDialOpenAiXml(sipUri: string, opts?: { timeLimitSecs?: number }): string {
  const trimmed = sipUri.trim();
  // `timeLimit` is enforced provider-side by Telnyx — survives app restarts (unlike an in-process timer).
  const timeLimitAttr =
    typeof opts?.timeLimitSecs === 'number' && Number.isFinite(opts.timeLimitSecs) && opts.timeLimitSecs > 0
      ? ` timeLimit="${Math.floor(opts.timeLimitSecs)}"`
      : '';
  return `${XML_DECL}\n<Response><Dial${timeLimitAttr}><Sip>${escapeXmlText(trimmed)}</Sip></Dial></Response>`;
}

function buildTelnyxTexmlRejectXml(): string {
  return `${XML_DECL}\n<Response><Reject reason="rejected"/></Response>`;
}

function buildTelnyxTexmlForwardingTestAckXml(): string {
  const msg = escapeXmlText('RingBooker received your forwarded test call. You can hang up now.');
  return `${XML_DECL}\n<Response><Say voice="Polly.Joanna" language="en-US">${msg}</Say><Hangup/></Response>`;
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

function liveAnsweringBillingBlockedLogFields(params: {
  shopId: string;
  access: Pick<
    ShopBillingAccess,
    'blockReason' | 'subscriptionStatus' | 'paymentMethodStatus' | 'providerSubscriptionId' | 'liveCallsEnabled'
  >;
  callSessionId?: string | null;
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
    call_session_id: params.callSessionId ?? null,
  };
}

/** Telnyx Voice URL (TeXML) — POST or GET, typically `application/x-www-form-urlencoded`. */
export async function handleTelnyxTexmlOpenAiInbound(
  c: Context,
  deps?: {
    shopsRepository?: ShopsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
    callLogsRepository?: CallLogsRepository;
    commercialAccountsRepository?: CommercialAccountsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  },
): Promise<Response> {
  const env = getEnv();
  const sipUriConfigured = env.OPENAI_SIP_URI?.trim() ?? '';
  const inboundRoutingMode = getTelnyxInboundRoutingMode();
  const shopInboundRoutingMode = getTelnyxShopInboundRoutingMode();
  const demoInboundRoutingMode = getTelnyxDemoInboundRoutingMode();
  const rbCallId = randomUUID();

  const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      ip,
      telnyx_inbound_routing_mode: inboundRoutingMode,
      telnyx_shop_inbound_routing_mode: shopInboundRoutingMode,
      telnyx_demo_inbound_routing_mode: demoInboundRoutingMode,
      rb_call_id: rbCallId,
    },
    'telnyx_texml_openai_sip_ingress_hit',
  );

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

  const bodyText = await c.req.text().catch(() => '');

  // Verify the Telnyx Ed25519 signature on the TeXML Voice URL POST (same scheme as the JSON webhooks).
  // Without this, anyone who knows the URL can spoof `From`/`To` and trigger a billed `<Dial><Sip>` to OpenAI.
  if (env.TELNYX_TEXML_VERIFY_SIGNATURE) {
    const signature = c.req.header('telnyx-signature-ed25519') ?? null;
    const sigTimestamp = c.req.header('telnyx-timestamp') ?? null;
    const verified = verifyTelnyxSignature({
      body: bodyText,
      timestamp: sigTimestamp,
      signature,
      publicKey: env.TELNYX_WEBHOOK_PUBLIC_KEY,
      maxSkewSeconds: env.TELNYX_WEBHOOK_MAX_SKEW_SECONDS,
    });
    if (!verified) {
      logger.warn({ ip, path: c.req.path, rb_call_id: rbCallId }, 'telnyx_texml_openai_inbound_invalid_signature');
      incrementMetric('texml_openai_inbound_total', { outcome: 'reject_invalid_signature' });
      securityAudit({
        action: 'webhook_signature_invalid',
        actorType: 'provider',
        ip,
        path: c.req.path,
        provider: 'telnyx_texml',
      });
      return texmlXmlResponse(buildTelnyxTexmlRejectXml());
    }
  }

  // TeXML Voice URL POSTs are application/x-www-form-urlencoded. Parse from the same raw body that was signed.
  const form: Record<string, string> = {};
  try {
    for (const [k, v] of new URLSearchParams(bodyText).entries()) form[k] = v;
  } catch {
    /* leave form empty */
  }

  const demoCtx = form.To ? resolveVerticalDemoInboundRoute(normalizeInboundE164(form.To), env) : null;
  const isDemoNumber = Boolean(demoCtx);

  if (isDemoNumber && demoInboundRoutingMode !== 'texml_to_openai_sip') {
    logger.warn(
      {
        rb_call_id: rbCallId,
        dialedDid: form.To ? maskPhone(form.To) : undefined,
        telnyx_demo_inbound_routing_mode: demoInboundRoutingMode,
      },
      'telnyx_texml_reject_demo_wrong_routing_mode',
    );
    incrementMetric('texml_openai_inbound_total', { outcome: 'reject_demo_routing_mode_mismatch' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  if (!isDemoNumber && shopInboundRoutingMode === 'call_control_to_openai_sip') {
    logger.warn(
      {
        rb_call_id: rbCallId,
        dialedDid: form.To ? maskPhone(form.To) : undefined,
        telnyx_shop_inbound_routing_mode: shopInboundRoutingMode,
      },
      'telnyx_texml_reject_shop_wrong_routing_mode_use_call_control_app',
    );
    incrementMetric('texml_openai_inbound_total', { outcome: 'reject_shop_routing_mode_mismatch' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  const sipHost =
    sipUriConfigured.includes('@') ? (sipUriConfigured.split('@')[1]?.split(';')[0] ?? 'unknown') : 'unknown';

  let shopId: string | undefined;
  let billingBlockedReason: string | undefined;
  let shopCallMaxDurationSecs: number | null = null;
  let forwardingTestAckTexml = false;
  if (!isDemoNumber && deps?.shopsRepository && form.To) {
    try {
      const meta = await resolveShopByInboundDidWithMeta({ shopsRepository: deps.shopsRepository }, form.To);
      const shop = meta.shop;
      shopId = shop?.id;
      if (shop && deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
        const access = await getShopBillingAccess(
          {
            shopsRepository: deps.shopsRepository,
            billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
            shopAccessStatesRepository: deps.shopAccessStatesRepository,
          },
          { shopId: shop.id },
        );
        if (!access.canReceiveLiveCalls) {
          if (meta.matchedBy === 'telnyx_number' && deps.forwardingTestSessionsRepository) {
            forwardingTestAckTexml = await completeForwardingTestFromInboundCall({
                forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
                shopAccessStatesRepository: deps.shopAccessStatesRepository,
                shopId: shop.id,
                inboundDidE164: normalizeInboundE164(form.To) ?? form.To,
                inboundCallSessionId: form.CallSid ?? rbCallId,
                inboundCallControlId: null,
                callerPhone: form.From ? normalizeInboundE164(form.From) ?? form.From : null,
                now: new Date(),
              });
          }
          if (!forwardingTestAckTexml) {
            billingBlockedReason = access.blockReason;
            logger.warn(
              liveAnsweringBillingBlockedLogFields({
                shopId: shop.id,
                access,
                callSessionId: form.CallSid ?? rbCallId,
              }),
              'live_answering_billing_blocked',
            );
          }
        } else if (deps.callLogsRepository) {
          const commercialAccount = deps.commercialAccountsRepository
            ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null)
            : null;
          const gate = await checkLiveCallUsageGate(
            {
              callLogsRepository: deps.callLogsRepository,
              shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
              billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
            },
            { shop, commercialAccount },
          );
          const usage = gate.usage;
          shopCallMaxDurationSecs = usage.limits.maxCallDurationSeconds;
          if (!gate.ok) billingBlockedReason = gate.reason;
        } else {
          billingBlockedReason = 'usage_limit_unavailable';
          logger.warn(
            {
              event: 'live_answering_usage_limit_unavailable',
              shop_id: shop.id,
              call_session_id: form.CallSid ?? rbCallId,
            },
            'live_answering_usage_limit_unavailable',
          );
        }
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
      forwarding_test_ack_texml: forwardingTestAckTexml,
      max_call_duration_seconds: shopCallMaxDurationSecs,
    },
    'telnyx_texml_openai_sip_dial_selected',
  );

  if (forwardingTestAckTexml) {
    incrementMetric('texml_openai_inbound_total', { outcome: 'forwarding_test_ack' });
    return texmlXmlResponse(buildTelnyxTexmlForwardingTestAckXml());
  }

  if (billingBlockedReason) {
    incrementMetric('texml_openai_inbound_total', { outcome: 'billing_blocked' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  if (!isDemoNumber && shopId && (!shopCallMaxDurationSecs || shopCallMaxDurationSecs <= 0)) {
    logger.error(
      {
        shop_id: shopId,
        call_session_id: form.CallSid ?? rbCallId,
        max_call_duration_seconds: shopCallMaxDurationSecs,
      },
      'telnyx_texml_reject_missing_shop_duration_cap',
    );
    incrementMetric('texml_openai_inbound_total', { outcome: 'reject_missing_duration_cap' });
    return texmlXmlResponse(buildTelnyxTexmlRejectXml());
  }

  // Every bridged line gets a provider-side hard duration cap via `<Dial timeLimit>` — Telnyx enforces it,
  // so it survives app restarts (unlike an in-process timer).
  const xml = buildTelnyxTexmlDialOpenAiXml(
    sipUriConfigured,
    { timeLimitSecs: isDemoNumber ? env.TELNYX_TEXML_DEMO_MAX_DURATION_SECS : shopCallMaxDurationSecs ?? undefined },
  );
  incrementMetric('texml_openai_inbound_total', { outcome: 'dial_openai' });
  logger.info(
    {
      responseChars: xml.length,
      rb_call_id: rbCallId,
      shop_id: shopId,
      max_call_duration_seconds: isDemoNumber ? env.TELNYX_TEXML_DEMO_MAX_DURATION_SECS : shopCallMaxDurationSecs,
      demo_time_limit_applied: isDemoNumber,
    },
    'telnyx_texml_openai_inbound_response_returned',
  );
  return texmlXmlResponse(xml);
}
