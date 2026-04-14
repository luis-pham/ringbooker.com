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

export function resolveOpenAiSipDidContext(params: {
  map: Map<string, OpenAiSipDidContext>;
  sipToValue: string | null;
}): OpenAiSipDidContext | null {
  const e164 = params.sipToValue ? normalizeE164FromSipUri(params.sipToValue) : null;
  if (!e164) return null;
  return params.map.get(e164) ?? null;
}
