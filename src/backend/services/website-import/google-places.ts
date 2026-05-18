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
  /** ISO 3166-1 alpha-2 country code extracted from Google Places addressComponents. */
  country?: string | null;
  matchConfidence?: number;
  warnings?: string[];
};

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function toTime(hour?: number, minute?: number): string | null {
  if (typeof hour !== 'number' || hour < 0 || hour > 23) return null;
  const safeMinute = typeof minute === 'number' && minute >= 0 && minute <= 59 ? minute : 0;
  return `${String(hour).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
}

function mapHours(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;
  const periods = (raw as { periods?: unknown }).periods;
  if (!Array.isArray(periods)) return null;
  const hours: Record<string, unknown> = {};
  for (const period of periods) {
    if (!period || typeof period !== 'object') continue;
    const rawPeriod = period as { open?: { day?: number; hour?: number; minute?: number }; close?: { day?: number; hour?: number; minute?: number } };
    const key = typeof rawPeriod.open?.day === 'number' ? DAY_KEYS[rawPeriod.open.day] : null;
    const open = toTime(rawPeriod.open?.hour, rawPeriod.open?.minute);
    const close = toTime(rawPeriod.close?.hour, rawPeriod.close?.minute);
    if (key && open && close) hours[key] = { open, close };
  }
  return Object.keys(hours).length ? hours : null;
}

function mapPrimaryType(categories: string[]): string | null {
  const text = categories.join(' ').toLowerCase();
  if (/nail/.test(text)) return 'nail_salon';
  if (/hair/.test(text)) return 'hair_salon';
  if (/med.*spa|medical.*spa|laser|inject|botox|filler/.test(text)) return 'med_spa';
  if (/spa|massage|facial/.test(text)) return 'day_spa';
  if (/beauty|brow|lash/.test(text)) return 'beauty_clinic';
  return null;
}

export async function lookupGooglePlaces(input: {
  url: URL;
  sourceType: ImportSourceType;
  hints?: { name?: string | null; phone?: string | null; address?: string | null; website?: string | null };
  apiKey?: string | null;
  fetcher?: Fetcher;
  timeoutMs?: number;
}): Promise<GooglePlacesSuggestion | null> {
  if (!input.apiKey) return null;
  const fetcher = input.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 5_000);
  try {
    const query = buildPlacesQuery(input);
    if (!query) return null;
    const response = await fetcher('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.apiKey,
        'x-goog-fieldmask': [
          'places.displayName',
          'places.formattedAddress',
          'places.addressComponents',
          'places.nationalPhoneNumber',
          'places.internationalPhoneNumber',
          'places.websiteUri',
          'places.regularOpeningHours',
          'places.types',
          'places.primaryType',
          'places.primaryTypeDisplayName',
        ].join(','),
      },
      // Pin language so the server's IP geolocation can't localize the response
      // (e.g. Vietnamese day names / addresses when the API is called from VN).
      body: JSON.stringify({
        textQuery: query,
        maxResultCount: input.sourceType === 'google_maps' ? 1 : 3,
        languageCode: 'en',
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json().catch(() => null)) as { places?: Array<Record<string, unknown>> } | null;
    const places = body?.places ?? [];
    const ranked = places.map((place) => ({ place, ...scorePlaceMatch(place, input) })).sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (input.sourceType !== 'google_maps' && (!best || best.score < 0.45 || (ranked[1] && Math.abs(best.score - ranked[1].score) < 0.08))) {
      return {
        warnings: ['Multiple possible Google Places matches or low-confidence match. Review website details manually.'],
        matchConfidence: best?.score ?? 0,
      };
    }
    const place = best?.place;
    if (!place) return null;
    const displayName = place.displayName as { text?: string } | undefined;
    const primaryTypeDisplayName = place.primaryTypeDisplayName as { text?: string } | undefined;
    const types = Array.isArray(place.types) ? place.types.filter((item): item is string => typeof item === 'string') : [];
    const categories = [primaryTypeDisplayName?.text, typeof place.primaryType === 'string' ? place.primaryType : null, ...types].filter((item): item is string => Boolean(item));
    const addressComponents = Array.isArray(place.addressComponents) ? place.addressComponents as Array<{ shortText?: string; types?: string[] }> : [];
    const countryComponent = addressComponents.find((c) => Array.isArray(c.types) && c.types.includes('country'));
    const country = countryComponent?.shortText ?? null;
    const formattedAddress = typeof place.formattedAddress === 'string' ? place.formattedAddress : null;
    return {
      name: displayName?.text ?? null,
      phone: typeof place.nationalPhoneNumber === 'string' ? place.nationalPhoneNumber : typeof place.internationalPhoneNumber === 'string' ? place.internationalPhoneNumber : null,
      address: formattedAddress,
      website: typeof place.websiteUri === 'string' ? place.websiteUri : null,
      primaryType: mapPrimaryType(categories),
      categories,
      hours: mapHours(place.regularOpeningHours),
      timezone: inferTimezoneFromAddress(formattedAddress, country),
      country,
      matchConfidence: input.sourceType === 'google_maps' ? 0.95 : best.score,
      warnings: best.warnings,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

function buildPlacesQuery(input: { url: URL; sourceType: ImportSourceType; hints?: { name?: string | null; phone?: string | null; address?: string | null; website?: string | null } }): string | null {
  if (input.sourceType === 'google_maps') return sanitizedGoogleMapsPlacesQuery(input.url);
  const hints = input.hints ?? {};
  const domain = input.url.hostname.replace(/^www\./, '');
  const parts = [hints.name, hints.phone, hints.address, domain].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return parts.length ? parts.join(' ') : domain || null;
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

function scorePlaceMatch(place: Record<string, unknown>, input: { url: URL; sourceType: ImportSourceType; hints?: { name?: string | null; phone?: string | null; address?: string | null; website?: string | null } }) {
  if (input.sourceType === 'google_maps') return { score: 0.95, warnings: [] as string[] };
  const hints = input.hints ?? {};
  const displayName = place.displayName as { text?: string } | undefined;
  const placeWebsite = typeof place.websiteUri === 'string' ? place.websiteUri : null;
  const placePhone = typeof place.nationalPhoneNumber === 'string' ? place.nationalPhoneNumber : typeof place.internationalPhoneNumber === 'string' ? place.internationalPhoneNumber : null;
  const placeAddress = typeof place.formattedAddress === 'string' ? place.formattedAddress : null;
  const warnings: string[] = [];
  let score = 0;
  if (placeWebsite && normalizeDomain(placeWebsite) === normalizeDomain(hints.website ?? input.url.toString())) score += 0.45;
  if (placePhone && hints.phone && phoneComparableDigits(placePhone) === phoneComparableDigits(hints.phone)) score += 0.3;
  score += Math.min(0.2, tokenSimilarity(displayName?.text, hints.name) * 0.2);
  score += Math.min(0.15, tokenSimilarity(placeAddress, hints.address) * 0.15);
  if (placeWebsite && normalizeDomain(placeWebsite) !== normalizeDomain(input.url.toString())) warnings.push('Google Places website differs from submitted website. Review before saving.');
  return { score: Math.min(1, score), warnings };
}
