import { z } from 'zod';

import type { VoicePromptVertical } from '@/src/agent/prompts';

const verticalSchema = z.enum(['nail-salon', 'hair-salon', 'day-spa', 'med-spa', 'beauty-clinic']);

const didMapEntrySchema = z.object({
  /** E.164 including + */
  did: z.string().min(8).max(24),
  vertical: verticalSchema,
  defaultShopName: z.string().min(1).max(120).optional(),
  businessType: z.string().min(1).max(80).optional(),
});

export type OpenAiSipDidContext = {
  did: string;
  mode: 'demo';
  vertical: VoicePromptVertical;
  defaultShopName: string;
  businessType: string;
};

export function parseE164FromSipValue(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return normalizeE164FromSipUri(raw);
}

function normalizeE164FromSipUri(raw: string): string | null {
  const v = raw.trim();
  const m = v.match(/sip:([^@;>]+)/i);
  const user = (m?.[1] ?? v).replace(/^["']|["']$/g, '');
  const digits = user.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 16 ? digits : null;
  }
  const d = user.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

export function extractSipHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string | null {
  if (!headers?.length) return null;
  const want = name.toLowerCase();
  for (const h of headers) {
    if (h.name?.toLowerCase() === want) return h.value ?? null;
  }
  return null;
}

/** Headers that may carry the PSTN DID when `To` is an OpenAI SIP URI (TeXML / bridged legs). */
const SIP_DID_ROUTING_HEADER_NAMES = ['To', 'P-Asserted-Identity', 'Diversion', 'X-Telnyx-Called-Number'] as const;

export function collectOpenAiSipDidCandidates(
  headers: Array<{ name: string; value: string }> | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of SIP_DID_ROUTING_HEADER_NAMES) {
    const v = extractSipHeader(headers, name);
    if (!v?.trim()) continue;
    const key = v.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function parseOpenAiSipDidMapJson(json: string | undefined): Map<string, OpenAiSipDidContext> {
  const out = new Map<string, OpenAiSipDidContext>();
  if (!json?.trim()) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return out;
  }
  const arr = z.array(didMapEntrySchema).safeParse(parsed);
  if (!arr.success) return out;
  for (const row of arr.data) {
    const normalized = row.did.replace(/[^\d+]/g, '');
    const key = normalized.startsWith('+') ? normalized : normalized.length >= 10 ? `+${normalized}` : '';
    if (!key || !key.startsWith('+')) continue;
    out.set(key, {
      did: row.did,
      mode: 'demo',
      vertical: row.vertical,
      defaultShopName: row.defaultShopName ?? 'RingBooker pilot salon',
      businessType: row.businessType ?? row.vertical.replace(/-/g, ' '),
    });
  }
  return out;
}

/**
 * When Telnyx TeXML `<Dial><Sip>sip:proj_…@sip.api.openai.com</Sip></Dial>` is used, OpenAI's
 * `realtime.call.incoming` webhook puts that URI in `To`, not the PSTN DID. Extract `proj_…` user part.
 */
export function parseOpenAiProjectUserFromSipTo(sipToValue: string | null | undefined): string | null {
  if (!sipToValue?.trim()) return null;
  const m = sipToValue.trim().match(/sip:([^@;>\s]+)@sip\.api\.openai\.com/i);
  const user = m?.[1]?.replace(/^["']|["']$/g, '') ?? '';
  if (!user.startsWith('proj_')) return null;
  return user;
}

export function resolveOpenAiSipDidContext(params: {
  map: Map<string, OpenAiSipDidContext>;
  sipToValue: string | null;
  /** Kept for backward-compatible call sites; demo routing now requires an actual DID match. */
  openAiRealtimeProjectId?: string | null;
}): OpenAiSipDidContext | null {
  const e164 = params.sipToValue ? normalizeE164FromSipUri(params.sipToValue) : null;
  if (e164) {
    const byPhone = params.map.get(e164);
    if (byPhone) return byPhone;
  }

  return null;
}

/**
 * Resolves inbound demo DID using the same header candidates as production shop routing.
 * When Telnyx bridges PSTN → OpenAI SIP, `To` is often `sip:proj_…@sip.api.openai.com`; the PSTN
 * destination may appear on `X-Telnyx-Called-Number`, `P-Asserted-Identity`, or `Diversion`.
 */
export function resolveOpenAiSipDemoDidFromHeaders(params: {
  sipHeaders: Array<{ name: string; value: string }> | undefined;
  map: Map<string, OpenAiSipDidContext>;
  sipToValue: string | null;
  openAiRealtimeProjectId?: string | null;
}): OpenAiSipDidContext | null {
  for (const raw of collectOpenAiSipDidCandidates(params.sipHeaders)) {
    const e164 = parseE164FromSipValue(raw) ?? normalizeE164FromSipUri(raw);
    if (e164) {
      const byPhone = params.map.get(e164);
      if (byPhone) return byPhone;
    }
  }
  return resolveOpenAiSipDidContext({
    map: params.map,
    sipToValue: params.sipToValue,
    openAiRealtimeProjectId: params.openAiRealtimeProjectId,
  });
}
