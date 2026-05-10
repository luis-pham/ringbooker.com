import type { ImportedServiceSuggestion, ImportField, ImportSourceType, ImportSuggestions, PagePreview } from './types';
import type { GooglePlacesSuggestion } from './google-places';
import type { LlmImportExtraction } from './types';
import { mergeImportSuggestions } from './merge';

const CURRENCY = 'USD';
const PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/;
const SERVICE_LINE_RE = /^(.{3,80}?)(?:\s+[—-]\s+|\s+)(?:from|starting at|starts at)?\s*\$\s?(\d{2,4})(?:.*?(\d{2,3})\s?(?:min|minutes))?/i;

const DAY_ALIASES: Record<string, string> = {
  mo: 'mon', mon: 'mon', monday: 'mon',
  tu: 'tue', tue: 'tue', tues: 'tue', tuesday: 'tue',
  we: 'wed', wed: 'wed', wednesday: 'wed',
  th: 'thu', thu: 'thu', thur: 'thu', thurs: 'thu', thursday: 'thu',
  fr: 'fri', fri: 'fri', friday: 'fri',
  sa: 'sat', sat: 'sat', saturday: 'sat',
  su: 'sun', sun: 'sun', sunday: 'sun',
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function field<T>(value: T | null, confidence: number, source: string | null): ImportField<T> { return { value, confidence: value === null ? 0 : confidence, source: value === null ? null : source }; }

export function inferGroup(name: string): string {
  const lower = name.toLowerCase();
  if (/manicure/.test(lower)) return 'Manicure';
  if (/pedicure/.test(lower)) return 'Pedicure';
  if (/acrylic|extension|dip powder|nail/.test(lower)) return 'Acrylics / Extensions';
  if (/balayage|highlight|root|color|colour/.test(lower)) return 'Hair Color';
  if (/haircut|blowout|keratin|hair/.test(lower)) return 'Haircuts';
  if (/wax/.test(lower)) return 'Waxing';
  if (/massage/.test(lower)) return 'Massage';
  if (/facial|hydrafacial|peel/.test(lower)) return 'Facials';
  if (/botox|dysport|filler|inject/.test(lower)) return 'Injectables';
  if (/laser/.test(lower)) return 'Laser';
  if (/lash|brow|eyebrow/.test(lower)) return 'Brows & Lashes';
  return 'General Services';
}

export function inferPrimaryType(text: string): string | null {
  const lower = text.toLowerCase();
  if (/botox|injectable|med spa|medical spa|laser/.test(lower)) return 'med_spa';
  if (/nail|manicure|pedicure/.test(lower)) return 'nail_salon';
  if (/hair|balayage|haircut|salon/.test(lower)) return 'hair_salon';
  if (/spa|massage|facial|waxing/.test(lower)) return 'day_spa';
  return null;
}

function dayKey(value: string): string | null {
  const cleaned = value.toLowerCase().replace(/^https?:\/\/schema\.org\//, '').replace(/[^a-z]/g, '');
  return DAY_ALIASES[cleaned] ?? DAY_ALIASES[cleaned.slice(0, 3)] ?? DAY_ALIASES[cleaned.slice(0, 2)] ?? null;
}

function expandDays(start: string, end?: string | null): string[] {
  if (!end || start === end) return [start];
  const startIndex = DAY_ORDER.indexOf(start);
  const endIndex = DAY_ORDER.indexOf(end);
  if (startIndex < 0 || endIndex < 0) return [start];
  if (startIndex <= endIndex) return DAY_ORDER.slice(startIndex, endIndex + 1);
  return [...DAY_ORDER.slice(startIndex), ...DAY_ORDER.slice(0, endIndex + 1)];
}

function normalizeTime(raw: string, isEnd = false): string | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && isEnd && hour >= 1 && hour <= 8) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function applyHoursLine(hours: Record<string, unknown>, line: string): void {
  const compact = line.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
  const closedPrefix = compact.match(/^(closed)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/i);
  const closedSuffix = compact.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b\s*:?,?\s*(closed)\b/i);
  const closedDay = closedPrefix ? dayKey(closedPrefix[2]) : closedSuffix ? dayKey(closedSuffix[1]) : null;
  if (closedDay) {
    hours[closedDay] = { closed: true };
    return;
  }
  const dayName = '(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)';
  const time = '(\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)';
  const match = compact.match(new RegExp(`^${dayName}(?:\\s*(?:-|to)\\s*${dayName})?\\s*:?,?\\s*${time}\\s*(?:-|to)\\s*${time}`, 'i'));
  if (!match) return;
  const start = dayKey(match[1]);
  const end = dayKey(match[2] ?? '');
  const open = normalizeTime(match[3], false);
  const close = normalizeTime(match[4], true);
  if (!start || !open || !close) return;
  for (const key of expandDays(start, end)) hours[key] = { open, close };
}

function parseHoursText(lines: string[]): Record<string, unknown> | null {
  const hours: Record<string, unknown> = {};
  for (const line of lines) {
    for (const part of line.split(/(?:\n|;|\|)/).map((item) => item.trim()).filter(Boolean)) applyHoursLine(hours, part);
  }
  return Object.keys(hours).length ? hours : null;
}

function flattenJsonLd(items: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const graph = Array.isArray(raw['@graph']) ? raw['@graph'] : [raw];
    for (const node of graph) if (node && typeof node === 'object') out.push(node as Record<string, unknown>);
  }
  return out;
}

function schemaDays(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [input];
  return values.map((value) => (typeof value === 'string' ? dayKey(value) : null)).filter((value): value is string => Boolean(value));
}

export function extractHoursFromJsonLd(previews: PagePreview[]): ImportField<Record<string, unknown>> | null {
  const hours: Record<string, unknown> = {};
  const textLines: string[] = [];
  for (const node of flattenJsonLd(previews.flatMap((preview) => preview.jsonLd))) {
    const specs = node.openingHoursSpecification;
    const specList = Array.isArray(specs) ? specs : specs ? [specs] : [];
    for (const spec of specList) {
      if (!spec || typeof spec !== 'object') continue;
      const raw = spec as Record<string, unknown>;
      const open = typeof raw.opens === 'string' ? normalizeTime(raw.opens) : null;
      const close = typeof raw.closes === 'string' ? normalizeTime(raw.closes, true) : null;
      if (!open || !close) continue;
      for (const key of schemaDays(raw.dayOfWeek)) hours[key] = { open, close };
    }
    const openingHours = node.openingHours;
    if (typeof openingHours === 'string') textLines.push(openingHours);
    if (Array.isArray(openingHours)) textLines.push(...openingHours.filter((item): item is string => typeof item === 'string'));
  }
  const parsed = parseHoursText(textLines);
  const merged = { ...(parsed ?? {}), ...hours };
  return Object.keys(merged).length ? field(merged, 0.9, 'JSON-LD') : null;
}

export function extractHoursFromText(text: string): ImportField<Record<string, unknown>> | null {
  const normalized = text.replace(/[\u2013\u2014]/g, '-');
  const dayPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b[^.;\n]{0,80}?(?:closed|\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  const closedPrefixPattern = /closed\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi;
  const segments = normalized.split(/[.;\n]+/).map((segment) => segment.trim()).filter(Boolean);
  const lines = segments.flatMap((segment) => [...(segment.match(dayPattern) ?? []), ...(segment.match(closedPrefixPattern) ?? [])]);
  const parsed = parseHoursText(lines);
  return parsed ? field(parsed, 0.72, 'Website') : null;
}

export function inferTimezoneFromAddress(address?: string | null): ImportField<string> | null {
  if (!address) return null;
  const mappings: Array<{ timezone: string; pattern: RegExp }> = [
    { timezone: 'America/Los_Angeles', pattern: /\b(california|ca|los angeles|san francisco|san diego|san jose|sacramento|washington|oregon|nevada|seattle|portland|las vegas)\b/i },
    { timezone: 'America/New_York', pattern: /\b(new york|ny|new jersey|nj|florida|fl|massachusetts|ma|pennsylvania|pa|washington dc|district of columbia|boston|miami|orlando|philadelphia)\b/i },
    { timezone: 'America/Chicago', pattern: /\b(texas|tx|illinois|il|chicago|dallas|houston|austin|minnesota|mn|wisconsin|wi)\b/i },
    { timezone: 'America/Denver', pattern: /\b(colorado|co|denver|utah|ut|arizona|az|phoenix|new mexico|nm)\b/i },
  ];
  const match = mappings.find((item) => item.pattern.test(address));
  return match ? field(match.timezone, 0.72, 'Address') : null;
}

export function extractServicesFromText(text: string, source: string): ImportedServiceSuggestion[] {
  const services = new Map<string, ImportedServiceSuggestion>();
  for (const rawLine of text.split(/[\n•]+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    const line = rawLine.slice(0, 180);
    const match = line.match(SERVICE_LINE_RE);
    const hasServiceKeyword = /manicure|pedicure|balayage|highlight|haircut|massage|facial|wax|botox|filler|laser|lash|brow|treatment/i.test(line);
    if (!match && !hasServiceKeyword) continue;
    const name = (match?.[1] ?? line.replace(/\$.*$/, '')).replace(/^(service|treatment|menu):?/i, '').trim();
    if (name.length < 3 || name.length > 90) continue;
    const key = `${inferGroup(name).toLowerCase()}::${name.toLowerCase()}`;
    if (services.has(key)) continue;
    const priceText = match?.[2];
    const lower = line.toLowerCase();
    services.set(key, {
      categoryName: inferGroup(name),
      name,
      priceAmount: priceText ? Number(priceText) : null,
      priceCurrency: CURRENCY,
      priceType: /from|starting at|starts at/.test(lower) ? 'from' : priceText ? 'fixed' : /consult/.test(lower) ? 'consultation' : 'varies',
      durationMinutes: match?.[3] ? Number(match[3]) : null,
      aliases: aliasFor(name),
      bookable: true,
      source,
      confidence: match ? 0.82 : 0.62,
    });
  }
  return [...services.values()].slice(0, 80);
}

function aliasFor(name: string): string[] {
  const lower = name.toLowerCase();
  const aliases: string[] = [];
  if (lower.includes('gel manicure')) aliases.push('gel mani', 'shellac');
  if (lower.includes('pedicure')) aliases.push('pedi');
  return aliases;
}

function jsonLdFacts(previews: PagePreview[]) {
  const facts: { name?: string; phone?: string; address?: string; hours?: ImportField<Record<string, unknown>> } = {};
  for (const obj of flattenJsonLd(previews.flatMap((preview) => preview.jsonLd))) {
    if (!facts.name && typeof obj.name === 'string') facts.name = obj.name;
    if (!facts.phone && typeof obj.telephone === 'string') facts.phone = obj.telephone;
    if (!facts.address && obj.address && typeof obj.address === 'object') {
      const addr = obj.address as Record<string, unknown>;
      facts.address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter((v): v is string => typeof v === 'string').join(', ');
    }
  }
  facts.hours = extractHoursFromJsonLd(previews) ?? undefined;
  return facts;
}

export function buildSuggestions(input: { sourceUrl: string; sourceType: ImportSourceType; previews: PagePreview[]; googlePlaces?: GooglePlacesSuggestion | null; llmExtraction?: LlmImportExtraction | null }): ImportSuggestions {
  const allText = input.previews.map((p) => `${p.title}\n${p.h1}\n${p.h2s.join('\n')}\n${p.firstTextChars}`).join('\n');
  const facts = jsonLdFacts(input.previews);
  const services = input.previews.flatMap((p) => extractServicesFromText(`${p.h1}\n${p.h2s.join('\n')}\n${p.firstTextChars}`, p.url));
  const deduped = [...new Map(services.map((s) => [`${s.categoryName}:${s.name}`.toLowerCase(), s])).values()];
  const websitePhone = facts.phone ?? allText.match(PHONE_RE)?.[0] ?? null;
  const websiteHours = facts.hours ?? extractHoursFromText(allText);
  const staticAddress = facts.address ?? null;
  const staticName = facts.name ?? input.previews[0]?.h1 ?? input.previews[0]?.title ?? null;
  const websitePrimaryType = inferPrimaryType(allText);
  const bookingLink = input.previews.flatMap((p) => p.links).find((link) => /book|appointment|schedule|reserve|vagaro|booksy|fresha|glossgenius|styleseat/i.test(`${link.text} ${link.href}`))?.href ?? null;
  return mergeImportSuggestions({
    staticFacts: {
      sourceUrl: input.sourceUrl,
      sourceType: input.sourceType,
      name: field(staticName, facts.name ? 0.92 : staticName ? 0.68 : 0, facts.name ? 'JSON-LD' : staticName ? 'Website' : null),
      primaryType: field(websitePrimaryType, websitePrimaryType ? 0.74 : 0, websitePrimaryType ? 'Website' : null),
      phone: field(websitePhone, facts.phone ? 0.9 : websitePhone ? 0.7 : 0, facts.phone ? 'JSON-LD' : websitePhone ? 'Website' : null),
      website: field(input.sourceUrl, 0.95, 'User'),
      address: field(staticAddress, staticAddress ? 0.86 : 0, staticAddress ? 'JSON-LD' : null),
      timezone: inferTimezoneFromAddress(staticAddress)?.value ? inferTimezoneFromAddress(staticAddress)! : field<string>(null, 0, null),
      hours: websiteHours ?? field<Record<string, unknown>>(null, 0, null),
      services: deduped,
      bookingUrl: field(bookingLink, bookingLink ? 0.8 : 0, bookingLink ? 'Website' : null),
      languages: [],
      warnings: [],
    },
    googlePlaces: input.googlePlaces,
    llm: input.llmExtraction,
  });
}
