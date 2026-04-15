/**
 * NEW: Telnyx TeXML inbound path — PSTN → Telnyx number (Voice URL) → this handler →
 * `<Dial><Sip>OPENAI_SIP_URI</Sip></Dial>` → OpenAI SIP → `realtime.call.incoming` on your OpenAI webhook.
 *
 * EXISTING (unchanged): OpenAI Standard Webhook `POST …/webhooks/openai` → verify → accept/reject
 * lives in `openai-realtime-sip.ts`. This module does not call OpenAI HTTP APIs.
 */
import type { Context } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import { maskPhone } from '@/src/backend/security/pii';
import { consumeRateLimit, getClientIp, RATE_LIMIT_POLICIES } from '@/src/backend/security/rate-limit';

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
export async function handleTelnyxTexmlOpenAiInbound(c: Context): Promise<Response> {
  const env = getEnv();
  const sipUriConfigured = env.OPENAI_SIP_URI?.trim() ?? '';

  const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
  logger.info({ method: c.req.method, path: c.req.path, ip }, 'telnyx_texml_openai_inbound_hit');

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
  logger.info(
    {
      sipUriHost: sipHost,
      callerCli: form.From ? maskPhone(form.From) : undefined,
      dialedDid: form.To ? maskPhone(form.To) : undefined,
      callSid: form.CallSid,
    },
    'telnyx_texml_openai_inbound_sip_uri_selected',
  );

  const xml = buildTelnyxTexmlDialOpenAiXml(sipUriConfigured);
  incrementMetric('texml_openai_inbound_total', { outcome: 'dial_openai' });
  logger.info({ responseChars: xml.length }, 'telnyx_texml_openai_inbound_response_returned');
  return texmlXmlResponse(xml);
}
