/**
 * Places lookups via Serper.dev's /maps endpoint (POST https://google.serper.dev/maps,
 * header `X-API-KEY: <key>`), replacing the Google Places API (v1) — billing setup friction
 * + cost. Response shape below was confirmed against the LIVE endpoint (not docs/memory) on
 * 2026-07-01 with a real query; see chat history for the raw JSON. The Google-based
 * implementation this replaced is archived byte-for-byte in `google-places.google-legacy.ts`
 * for rollback (unused, not imported).
 *
 * Confirmed live response shape (POST /maps, body `{ q | placeId | cid }`):
 *   {
 *     searchParameters: {...}, ll?: string,
 *     places: [{
 *       position, title, address, latitude, longitude, rating, ratingCount,
 *       type, types: string[], website?, phoneNumber?,
 *       openingHours?: { "Monday": "11 AM–8 PM", ..., "Sunday": "Closed" },  // full day names, en-dash range or "Closed"
 *       thumbnailUrl?, cid, fid, placeId
 *     }],
 *     credits: number
 *   }
 * On zero results or an unresolvable placeId/cid, Serper returns HTTP 200 with `places: []`
 * (never a 404) — "not found" and "bad identifier" are indistinguishable from Serper's side,
 * unlike Google Place Details which errors on an invalid id. Auth failure returns HTTP 403
 * `{ message: "Unauthorized.", statusCode: 403 }`.
 *
 * Serper's /maps natively accepts `cid` as a direct lookup param (confirmed live) — Google
 * Places API never supported CID lookup at all, so this is a strict improvement over the
 * previous CID handling (which had to guess a business name from the URL path).
 *
 * Serper does not return structured address components (no ISO country code field like
 * Google's addressComponents), so `country` here is inferred from the address string via the
 * same coarse per-region heuristics `inferTimezoneFromAddress` already used — this is a real
 * accuracy regression vs. Google's authoritative field and is called out in the PR notes.
 */
import type { ImportSourceType } from './types';
import { phoneComparableDigits } from '@/lib/phone-number';

export type GooglePlacesSuggestion = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  primaryType?: string | null;
  categories?: string[];
  hours?: Record<string, unknown> | null;
  timezone?: string | null;
  /** ISO 3166-1 alpha-2 country code — heuristically inferred from the address string (see module doc). */
  country?: string | null;
  matchConfidence?: number;
  warnings?: string[];
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function mapPrimaryType(categories: string[]): string | null {
  const text = categories.join(' ').toLowerCase();
  if (/nail/.test(text)) return 'nail_salon';
  if (/hair/.test(text)) return 'hair_salon';
  if (/med.*spa|medical.*spa|laser|inject|botox|filler/.test(text)) return 'med_spa';
  if (/spa|massage|facial/.test(text)) return 'day_spa';
  if (/beauty|brow|lash/.test(text)) return 'beauty_clinic';
  return null;
}

/**
 * US-ONLY ASSUMPTION — remove/revisit this if international support is added.
 *
 * Serper's /maps has no fixed address schema: confirmed live, the identical business returned
 * "...NY 10016, United States" from a text-search query and "...NY 10016" (no country suffix)
 * from a direct cid lookup — same place, same call, different formatting. Since RingBooker only
 * targets US businesses today, the country suffix is redundant noise; strip it so the stored
 * address is consistent regardless of which Serper code path produced it.
 */
const TRAILING_US_COUNTRY_SUFFIX_RE = /,\s*(united states of america|united states|usa|u\.s\.a\.?|us)\s*$/i;

export function normalizeAddress(address: string | null): string | null {
  if (!address) return address;
  return address.replace(TRAILING_US_COUNTRY_SUFFIX_RE, '').trim();
}

/** Coarse address-string country guess, matching the same set of regions `inferTimezoneFromAddress` already special-cases. */
function inferCountryFromAddress(address?: string | null): string | null {
  if (!address) return null;
  if (/\baustralia\b/i.test(address)) return 'AU';
  if (/\b(united kingdom|england|scotland|wales|northern ireland|\bUK\b)\b/i.test(address)) return 'GB';
  if (/\bnew zealand\b/i.test(address)) return 'NZ';
  if (/\bireland\b/i.test(address)) return 'IE';
  if (/\bcanada\b/i.test(address)) return 'CA';
  // US ZIP (5 digits, optionally +4) near the end of the address is the common case for this feature.
  if (/\b\d{5}(-\d{4})?\b\s*(,?\s*USA?)?$/i.test(address.trim())) return 'US';
  return null;
}

function inferTimezoneFromAddress(address?: string | null, country?: string | null): string | null {
  if (country === 'AU') {
    if (!address) return 'Australia/Sydney';
    if (/\b(western australia|perth)\b/i.test(address)) return 'Australia/Perth';
    if (/\b(south australia|adelaide)\b/i.test(address)) return 'Australia/Adelaide';
    if (/\b(queensland|brisbane)\b/i.test(address)) return 'Australia/Brisbane';
    if (/\b(northern territory|darwin)\b/i.test(address)) return 'Australia/Darwin';
    return 'Australia/Sydney';
  }
  if (country === 'GB') return 'Europe/London';
  if (country === 'NZ') return 'Pacific/Auckland';
  if (country === 'IE') return 'Europe/Dublin';
  if (country === 'CA') {
    if (!address) return 'America/Toronto';
    if (/\b(british columbia|vancouver|victoria)\b/i.test(address)) return 'America/Vancouver';
    if (/\b(alberta|calgary|edmonton)\b/i.test(address)) return 'America/Edmonton';
    return 'America/Toronto';
  }
  if (!address) return null;
  if (/\b(california|ca|los angeles|san francisco|san diego|san jose|sacramento|washington|oregon|nevada|seattle|portland|las vegas)\b/i.test(address)) return 'America/Los_Angeles';
  if (/\b(new york|ny|new jersey|nj|florida|fl|massachusetts|ma|pennsylvania|pa|washington dc|district of columbia|boston|miami|orlando|philadelphia)\b/i.test(address)) return 'America/New_York';
  if (/\b(texas|tx|illinois|il|chicago|dallas|houston|austin|minnesota|mn|wisconsin|wi)\b/i.test(address)) return 'America/Chicago';
  if (/\b(colorado|co|denver|utah|ut|arizona|az|phoenix|new mexico|nm)\b/i.test(address)) return 'America/Denver';
  return null;
}

const SERPER_DAY_NAME_TO_KEY: Record<string, (typeof DAY_KEYS)[number]> = {
  Sunday: 'sun',
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
};

/** Parses a Serper time token like "11 AM" or "8:30 PM" into "HH:MM" (24h). */
function parseSerperTimeToken(token: string): string | null {
  const match = token.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'AM') {
    if (hour === 12) hour = 0;
  } else if (hour !== 12) {
    hour += 12;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Serper's openingHours is `{ "Monday": "11 AM–8 PM", ..., "Sunday": "Closed" }` — full day
 * names, an en-dash range or the literal string "Closed". Mapped to the same
 * `{ mon: {open,close} | {closed:true}, ... }` shape the rest of the pipeline already expects
 * from the old Google-based `mapHours`, so merge.ts/extract.ts need no changes.
 */
function parseSerperOpeningHours(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const entries = raw as Record<string, unknown>;
  const hours: Record<string, unknown> = {};
  for (const [dayName, rangeValue] of Object.entries(entries)) {
    const key = SERPER_DAY_NAME_TO_KEY[dayName];
    if (!key || typeof rangeValue !== 'string') continue;
    if (/closed/i.test(rangeValue)) {
      hours[key] = { closed: true };
      continue;
    }
    // En-dash (–) is what Serper actually returns; also accept a plain hyphen defensively.
    const [openRaw, closeRaw] = rangeValue.split(/[–-]/).map((part) => part.trim());
    const open = openRaw ? parseSerperTimeToken(openRaw) : null;
    const close = closeRaw ? parseSerperTimeToken(closeRaw) : null;
    if (open && close) hours[key] = { open, close };
  }
  if (!Object.keys(hours).length) return null;
  for (const key of DAY_KEYS) {
    if (!hours[key]) hours[key] = { closed: true };
  }
  return hours;
}

function mapSerperPlaceToSuggestion(place: Record<string, unknown>, matchConfidence: number, warnings: string[]): GooglePlacesSuggestion {
  const name = typeof place.title === 'string' ? place.title : null;
  // Every Serper response (text search, cid lookup, placeId lookup) funnels through this one
  // function, so normalizing here covers all three code paths with a single change.
  const address = normalizeAddress(typeof place.address === 'string' ? place.address : null);
  const phone = typeof place.phoneNumber === 'string' ? place.phoneNumber : null;
  const website = typeof place.website === 'string' ? place.website : null;
  const types = Array.isArray(place.types)
    ? place.types.filter((item): item is string => typeof item === 'string')
    : typeof place.type === 'string'
      ? [place.type]
      : typeof place.category === 'string'
        ? [place.category]
        : [];
  const country = inferCountryFromAddress(address);
  return {
    name,
    phone,
    address,
    website,
    primaryType: mapPrimaryType(types),
    categories: types,
    hours: parseSerperOpeningHours(place.openingHours),
    timezone: inferTimezoneFromAddress(address, country),
    country,
    matchConfidence,
    warnings,
  };
}

const SERPER_MAPS_ENDPOINT = 'https://google.serper.dev/maps';

type SerperMapsResult = { ok: true; places: Array<Record<string, unknown>> } | { ok: false; status: number };

async function serperMapsRequest(
  body: Record<string, unknown>,
  apiKey: string,
  fetcher: Fetcher,
  signal: AbortSignal,
): Promise<SerperMapsResult> {
  const response = await fetcher(SERPER_MAPS_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) return { ok: false, status: response.status };
  const json = (await response.json().catch(() => null)) as { places?: Array<Record<string, unknown>> } | null;
  return { ok: true, places: json?.places ?? [] };
}

/** Extracts the business name from a full Maps place URL path, e.g. `/maps/place/Glow+Nail+Spa/@...`. */
function extractPlaceNameFromMapsPath(url: URL): string | null {
  const match = url.pathname.match(/\/maps\/place\/([^/]+)/i);
  if (!match) return null;
  try {
    const decoded = decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export type GoogleMapsIdentifier =
  | { type: 'place_id'; value: string }
  | { type: 'cid'; value: string }
  | { type: 'text'; value: string }
  | null;

/**
 * Extracts the highest-confidence identifier from a Maps URL: an exact place_id (unambiguous
 * lookup) beats a raw numeric CID (Serper supports this natively now — see module doc), which
 * beats free search text. Pure URL parsing, unchanged from the Google-based implementation —
 * identifier priority doesn't depend on which Places vendor is used downstream.
 */
export function extractGoogleMapsIdentifier(url: URL): GoogleMapsIdentifier {
  const placeId = url.searchParams.get('place_id')?.trim() || url.searchParams.get('query_place_id')?.trim();
  if (placeId) return { type: 'place_id', value: placeId.slice(0, 300) };
  const cid = url.searchParams.get('cid')?.trim();
  if (cid) return { type: 'cid', value: cid.slice(0, 300) };
  const text = url.searchParams.get('q')?.trim() || url.searchParams.get('query')?.trim();
  if (text) return { type: 'text', value: text.slice(0, 300) };
  return null;
}

const SAFE_GOOGLE_MAPS_PARAMS = ['q', 'query', 'cid', 'place_id', 'query_place_id'];

export function sanitizedGoogleMapsPlacesQuery(url: URL): string {
  for (const key of ['q', 'query', 'place_id', 'query_place_id', 'cid']) {
    const value = url.searchParams.get(key)?.trim();
    if (value) return value.slice(0, 300);
  }
  const sanitized = new URL(url.toString());
  sanitized.hash = '';
  for (const key of [...sanitized.searchParams.keys()]) {
    if (!SAFE_GOOGLE_MAPS_PARAMS.includes(key.toLowerCase())) sanitized.searchParams.delete(key);
  }
  return sanitized.toString().slice(0, 500);
}

async function lookupSerperMapsPlace(
  input: { url: URL; apiKey: string; fetcher: Fetcher; signal: AbortSignal },
): Promise<GooglePlacesSuggestion> {
  const identifier = extractGoogleMapsIdentifier(input.url);

  if (identifier?.type === 'place_id') {
    const result = await serperMapsRequest({ placeId: identifier.value }, input.apiKey, input.fetcher, input.signal).catch(() => null);
    // Same warning text regardless of transport failure vs. empty result — keeps importer.ts's
    // existing PLACE_ID_LOOKUP_FAILED classification (regex match on this exact string) working
    // unchanged. Serper returns HTTP 200 + empty `places` for an unresolvable id (no 404 like
    // Google Place Details), so "invalid id" and "call failed" are folded into one warning here.
    if (!result || !result.ok || !result.places.length) {
      return { warnings: ['Place Details lookup failed for this place_id.'], matchConfidence: 0 };
    }
    return mapSerperPlaceToSuggestion(result.places[0], 0.98, []);
  }

  if (identifier?.type === 'cid') {
    const cidResult = await serperMapsRequest({ cid: identifier.value }, input.apiKey, input.fetcher, input.signal).catch(() => null);
    if (cidResult?.ok && cidResult.places.length) {
      // Serper supports direct CID lookup (confirmed live) — no name-guessing needed.
      return mapSerperPlaceToSuggestion(cidResult.places[0], 0.95, []);
    }
    // Direct CID lookup found nothing — fall back to a name-based search using any business name
    // embedded in the URL path, same as before; if none is present, treat as unresolved rather
    // than guessing (never return a *different* business).
    const nameFromPath = extractPlaceNameFromMapsPath(input.url);
    if (!nameFromPath) {
      return { warnings: ['Could not resolve this Google Maps link (CID) to a specific business without a name. Please review details manually.'], matchConfidence: 0 };
    }
    const textResult = await serperMapsRequest({ q: nameFromPath }, input.apiKey, input.fetcher, input.signal).catch(() => null);
    if (!textResult?.ok || !textResult.places.length) {
      return { warnings: ['Could not find a matching business for this Google Maps link.'], matchConfidence: 0 };
    }
    return mapSerperPlaceToSuggestion(textResult.places[0], 0.85, ['Matched by business name found in the Maps link; please verify details.']);
  }

  const textQuery = identifier?.type === 'text' ? identifier.value : extractPlaceNameFromMapsPath(input.url) ?? sanitizedGoogleMapsPlacesQuery(input.url);
  const result = await serperMapsRequest({ q: textQuery }, input.apiKey, input.fetcher, input.signal).catch(() => null);
  if (!result?.ok || !result.places.length) {
    return { warnings: ['Could not find a matching business on Google Maps.'], matchConfidence: 0 };
  }
  return mapSerperPlaceToSuggestion(result.places[0], 0.95, []);
}

function normalizeDomain(value?: string | null): string {
  if (!value) return '';
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return value.replace(/^www\./, '').toLowerCase(); }
}

function tokenSimilarity(a?: string | null, b?: string | null): number {
  const left = new Set((a ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  const right = new Set((b ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common += 1;
  return common / Math.max(left.size, right.size);
}

function scorePlaceMatch(place: Record<string, unknown>, input: { url: URL; hints?: { name?: string | null; phone?: string | null; address?: string | null; website?: string | null } }) {
  const hints = input.hints ?? {};
  const name = typeof place.title === 'string' ? place.title : null;
  const placeWebsite = typeof place.website === 'string' ? place.website : null;
  const placePhone = typeof place.phoneNumber === 'string' ? place.phoneNumber : null;
  const placeAddress = typeof place.address === 'string' ? place.address : null;
  const warnings: string[] = [];
  let score = 0;
  if (placeWebsite && normalizeDomain(placeWebsite) === normalizeDomain(hints.website ?? input.url.toString())) score += 0.45;
  if (placePhone && hints.phone && phoneComparableDigits(placePhone) === phoneComparableDigits(hints.phone)) score += 0.3;
  score += Math.min(0.2, tokenSimilarity(name, hints.name) * 0.2);
  score += Math.min(0.15, tokenSimilarity(placeAddress, hints.address) * 0.15);
  if (placeWebsite && normalizeDomain(placeWebsite) !== normalizeDomain(input.url.toString())) warnings.push('Google Places website differs from submitted website. Review before saving.');
  return { score: Math.min(1, score), warnings };
}

function buildHintedQuery(input: { url: URL; hints?: { name?: string | null; phone?: string | null; address?: string | null; website?: string | null } }): string | null {
  const hints = input.hints ?? {};
  const domain = input.url.hostname.replace(/^www\./, '');
  const parts = [hints.name, hints.phone, hints.address, domain].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return parts.length ? parts.join(' ') : domain || null;
}

let hasWarnedMissingSerperKey = false;

export async function lookupGooglePlaces(input: {
  url: URL;
  sourceType: ImportSourceType;
  hints?: { name?: string | null; phone?: string | null; address?: string | null; website?: string | null };
  apiKey?: string | null;
  fetcher?: Fetcher;
  timeoutMs?: number;
}): Promise<GooglePlacesSuggestion | null> {
  if (!input.apiKey) {
    if (!hasWarnedMissingSerperKey) {
      hasWarnedMissingSerperKey = true;
      // eslint-disable-next-line no-console
      console.error('[website-import] SERPER_API_KEY is not configured — Google Maps import will run with no Places data (contact/hours enrichment disabled). Set SERPER_API_KEY in the environment.');
    }
    return null;
  }
  const fetcher = input.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 5_000);
  try {
    if (input.sourceType === 'google_maps') {
      return await lookupSerperMapsPlace({ url: input.url, apiKey: input.apiKey, fetcher, signal: controller.signal });
    }

    const query = buildHintedQuery(input);
    if (!query) return null;
    const result = await serperMapsRequest({ q: query }, input.apiKey, fetcher, controller.signal);
    if (!result.ok) return null;
    const ranked = result.places.map((place) => ({ place, ...scorePlaceMatch(place, input) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 0.45 || (ranked[1] && Math.abs(best.score - ranked[1].score) < 0.08)) {
      return {
        warnings: ['Multiple possible Google Places matches or low-confidence match. Review website details manually.'],
        matchConfidence: best?.score ?? 0,
      };
    }
    return mapSerperPlaceToSuggestion(best.place, best.score, best.warnings);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
