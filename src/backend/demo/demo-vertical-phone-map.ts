import type { VoicePromptVertical } from '@/src/agent/prompts';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';
import type { OpenAiSipDidContext } from '@/src/backend/webhooks/openai-sip-did';
import { parseOpenAiSipDidMapJson } from '@/src/backend/webhooks/openai-sip-did';

/** Default sample shop + business type labels aligned with marketing vertical demo pages. */
export const SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL: Record<
  VoicePromptVertical,
  { defaultShopName: string; businessType: string }
> = {
  'nail-salon': { defaultShopName: 'ABC Nails Studio', businessType: 'nail salon' },
  'hair-salon': { defaultShopName: 'Willow Hair Lounge', businessType: 'hair salon' },
  'day-spa': { defaultShopName: 'Serene Day Spa', businessType: 'day spa' },
  'med-spa': { defaultShopName: 'Astra Med Spa', businessType: 'med spa' },
  'beauty-clinic': { defaultShopName: 'Northline Beauty Clinic', businessType: 'beauty clinic' },
};

export type VerticalDemoPhoneEnv = {
  OPENAI_SIP_DEMO_DID_MAP_JSON?: string | undefined;
  DEMO_PHONE_NAIL_SALON?: string | undefined;
  DEMO_PHONE_HAIR_SALON?: string | undefined;
  DEMO_PHONE_DAY_SPA?: string | undefined;
  DEMO_PHONE_MED_SPA?: string | undefined;
  DEMO_PHONE_BEAUTY_CLINIC?: string | undefined;
  DEMO_PHONE_FALLBACK_VERTICAL?: string | undefined;
};

const ALLOWED_VERTICALS: readonly VoicePromptVertical[] = [
  'nail-salon',
  'hair-salon',
  'day-spa',
  'med-spa',
  'beauty-clinic',
];

function asVoiceVertical(raw: string | null | undefined): VoicePromptVertical | null {
  const s = raw?.trim();
  if (!s) return null;
  return (ALLOWED_VERTICALS as readonly string[]).includes(s) ? (s as VoicePromptVertical) : null;
}

/** Resolves `DEMO_PHONE_FALLBACK_VERTICAL` for helpers like `getDemoVerticalByPhoneNumber` (default nail-salon). */
export function sipDemoFallbackVerticalFromEnv(env: Pick<VerticalDemoPhoneEnv, 'DEMO_PHONE_FALLBACK_VERTICAL'>): VoicePromptVertical {
  return asVoiceVertical(env.DEMO_PHONE_FALLBACK_VERTICAL) ?? 'nail-salon';
}

/**
 * Builds demo DID → context rows from `DEMO_PHONE_*` env vars (E.164).
 * Omits unset or unparsable numbers.
 */
export function buildOpenAiSipDemoDidMapFromVerticalEnvPhones(env: VerticalDemoPhoneEnv): Map<string, OpenAiSipDidContext> {
  const rows: Array<[VoicePromptVertical, string | undefined]> = [
    ['nail-salon', env.DEMO_PHONE_NAIL_SALON],
    ['hair-salon', env.DEMO_PHONE_HAIR_SALON],
    ['day-spa', env.DEMO_PHONE_DAY_SPA],
    ['med-spa', env.DEMO_PHONE_MED_SPA],
    ['beauty-clinic', env.DEMO_PHONE_BEAUTY_CLINIC],
  ];
  const out = new Map<string, OpenAiSipDidContext>();
  for (const [vertical, raw] of rows) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    const e164 = normalizeInboundE164(trimmed);
    if (!e164) continue;
    const defaults = SIP_DEMO_DEFAULT_SHOP_BY_VERTICAL[vertical];
    out.set(e164, {
      did: trimmed,
      mode: 'demo',
      vertical,
      defaultShopName: defaults.defaultShopName,
      businessType: defaults.businessType,
    });
  }
  return out;
}

/**
 * Merges JSON-configured demo DIDs with `DEMO_PHONE_*` env rows.
 * `OPENAI_SIP_DEMO_DID_MAP_JSON` wins on duplicate E.164 so ops can override env in one place.
 */
export function mergeOpenAiSipJsonAndVerticalEnvDemoMaps(
  jsonMap: Map<string, OpenAiSipDidContext>,
  envMap: Map<string, OpenAiSipDidContext>,
): Map<string, OpenAiSipDidContext> {
  const merged = new Map(envMap);
  for (const [k, v] of jsonMap) merged.set(k, v);
  return merged;
}

export function buildMergedOpenAiSipDemoDidMap(env: VerticalDemoPhoneEnv): Map<string, OpenAiSipDidContext> {
  const jsonMap = parseOpenAiSipDidMapJson(env.OPENAI_SIP_DEMO_DID_MAP_JSON);
  const envMap = buildOpenAiSipDemoDidMapFromVerticalEnvPhones(env);
  return mergeOpenAiSipJsonAndVerticalEnvDemoMaps(jsonMap, envMap);
}

/**
 * Maps a normalized or raw called number to a marketing / voice vertical.
 * Use with `buildMergedOpenAiSipDemoDidMap(getEnv())` for consistent routing with SIP.
 * When the number is not in the merged map, returns `fallbackVertical` (default: nail-salon).
 *
 * Note: OpenAI SIP inbound still rejects unknown DIDs (no map entry); this helper is for
 * tooling, tests, and future Telnyx paths — not a substitute for configuring each demo DID.
 */
export function getDemoVerticalByPhoneNumber(
  calledNumber: string | null | undefined,
  mergedMap: Map<string, OpenAiSipDidContext>,
  options?: { fallbackVertical?: VoicePromptVertical },
): { vertical: VoicePromptVertical; matchedConfiguredLine: boolean } {
  const e164 = normalizeInboundE164(calledNumber ?? '');
  const fallback = options?.fallbackVertical ?? 'nail-salon';
  if (!e164) return { vertical: fallback, matchedConfiguredLine: false };
  const hit = mergedMap.get(e164);
  if (hit) return { vertical: hit.vertical, matchedConfiguredLine: true };
  return { vertical: fallback, matchedConfiguredLine: false };
}
