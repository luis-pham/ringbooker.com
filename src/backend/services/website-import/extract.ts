import type {
  BookingSetupSuggestion,
  FaqSuggestion,
  ImportedServiceSuggestion,
  ImportField,
  ImportSourceType,
  ImportSuggestions,
  PagePreview,
  PolicySuggestion,
  PromotionSuggestion,
  StaffSuggestion,
} from './types';
import type { GooglePlacesSuggestion } from './google-places';
import type { LlmImportExtraction } from './types';
import { normalizePhoneForStorage, phoneComparableDigits } from '@/lib/phone-number';
import { mergeImportSuggestions } from './merge';

const CURRENCY = 'USD';
const PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\d)/;
const SERVICE_LINE_RE = /^(.{3,80}?)(?:\s+[—-]\s+|\s+)(?:from|starting at|starts at)?\s*\$\s?(\d{2,4})(?:.*?(\d{2,3})\s?(?:min|minutes))?/i;
const SERVICE_LINE_NO_DOLLAR_RE = /^(.{3,80}?)\s+[—-]\s+(\d{2,4})(?:\s*(and\s+up|up|\+))?(?:.*?(\d{2,3})\s?(?:min|minutes))?$/i;
const COMPRESSED_PRICE_SERVICE_RE = /([A-Z][^$\n]{2,100}?)\s*(?:from|starting at|starts at)?\s*\$\s?(\d{2,4})(\+)?/g;
const DURATION_HEADER_RE = /\b(\d{1,3})\s*(?:min|mins|minute|minutes)\+?\b/gi;
const SERVICE_GROUP_HEADINGS = [
  'Styling Services',
  'Color Services',
  'Hair Specialties',
  'Hair Services',
  'Salon Services',
  'Nail Services',
  'Spa Services',
  'Massage Services',
  'Facial Services',
  'Facial/Hydrafacial',
  'Facials',
  'Waxing Services',
  'Waxing',
  'Body Treatments',
  'Injectables',
  'Laser Services',
  'Skin Treatments',
  'Cut',
  'Color',
  'Extensions',
  'Style',
  'Styling',
  'Blowout',
  'Treatments',
  'Haircuts',
  'Smoothing/Straightening Treatments',
  'Hair Extensions',
  'Signature Ritual Deep Conditioning Treatments',
];
const SERVICE_MENU_SOURCE_RE = /\b(source|skip to content|open menu|close menu|copyright|social media|get in touch|book now|quick view|home|about|contact|careers|blog|shop|cart|folder:|back|policy|policies|faq|questions?|located|walk-ins?)\b/i;
const ECOMMERCE_CONTEXT_RE = /\b(shop|store|products?|collections?|cart|checkout|add to cart|retail|merch|gift cards?)\b/i;
const SERVICE_AREA_LINK_RE = /\/(?:contact-us\/)?service-areas?\/?$|\/areas-of-service\//i;
const SERVICE_TAXONOMY_LINK_RE = /\/(?:service[_-]?type|service[_-]?categor(?:y|ies))\//i;

function normalizePriceSeparators(text: string): string {
  return text
    // Dot leaders: "Women's Cut........$55" → "Women's Cut $55"
    .replace(/([A-Za-z0-9'''])\s*\.{3,}\s*(\$|\bfrom\b|\bstarting\b)/gi, '$1 $2')
    // Middle dot leaders (U+00B7): "Haircut · · · $55" → "Haircut $55"
    .replace(/([A-Za-z0-9'''])\s*(?:·\s*){2,}(\$)/g, '$1 $2')
    // Parenthesized prices: "Cut ($55+)" or "Cut (from $55)" → "Cut $55+"
    .replace(/\((?:from\s+)?(\$\s?\d{2,4}\+?)\)/g, '$1');
}

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
  if (/hair\s*extension|extensions?.*hair/.test(lower)) return 'Hair Extensions';
  if (/acrylic|extension|dip powder|nail/.test(lower)) return 'Acrylics / Extensions';
  if (/\b(lash|brow|eyebrow)\b/.test(lower)) return 'Brows & Lashes';
  if (/\b(wax|bikini|brazilian|half leg|full leg|lip)\b/.test(lower)) return 'Waxing';
  if (/balayage|highlight|lightening|tint|retouch|root|color|colour/.test(lower)) return 'Hair Color';
  if (/haircut|\bcut\b|blowout|blow\s*out|styling|updo|keratin|hair/.test(lower)) return 'Haircuts';
  if (/massage/.test(lower)) return 'Massage';
  if (/facial|hydrafacial|peel/.test(lower)) return 'Facials';
  if (/botox|dysport|filler|inject/.test(lower)) return 'Injectables';
  if (/laser/.test(lower)) return 'Laser';
  if (/makeup|make-up/.test(lower)) return 'Makeup';
  return 'General Services';
}

export function inferPrimaryType(text: string): string | null {
  const lower = text.toLowerCase();
  const count = (patterns: RegExp[]) => patterns.reduce((sum, pattern) => sum + (lower.match(pattern)?.length ?? 0), 0);
  const scores = {
    med_spa: count([/\b(botox|injectable|injectables|filler|med spa|medical spa|laser)\b/g]) * 3,
    hair_salon: count([/\b(hair|haircut|haircuts|color|colour|balayage|blowout|styling|stylist|extensions|salon|aveda)\b/g]),
    nail_salon: count([/\b(nail|nails|manicure|pedicure|shellac|acrylic|dip powder)\b/g]),
    day_spa: count([/\b(spa|massage|facial|facials|waxing|wax)\b/g]),
  };
  if (scores.med_spa >= 3 && scores.med_spa >= scores.hair_salon) return 'med_spa';
  if (scores.hair_salon >= 2 && scores.hair_salon >= scores.nail_salon * 1.2 && scores.hair_salon >= scores.day_spa) return 'hair_salon';
  if (scores.nail_salon >= 2 && scores.nail_salon > scores.hair_salon) return 'nail_salon';
  if (scores.day_spa >= 2 && scores.day_spa > scores.hair_salon) return 'day_spa';
  if (scores.hair_salon > 0) return 'hair_salon';
  if (scores.nail_salon > 0) return 'nail_salon';
  if (scores.day_spa > 0) return 'day_spa';
  return null;
}

// Languages a salon explicitly advertises it speaks — these are what the AI
// receptionist must be able to handle, distinct from the site's own UI language.
const SPOKEN_LANGUAGE_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Spanish', pattern: /\b(?:se\s+habla\s+español|hablamos\s+español|spanish\s+spoken|we\s+(?:also\s+)?speak\s+spanish)\b/i },
  { name: 'Vietnamese', pattern: /\b(?:vietnamese\s+spoken|we\s+(?:also\s+)?speak\s+vietnamese|nói\s+tiếng\s+việt)\b/i },
  { name: 'Mandarin', pattern: /\b(?:mandarin\s+spoken|chinese\s+spoken|we\s+(?:also\s+)?speak\s+(?:mandarin|chinese))\b/i },
  { name: 'Korean', pattern: /\b(?:korean\s+spoken|we\s+(?:also\s+)?speak\s+korean)\b/i },
  { name: 'Russian', pattern: /\b(?:russian\s+spoken|we\s+(?:also\s+)?speak\s+russian)\b/i },
  { name: 'French', pattern: /\b(?:french\s+spoken|we\s+(?:also\s+)?speak\s+french)\b/i },
  { name: 'Tagalog', pattern: /\b(?:tagalog\s+spoken|filipino\s+spoken|we\s+(?:also\s+)?speak\s+(?:tagalog|filipino))\b/i },
];

export function extractLanguages(text: string): Array<ImportField<string>> {
  const found = SPOKEN_LANGUAGE_PATTERNS
    .filter((lang) => lang.pattern.test(text))
    .map((lang) => field(lang.name, 0.7, 'Website'));
  // A salon that advertises an extra language still serves English-speaking callers.
  if (found.length) found.unshift(field('English', 0.8, 'Website'));
  return found;
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
  const match = compact.match(new RegExp(`^${dayName}(?:\\s*(?:-|to|&|and|,|/)\\s*${dayName})?\\s*:?,?\\s*${time}\\s*(?:-|to)\\s*${time}`, 'i'));
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

function parseColumnarHoursText(text: string): Record<string, unknown> | null {
  const hoursIndex = text.search(/\b(?:business\s+)?hours(?=\s|\d|$)/i);
  if (hoursIndex < 0) return null;
  const windowText = text.slice(hoursIndex, hoursIndex + 1200).replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');
  const timeRangePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi;
  const dayPattern = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/gi;
  const ranges = [...windowText.matchAll(timeRangePattern)].map((match) => ({
    open: normalizeTime(match[1], false),
    close: normalizeTime(match[2], true),
    index: match.index ?? 0,
  })).filter((range) => range.open && range.close);
  const days = [...windowText.matchAll(dayPattern)].map((match) => ({
    day: dayKey(match[1]),
    index: match.index ?? 0,
  })).filter((item): item is { day: string; index: number } => Boolean(item.day));
  if (ranges.length < 2 || days.length < 2) return null;
  const hours: Record<string, unknown> = {};
  const count = Math.min(ranges.length, days.length);
  const timesBeforeDays = ranges[0].index < days[0].index;
  const plausibleColumnLayout = timesBeforeDays || days[0].index < ranges[0].index;
  if (!plausibleColumnLayout) return null;
  for (let i = 0; i < count; i += 1) {
    const range = ranges[i];
    const day = days[i]?.day;
    if (day && range.open && range.close) hours[day] = { open: range.open, close: range.close };
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
  const normalized = text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2');
  const dayPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b[^.;\n]{0,80}?(?:closed|\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:-|to)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/gi;
  const closedPrefixPattern = /closed\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b(?!\s*\d)/gi;
  const segments = normalized.split(/[.;\n]+/).map((segment) => segment.trim()).filter(Boolean);
  const lines = segments.flatMap((segment) => {
    const matched = [...(segment.match(dayPattern) ?? [])];
    matched.push(...(segment.match(closedPrefixPattern) ?? []));
    return matched;
  });
  const parsed = parseHoursText(lines) ?? parseColumnarHoursText(normalized);
  return parsed ? field(parsed, 0.72, 'Website') : null;
}

function cleanExtractedAddress(value: string): string | null {
  const cleaned = value
    .replace(/\s*(?:Telephone|Phone|Email|Hours|Instagram|Facebook|TikTok|Book Now)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,\s+/g, ', ')
    .trim();
  return /\b\d{5}(?:-\d{4})?\b/.test(cleaned) && cleaned.length >= 12 ? cleaned : null;
}

function extractAddressFromText(text: string): string | null {
  const normalized = text
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  const labeled = normalized.match(/\bAddress\s*:?\s*(.{8,180}?\b\d{5}(?:-\d{4})?)(?=\s*(?:Telephone|Phone|Email|Hours|Instagram|Facebook|TikTok|Book Now|$))/i);
  if (labeled?.[1]) {
    const address = cleanExtractedAddress(labeled[1]);
    if (address) return address;
  }
  const generic = normalized.match(/\b\d{1,6}\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b.{0,90}?\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\s+\d{5}(?:-\d{4})?\b/i);
  return generic?.[0] ? cleanExtractedAddress(generic[0]) : null;
}

export function inferTimezoneFromAddress(address?: string | null): ImportField<string> | null {
  if (!address) return null;
  const mappings: Array<{ timezone: string; pattern: RegExp }> = [
    { timezone: 'America/Los_Angeles', pattern: /\b(california|ca|los angeles|san francisco|san diego|san jose|sacramento|washington|oregon|nevada|seattle|portland|las vegas)\b/i },
    { timezone: 'America/New_York', pattern: /\b(new york|ny|new jersey|nj|florida|fl|massachusetts|ma|pennsylvania|pa|ohio|oh|washington dc|district of columbia|boston|miami|orlando|philadelphia|cleveland|columbus)\b/i },
    { timezone: 'America/Chicago', pattern: /\b(texas|tx|illinois|il|chicago|dallas|houston|austin|minnesota|mn|wisconsin|wi)\b/i },
    { timezone: 'America/Denver', pattern: /\b(colorado|co|denver|utah|ut|arizona|az|phoenix|new mexico|nm)\b/i },
  ];
  const match = mappings.find((item) => item.pattern.test(address));
  return match ? field(match.timezone, 0.72, 'Address') : null;
}

export function extractServicesFromText(text: string, source: string): ImportedServiceSuggestion[] {
  text = normalizePriceSeparators(text);
  const services = new Map<string, ImportedServiceSuggestion>();

  const addService = (input: {
    name: string;
    description?: string | null;
    priceText?: string | null;
    priceAmount?: number | null;
    priceType?: ImportedServiceSuggestion['priceType'];
    durationText?: string | null;
    durationMinutes?: number | null;
    group?: string | null;
    bookingNotes?: string | null;
    confidence: number;
  }) => {
    const name = collapseRepeatedServiceName(cleanServiceName(input.name));
    if (name.length < 3 || name.length > 90) return;
    if (/\$/.test(name)) return;
    // A real service name never contains an embedded price token ("Lip 425+ Brow and Lip")
    // — that is a mangled price-table parse where the leading "$" was dropped.
    if (/\d{2,}\s*\+/.test(name)) return;
    if (/\b\d{1,3}\s*(?:min|mins|minutes|hour|hours|hr)\+?\s*$/i.test(name)) return;
    if (/^[a-z]\s+\w/.test(name)) return;
    if (SERVICE_MENU_SOURCE_RE.test(name)) return;
    if (isStylistPricingRowName(name)) return;
    if ((name.match(/\b\d{1,3}\s*(?:min|mins|minutes|hour|hours|hr)\b/gi)?.length ?? 0) >= 2) return;
    if (/^(this is|service includes|includes|perfect for|ideal for|not sure|our service|pricing is based|you|your|our|we|at|experience|discover|looking|relax,)\b/i.test(name)) return;
    const categoryName = input.group?.trim() || inferGroup(name);
    const key = `${categoryName.toLowerCase()}::${name.toLowerCase()}`;
    const priceAmount = input.priceAmount ?? (input.priceText ? Number(input.priceText) : null);
    const next: ImportedServiceSuggestion = {
      categoryName,
      name,
      description: input.description ?? null,
      priceAmount,
      priceCurrency: CURRENCY,
      priceType: input.priceType ?? (priceAmount ? 'fixed' : /consult/i.test(name) ? 'consultation' : 'varies'),
      durationText: input.durationText ?? (input.durationMinutes ? `${input.durationMinutes} min` : null),
      durationMinutes: input.durationMinutes ?? null,
      aliases: aliasFor(name),
      bookingNotes: input.bookingNotes ?? null,
      bookable: true,
      source,
      confidence: input.confidence,
      needsReview: input.confidence < 0.7 || (!priceAmount && !input.durationMinutes && !input.durationText),
    };
    const existing = services.get(key);
    if (existing) {
      const existingEvidence = (existing.priceAmount ? 2 : 0) + (existing.durationMinutes || existing.durationText ? 1 : 0) + existing.confidence;
      const nextEvidence = (next.priceAmount ? 2 : 0) + (next.durationMinutes || next.durationText ? 1 : 0) + next.confidence;
      if (nextEvidence <= existingEvidence) return;
    }
    services.set(key, next);
  };

  const matrixServices = extractTextServiceMatrixServices(text, source);
  for (const item of matrixServices) {
    const key = `${item.categoryName.toLowerCase()}::${item.name.toLowerCase()}`;
    const existing = services.get(key);
    if (!existing || (item.variants?.length ?? 0) > (existing.variants?.length ?? 0)) services.set(key, item);
  }

  for (const item of extractBulletServiceRows(text)) {
    addService({ ...item, confidence: 0.72 });
  }

  for (const item of extractStylistPricingServices(text)) {
    addService({ ...item, confidence: 0.86 });
  }

  for (const item of extractGroupedMenuListServices(text)) {
    addService({ ...item, confidence: 0.68 });
  }

  for (const item of extractDynamicServiceMenuListServices(text)) {
    addService({ ...item, confidence: item.confidence });
  }

  for (const rawLine of text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    const match = rawLine.match(SERVICE_LINE_RE);
    const noDollarMatch = match ? null : rawLine.match(SERVICE_LINE_NO_DOLLAR_RE);
    if (!match && !noDollarMatch) continue;
    const lower = rawLine.toLowerCase();
    const parsed = splitServiceHeadingPrefix((match?.[1] ?? noDollarMatch?.[1]) ?? '');
    const durationValue = match?.[3] ?? noDollarMatch?.[4];
    addService({
      name: parsed.name,
      priceText: match?.[2] ?? noDollarMatch?.[2],
      priceType: /from|starting|starts at|\+|and up|\bup\b/.test(lower) ? 'from' : 'fixed',
      durationText: durationValue ? `${Number(durationValue)} min` : null,
      durationMinutes: durationValue ? Number(durationValue) : null,
      group: parsed.group,
      confidence: parsed.group ? 0.88 : 0.84,
    });
  }

  const compressedText = cleanCompressedServiceText(text);
  if (matrixServices.length === 0) {
    let currentCompressedGroup: string | null = null;
    for (const match of compressedText.matchAll(COMPRESSED_PRICE_SERVICE_RE)) {
      const parsed = splitServiceHeadingPrefix(match[1]);
      if (parsed.group) currentCompressedGroup = parsed.group;
      const lower = match[0].toLowerCase();
      addService({
        name: parsed.name,
        priceText: match[2],
        priceType: match[3] || /from|starting at|starts at/.test(lower) ? 'from' : 'fixed',
        group: parsed.group ?? currentCompressedGroup,
        confidence: parsed.group ? 0.86 : 0.8,
      });
    }
  }

  for (const rawLine of compressedText.split(/[\n•]+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    const line = rawLine.slice(0, 180);
    const match = line.match(SERVICE_LINE_RE);
    const noDollarMatch = match ? null : line.match(SERVICE_LINE_NO_DOLLAR_RE);
    const hasServiceKeyword = /manicure|pedicure|balayage|highlight|haircut|massage|facial|wax|botox|filler|laser|lash|brow|treatment/i.test(line);
    if (!match && !noDollarMatch && !hasServiceKeyword) continue;
    const priceText = match?.[2] ?? noDollarMatch?.[2];
    const lower = line.toLowerCase();
    const parsed = splitServiceHeadingPrefix(match?.[1] ?? noDollarMatch?.[1] ?? line.replace(/\$.*$/, ''));
    const durationValue = match?.[3] ?? noDollarMatch?.[4];
    addService({
      name: parsed.name,
      priceText,
      priceType: /from|starting|starts at|\+|and up|\bup\b/.test(lower) ? 'from' : priceText ? 'fixed' : /consult/.test(lower) ? 'consultation' : 'varies',
      durationText: durationValue ? `${Number(durationValue)} min` : null,
      durationMinutes: durationValue ? Number(durationValue) : null,
      group: parsed.group,
      confidence: match || noDollarMatch ? 0.82 : 0.62,
    });
  }
  return [...services.values()].slice(0, 80);
}

function durationHeadersFromLine(value: string): Array<{ durationText: string; durationMinutes: number }> {
  return [...value.matchAll(DURATION_HEADER_RE)]
    .map((match) => {
      const minutes = Number(match[1]);
      return Number.isFinite(minutes) && minutes > 0
        ? { durationText: `${minutes} min${/\+/.test(match[0]) ? '+' : ''}`, durationMinutes: minutes }
        : null;
    })
    .filter((item): item is { durationText: string; durationMinutes: number } => Boolean(item));
}

function isDurationOnlyLine(value: string): boolean {
  return /^\s*\d{1,3}\s*(?:min|mins|minute|minutes)\+?\s*$/i.test(value);
}

function parseMatrixPriceCell(value: string): { priceAmount: number | null; priceType: ImportedServiceSuggestion['priceType'] } | null {
  const text = value.trim();
  if (!text || /^[-–—]+$/.test(text)) return null;
  if (/consult/i.test(text)) return { priceAmount: null, priceType: 'consultation' };
  if (/varies|call/i.test(text)) return { priceAmount: null, priceType: 'varies' };
  const match = text.match(/\$?\s*(\d{2,4})(?:\.\d{1,2})?\s*\+?/);
  if (!match) return null;
  const priceAmount = Number(match[1]);
  // A single duration-priced salon service variant above ~$2000 is almost always a
  // mangled parse (e.g. "$140" read as "4140"). Drop the bogus price rather than show it.
  if (!Number.isFinite(priceAmount) || priceAmount > 2000) return null;
  return {
    priceAmount,
    priceType: /from|starting|starts|\+/i.test(text) ? 'from' : 'fixed',
  };
}

function isLikelyTextMatrixServiceName(value: string): boolean {
  const cleaned = cleanServiceName(value);
  if (cleaned.length < 3 || cleaned.length > 80) return false;
  if (SERVICE_MENU_SOURCE_RE.test(cleaned) || ECOMMERCE_CONTEXT_RE.test(cleaned)) return false;
  if (isDurationOnlyLine(cleaned) || /^\$?\s*\d/.test(cleaned)) return false;
  if (/[.!?]$/.test(cleaned)) return false;
  if (/^(your|our|we|at|experience|relax,|discover|looking)\b/i.test(cleaned)) return false;
  return /[A-Za-z]/.test(cleaned);
}

function currentMatrixGroupFromLine(line: string, currentGroup: string | null): string | null {
  const cleaned = cleanServiceName(line);
  if (/^body treatments?$/i.test(cleaned)) return 'Body Treatments';
  if (/^waxing$/i.test(cleaned)) return 'Waxing';
  if (/^facials?|hydrafacial$/i.test(cleaned)) return 'Facials';
  if (/^massage(?:\s+therapy)?$/i.test(cleaned)) return currentGroup ?? 'Massage';
  if (isServiceMenuGroupHeading(cleaned) && !/therapy$/i.test(cleaned)) return cleaned;
  return currentGroup;
}

/** Service nouns — a matrix row label containing one already names a concrete service. */
const MATRIX_SERVICE_NOUN_RE =
  /\b(massage|facial|hydrafacial|treatment|wax|waxing|manicure|pedicure|reflexology|cut|haircut|colou?r|highlights?|blowout|blow[ -]?dry|peel|wrap|scrub|therapy|extension|tint|balayage|lash(?:es)?)\b/i;

/**
 * Category keyword → the service-type word appended to a bare matrix row label.
 * First match wins. Only categories whose matrix rows are commonly bare modifiers
 * (e.g. Massage "Relaxing", Manicure "Deluxe", Lashes "Volume") are listed here.
 */
const MATRIX_CATEGORY_TYPE_WORDS: Array<[RegExp, string]> = [
  [/massage/i, 'Massage'],
  [/facial|hydrafacial/i, 'Facial'],
  [/manicure/i, 'Manicure'],
  [/pedicure/i, 'Pedicure'],
  [/haircut/i, 'Haircut'],
  [/colou?r/i, 'Color'],
  [/wax(?:ing)?/i, 'Wax'],
  [/lash(?:es)?/i, 'Lashes'],
  [/blowout|blow[ -]?dry/i, 'Blowout'],
];

/**
 * Matrix-table rows are often bare modifiers ("Relaxing", "Hot Stone") under a typed
 * category ("Massage Therapy"). Append the category's service-type word so the name
 * reads as a real service ("Relaxing Massage") — but only when the row label carries
 * no service noun of its own (leaves "Add Reflexology", "Stress-Fix Massage" untouched).
 */
function qualifyMatrixServiceName(name: string, categoryName: string): string {
  if (MATRIX_SERVICE_NOUN_RE.test(name)) return name;
  for (const [categoryRe, typeWord] of MATRIX_CATEGORY_TYPE_WORDS) {
    if (categoryRe.test(categoryName)) return `${name} ${typeWord}`;
  }
  return name;
}

function buildMatrixService(params: {
  source: string;
  group: string | null;
  name: string;
  headers: Array<{ durationText: string; durationMinutes: number }>;
  cells: string[];
  description?: string | null;
}): ImportedServiceSuggestion | null {
  const parsedName = cleanServiceName(params.name.replace(/[-–—]+$/g, ''));
  if (!isLikelyTextMatrixServiceName(parsedName)) return null;
  const variants = params.headers.flatMap((header, index) => {
    const price = parseMatrixPriceCell(params.cells[index] ?? '');
    if (!price) return [];
    return [{
      label: header.durationText,
      durationMinutes: header.durationMinutes,
      durationText: header.durationText,
      priceAmount: price.priceAmount,
      priceCurrency: CURRENCY,
      priceType: price.priceType,
      sortOrder: index,
      notes: null,
    }];
  });
  if (variants.length === 0) return null;
  const categoryName = params.group || inferGroup(parsedName);
  return {
    categoryName,
    name: qualifyMatrixServiceName(parsedName, categoryName),
    description: params.description && params.description.length <= 240 ? params.description : null,
    priceAmount: null,
    priceCurrency: CURRENCY,
    priceType: variants.some((variant) => variant.priceType === 'from') ? 'from' : 'varies',
    durationText: null,
    durationMinutes: null,
    aliases: aliasFor(parsedName),
    bookingNotes: null,
    bookable: true,
    variants,
    source: params.source,
    sourceHint: 'service_matrix_table',
    confidence: 0.78,
    needsReview: true,
    evidenceSnippet: `${categoryName}: ${parsedName} ${variants.map((variant) => `${variant.durationText} ${variant.priceAmount ? `$${variant.priceAmount}` : variant.priceType}`).join(' ')}`.slice(0, 220),
  };
}

function compactMatrixCells(line: string): { name: string; cells: string[] } | null {
  const firstDollar = line.indexOf('$');
  if (firstDollar < 3) return null;
  const beforePrice = line.slice(0, firstDollar);
  const leadingMissingCell = /[-–—]\s*$/.test(beforePrice);
  const name = beforePrice.replace(/[-–—]+$/g, '').trim();
  const priceTokens = [...line.slice(firstDollar).matchAll(/\$\s*\d{2,4}\+?/g)].map((match) => match[0]);
  if (!name || priceTokens.length === 0) return null;
  return { name, cells: leadingMissingCell ? ['-', ...priceTokens] : priceTokens };
}

function extractTextServiceMatrixServices(text: string, source: string): ImportedServiceSuggestion[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const out = new Map<string, ImportedServiceSuggestion>();
  let currentGroup: string | null = null;

  const add = (service: ImportedServiceSuggestion | null) => {
    if (!service) return;
    const key = `${service.categoryName}:${service.name}`.toLowerCase();
    const existing = out.get(key);
    if (!existing || (service.variants?.length ?? 0) > (existing.variants?.length ?? 0)) out.set(key, service);
  };

  for (let i = 0; i < lines.length; i += 1) {
    currentGroup = currentMatrixGroupFromLine(lines[i], currentGroup);
    const inlineHeaders = durationHeadersFromLine(lines[i]);
    const nextInline = lines[i + 1] ?? '';
    const compact = inlineHeaders.length >= 2 ? compactMatrixCells(nextInline) : null;
    if (compact) {
      add(buildMatrixService({ source, group: currentGroup, name: compact.name, headers: inlineHeaders, cells: compact.cells }));
    }

    if (!isDurationOnlyLine(lines[i])) continue;
    const headers: Array<{ durationText: string; durationMinutes: number }> = [];
    let headerEnd = i;
    while (headerEnd < lines.length && isDurationOnlyLine(lines[headerEnd]) && headers.length < 6) {
      headers.push(...durationHeadersFromLine(lines[headerEnd]));
      headerEnd += 1;
    }
    if (headers.length < 2) continue;
    let cursor = headerEnd;
    while (cursor < lines.length) {
      const name = lines[cursor];
      if (durationHeadersFromLine(name).length >= 2 || isServiceMenuGroupHeading(name)) break;
      if (!isLikelyTextMatrixServiceName(name)) {
        cursor += 1;
        continue;
      }
      const cells: string[] = [];
      let consumed = 0;
      for (let j = cursor + 1; j < Math.min(lines.length, cursor + 1 + headers.length + 1); j += 1) {
        const row = lines[j];
        const match = row.match(/^(\d{1,3})\s*(?:min|mins|minute|minutes)\+?\s*(.*)$/i);
        if (!match) break;
        cells.push(match[2]?.trim() || '-');
        consumed += 1;
      }
      if (consumed >= 1) {
        const description = lines[cursor + 1 + consumed] && !/[$]|\b\d{1,3}\s*min\b/i.test(lines[cursor + 1 + consumed])
          ? lines[cursor + 1 + consumed]
          : null;
        add(buildMatrixService({ source, group: currentGroup, name, headers, cells, description }));
        cursor += 1 + consumed + (description ? 1 : 0);
        continue;
      }
      break;
    }
  }

  return [...out.values()].slice(0, 40);
}

function extractServicesFromBlocks(previews: PagePreview[]): ImportedServiceSuggestion[] {
  const services = new Map<string, ImportedServiceSuggestion>();
  const invalidServiceName = (value: string) => /^(?:price\b.*|\d+\s*(?:min|mins|minutes|hour|hours|hr)\+?|\$?\s*\d+|book now|schedule|reserve|appointment|consultation required)$/i.test(value.trim())
    || /^[a-z]\s+\w/.test(value.trim())
    || SERVICE_MENU_SOURCE_RE.test(value)
    || ECOMMERCE_CONTEXT_RE.test(value)
    || /\b(cancellation|refund|privacy|policy|faq|address|directions|contact us)\b/i.test(value);
  for (const preview of previews) {
    for (const block of preview.serviceBlocks ?? []) {
      const parsed = splitServiceHeadingPrefix(block.serviceName);
      const group = block.groupHeading?.trim() || parsed.group || inferGroup(parsed.name);
      const duration = block.durationText ? parseDurationText(block.durationText) : null;
      const priceMatch = block.priceText?.match(/\$?\s*(\d{2,4})/);
      const priceAmount = priceMatch ? Number(priceMatch[1]) : null;
      if (parsed.name.length < 3 || parsed.name.length > 90) continue;
      if (invalidServiceName(parsed.name)) continue;
      const key = `${group}:${parsed.name}`.toLowerCase();
      const blockVariants = (block.variants ?? []).map((variant, index) => ({
        label: variant.label?.trim() || variant.durationText?.trim() || (variant.priceAmount !== null && variant.priceAmount !== undefined ? `$${variant.priceAmount}` : `Option ${index + 1}`),
        durationMinutes: variant.durationMinutes ?? null,
        durationText: variant.durationText ?? (variant.durationMinutes ? `${variant.durationMinutes} min` : null),
        priceAmount: variant.priceAmount ?? null,
        priceCurrency: variant.priceCurrency ?? CURRENCY,
        priceType: variant.priceType ?? 'fixed',
        sortOrder: variant.sortOrder ?? index,
        notes: variant.notes ?? null,
      })).filter((variant) => variant.label || variant.durationText || variant.priceAmount !== null).slice(0, 20);
      if (services.has(key)) {
        const existing = services.get(key);
        if (existing && blockVariants.length) {
          const variantKeys = new Set((existing.variants ?? []).map((variant) => `${variant.durationText ?? variant.label}:${variant.priceAmount ?? ''}:${variant.priceType ?? ''}`.toLowerCase()));
          existing.variants = [
            ...(existing.variants ?? []),
            ...blockVariants.filter((variant) => {
              const variantKey = `${variant.durationText ?? variant.label}:${variant.priceAmount ?? ''}:${variant.priceType ?? ''}`.toLowerCase();
              if (variantKeys.has(variantKey)) return false;
              variantKeys.add(variantKey);
              return true;
            }),
          ].slice(0, 20);
          existing.needsReview = true;
        }
        continue;
      }
      const confidence = Math.max(0.45, Math.min(0.92, block.confidence ?? 0.88));
      const hasRangeOrPlusPrice = Boolean(block.sourceText?.match(/\$\s*\d{1,4}\s*-\s*\$?\s*\d{1,4}\+?|\$\s*\d{1,4}\+/));
      services.set(key, {
        categoryName: group,
        name: parsed.name,
        description: block.descriptionText && block.descriptionText.toLowerCase() !== parsed.name.toLowerCase() ? block.descriptionText : null,
        priceAmount,
        priceCurrency: CURRENCY,
        priceType: block.priceText && /consultation/i.test(block.priceText) ? 'consultation' : block.priceText && (hasRangeOrPlusPrice || /from|starting|\+/i.test(block.priceText)) ? 'from' : priceAmount ? 'fixed' : 'varies',
        durationText: duration?.durationText ?? block.durationText ?? null,
        durationMinutes: duration?.durationMinutes ?? null,
        aliases: aliasFor(parsed.name),
        bookingNotes: null,
        bookable: true,
        variants: blockVariants,
        source: block.sourceHint === 'repeated_card' ? 'block_detector' : block.sourceHint === 'service_menu_list' ? 'website' : preview.url,
        sourceHint: block.sourceHint ?? null,
        confidence,
        needsReview: confidence < 0.7 || block.sourceHint === 'service_menu_list' || block.sourceHint === 'service_matrix_table' || (!priceAmount && !duration && blockVariants.length === 0),
        evidenceSnippet: block.evidenceSnippet ?? block.sourceText?.slice(0, 220) ?? null,
      });
    }
  }
  return [...services.values()].slice(0, 80);
}

function parseDurationText(value: string): { durationText: string; durationMinutes: number | null } | null {
  const match = value.trim().match(/\b(\d{1,3})\s*(?:min|mins|minutes)(\+)?(?=\s|$)/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return { durationText: `${minutes} min${match[2] ? '+' : ''}`, durationMinutes: minutes };
}

function splitBulletServiceNameAndDescription(value: string): { name: string; descriptionPrefix: string | null } {
  const cleaned = cleanServiceName(value);
  const descriptionStart = cleaned.search(/\b(shampoo\s*&\s*condition|shampoo\s+and\s+condition|wash\s*&\s*style|wash\s+and\s+style|blow\s+dry|style\s+included)\b/i);
  if (descriptionStart <= 2) return { name: cleaned, descriptionPrefix: null };
  return {
    name: cleaned.slice(0, descriptionStart).trim(),
    descriptionPrefix: cleaned.slice(descriptionStart).trim(),
  };
}

function extractBulletServiceRows(text: string): Array<{
  name: string;
  description: string | null;
  durationText: string | null;
  durationMinutes: number | null;
  group: string | null;
  priceType: ImportedServiceSuggestion['priceType'];
  confidence: number;
}> {
  const rows: Array<{
    name: string;
    description: string | null;
    durationText: string | null;
    durationMinutes: number | null;
    group: string | null;
    priceType: ImportedServiceSuggestion['priceType'];
    confidence: number;
  }> = [];
  for (const rawLine of text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line.includes('•'))) {
    const parts = rawLine.split(/\s*•\s*/).map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const first = splitBulletServiceNameAndDescription(parts[0]);
    if (first.name.length < 3 || first.name.length > 80) continue;
    const durationPart = parts.find((part) => parseDurationText(part));
    const duration = durationPart ? parseDurationText(durationPart) : null;
    if (!duration) continue;
    const descriptionParts = [
      first.descriptionPrefix,
      ...parts.slice(1).filter((part) => part !== durationPart && !/\$\s*\d/.test(part)),
    ].filter((part): part is string => Boolean(part));
    const parsed = splitServiceHeadingPrefix(first.name);
    rows.push({
      name: parsed.name,
      description: descriptionParts.length ? descriptionParts.join(' • ') : null,
      durationText: duration.durationText,
      durationMinutes: duration.durationMinutes,
      group: parsed.group ?? inferGroup(parsed.name),
      priceType: 'varies',
      confidence: 0.72,
    });
  }
  return rows;
}

const GROUPED_MENU_PHRASES: Record<string, string[]> = {
  Color: [
    'Face Frame Retouch',
    'Color Retouch & Ends Refresh',
    'Color Retouch',
    'Corrective Color',
    'Brow Tinting',
    'Partial Highlight',
    'Full Highlight',
    'Face Frame Highlight',
    'Deposit-Only Color',
    'Deposit Only Color',
  ],
  'Hair Cuts': ['Women', 'Men', 'Children', 'Bang Trim', 'Beard Trim', 'Consultation'],
  Extensions: ['Hotheads', 'Donna Bella'],
  Treatments: [
    'Brazilian Blowout',
    'Keratin Treatment',
    'Full Permanent',
    'Partial Permanent',
    'Botanical Hair Conditioning',
    'Botanical Repair',
    'Glossing Treatment',
  ],
  Styling: ['Wash & Style', 'Special Occasion', 'Special Occassion', 'Up-do', 'Updo', 'Blow Dry', 'Straightening', 'Bridal Up-do', 'Bridal Updo'],
  Makeup: ['Bridal Makeup', 'Eyes Only'],
  Waxing: ['Brows', 'Lip', 'Chin'],
  Nails: ['Polish Change', 'Shellac', 'Manicure', 'Pedicure'],
};

function extractGroupedMenuListServices(text: string): Array<{ name: string; group: string; priceType: ImportedServiceSuggestion['priceType']; confidence: number }> {
  const normalized = cleanCompressedServiceText(text);
  if (/\$\s?\d{1,4}|\bfrom\s+\$?\d{1,4}|\bstarting at\s+\$?\d{1,4}/i.test(normalized)) return [];
  const groupNames = Object.keys(GROUPED_MENU_PHRASES);
  const matches: Array<{ group: string; index: number }> = [];
  for (const group of groupNames) {
    const pattern = new RegExp(`\\b${group.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    for (const match of normalized.matchAll(pattern)) {
      if (typeof match.index === 'number') matches.push({ group, index: match.index });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  const out: Array<{ name: string; group: string; priceType: ImportedServiceSuggestion['priceType']; confidence: number }> = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const segment = normalized.slice(current.index, next?.index ?? normalized.length);
    for (const phrase of GROUPED_MENU_PHRASES[current.group] ?? []) {
      const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (!pattern.test(segment)) continue;
      const displayName = phrase === 'Special Occassion' ? 'Special Occasion' : phrase === 'Updo' ? 'Up-do' : phrase === 'Bridal Updo' ? 'Bridal Up-do' : phrase;
      out.push({ name: displayName, group: current.group, priceType: /consultation/i.test(displayName) ? 'consultation' : 'varies', confidence: 0.68 });
    }
  }
  return out;
}

function isServiceMenuGroupHeading(value: string): boolean {
  const cleaned = cleanServiceName(value);
  if (cleaned.length < 3 || cleaned.length > 90) return false;
  if (SERVICE_MENU_SOURCE_RE.test(cleaned) || ECOMMERCE_CONTEXT_RE.test(cleaned)) return false;
  return /\b(haircuts?|cuts?|color|colour|styling|blowout|extensions?|treatments?|smoothing|straightening|facials?|massage|waxing|nails?|manicure|pedicure|lashes|brows|makeup|injectables?|laser|skin|services?)\b/i.test(cleaned);
}

function isServiceMenuItemName(value: string): boolean {
  const cleaned = cleanServiceName(value);
  if (cleaned.length < 3 || cleaned.length > 100) return false;
  if (SERVICE_MENU_SOURCE_RE.test(cleaned) || ECOMMERCE_CONTEXT_RE.test(cleaned)) return false;
  if (/^\d+$/.test(cleaned) || /\?$/.test(cleaned)) return false;
  return /\b(haircut|cut|curly|men'?s|women'?s|medium|long|short|color|colour|highlight|balayage|toner|root|smudge|shadow|platinum|blow\s*out|up-?do|style|styling|keratin|straightening|conditioner|conditioning|extensions?|weft|i-?tip|tape|installation|removal|consultation|treatment|ritual)\b/i.test(cleaned);
}

function serviceMenuGroupHeadings(text: string): string[] {
  const fromLines = text
    .split(/\n+/)
    .map((line) => cleanServiceName(line))
    .filter((line) => isServiceMenuGroupHeading(line));
  const fromKnown = SERVICE_GROUP_HEADINGS.filter((heading) => {
    const pattern = new RegExp(`\\b${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i');
    return pattern.test(text);
  });
  const groups = [...new Set([...fromLines, ...fromKnown])];
  return groups
    .filter((group) => !(group === 'Extensions' && groups.includes('Hair Extensions')))
    .slice(0, 24);
}

function exactServiceMenuGroup(value: string, groups: string[]): string | null {
  const cleaned = cleanServiceName(value.replace(/^services?\s+/i, ''));
  return groups.find((group) => group.toLowerCase() === cleaned.toLowerCase()) ?? null;
}

function splitTrailingServiceGroup(value: string, groups: string[]): { serviceName: string; nextGroup: string } | null {
  const cleaned = cleanServiceName(value.replace(/^services?\s+/i, ''));
  const sortedGroups = [...groups].sort((a, b) => b.length - a.length);
  for (const group of sortedGroups) {
    const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const match = cleaned.match(new RegExp(`^(.*?)\\s+(${escapedGroup})$`, 'i'));
    if (!match) continue;
    const serviceName = cleanServiceName(match[1]);
    if (!serviceName || serviceName.toLowerCase() === group.toLowerCase()) continue;

    const multiWordGroup = group.trim().split(/\s+/).length > 1;
    const boundaryLikeService = /\b(haircuts?|cut|blow\s*out|up-?do|style|styling|add\s*on|extensions?|installation|removal|consultation|treatments?|keratin|conditioner|conditioning)\b/i.test(serviceName);
    const likelyEmbeddedTerm = group.trim().split(/\s+/).length === 1 && serviceName.trim().split(/\s+/).length <= 1;
    if ((multiWordGroup || boundaryLikeService) && !likelyEmbeddedTerm) {
      return { serviceName, nextGroup: group };
    }
  }
  return null;
}

function extractDynamicServiceMenuListServices(text: string): Array<{ name: string; group: string; priceType: ImportedServiceSuggestion['priceType']; confidence: number }> {
  let normalized = cleanCompressedServiceText(text);
  const menuStart = normalized.search(/\bServices\s+(?:Haircuts?|Color|Styling|Smoothing|Hair Extensions|Signature Ritual|Treatments?|Extensions?)\b/i);
  if (menuStart >= 0) normalized = normalized.slice(menuStart);
  if (/\$\s?\d{1,4}|\bfrom\s+\$?\d{1,4}|\bstarting at\s+\$?\d{1,4}/i.test(normalized)) return [];
  const intro = normalized.slice(0, 500);
  if (ECOMMERCE_CONTEXT_RE.test(intro) && !/\bservices?\b/i.test(intro)) return [];
  const groups = serviceMenuGroupHeadings(normalized);
  const out: Array<{ name: string; group: string; priceType: ImportedServiceSuggestion['priceType']; confidence: number }> = [];
  let currentGroup: string | null = null;
  const parts = normalized
    .split(/\s*(?:►|•|\u2022|\n|;)\s*/g)
    .map((item) => cleanServiceName(item.replace(/\bBook Now\b.*$/i, '').replace(/^services?\s+/i, '')))
    .filter(Boolean);
  for (const part of parts) {
    const exactGroup = exactServiceMenuGroup(part, groups);
    if (exactGroup) {
      currentGroup = exactGroup;
      continue;
    }

    const boundary = splitTrailingServiceGroup(part, groups);
    const item = boundary?.serviceName ?? part;
    if (currentGroup && isServiceMenuItemName(item) && !groups.some((group) => group.toLowerCase() === item.toLowerCase())) {
      out.push({
        name: item,
        group: currentGroup,
        priceType: /consultation/i.test(item) ? 'consultation' : 'varies',
        confidence: 0.66,
      });
    }
    if (boundary) currentGroup = boundary.nextGroup;
  }
  return out;
}

function cleanCompressedServiceText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\btop of page\b/gi, ' ')
    .replace(/\bbottom of page\b/gi, ' ')
    .replace(/BOOKING/gi, ' ')
    .replace(/\bBook Now\b/gi, ' ')
    .replace(/\bConsultation Required\b/gi, ' ')
    .replace(/\bLoad More\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStylistPricingRowName(name: string): boolean {
  return /^(assistant|level\s*\d|all levels?)\s+stylists?\b/i.test(name)
    || /\bpricing\s+(assistant|level\s*\d|all levels?)\s+stylists?\b/i.test(name);
}

function normalizePricingServiceName(value: string): string {
  const cleaned = cleanServiceName(value)
    .replace(/\bpricing\b/gi, ' ')
    .replace(/\b(in|near)\s+[A-Z][A-Za-z]+(?:,\s*[A-Z]{2})?\b/g, ' ')
    .replace(/\b(in|near)\s+[A-Z][A-Za-z\s,-]{2,40}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return collapseRepeatedServiceName(cleaned);
}

function parseSplitDollarAmount(dollars: string, cents?: string): number {
  const base = Number(dollars);
  if (!Number.isFinite(base)) return 0;
  if (!cents) return base;
  return Number(`${dollars}.${cents}`);
}

function extractStylistPricingServices(text: string): Array<{
  name: string;
  priceAmount: number | null;
  priceType: ImportedServiceSuggestion['priceType'];
  group: string | null;
  bookingNotes: string | null;
}> {
  const normalized = cleanCompressedServiceText(text);
  const headings = [...normalized.matchAll(/\b([A-Z][A-Za-z’'\/&\-\s]{2,80}?\s+Pricing)\b/g)]
    .map((match) => ({ raw: match[1], index: match.index ?? 0 }))
    .filter((item) => !/pricing\s+(assistant|level\s*\d|all levels?)\s+stylists?/i.test(item.raw));
  const services: Array<{
    name: string;
    priceAmount: number | null;
    priceType: ImportedServiceSuggestion['priceType'];
    group: string | null;
    bookingNotes: string | null;
  }> = [];

  for (let i = 0; i < headings.length; i += 1) {
    const heading = headings[i];
    const nextIndex = headings[i + 1]?.index ?? normalized.length;
    const block = normalized.slice(heading.index + heading.raw.length, Math.min(nextIndex, heading.index + heading.raw.length + 650));
    const levels = [...block.matchAll(/\b(Assistant\s+Stylists?|Level\s+\d\s+Stylists?|All\s+Levels?)\b\s*\$\s*(\d{2,4})(?:\s+(\d{2})(?=\s+(?:Level|Assistant|All|Contact|$)))?/gi)]
      .map((match) => ({
        label: match[1].replace(/\s+/g, ' ').trim(),
        amount: parseSplitDollarAmount(match[2], match[3]),
      }))
      .filter((level) => level.amount > 0);
    if (!levels.length) continue;
    const name = normalizePricingServiceName(heading.raw);
    if (name.length < 3 || isStylistPricingRowName(name)) continue;
    const minimum = Math.min(...levels.map((level) => level.amount));
    const notes = `Website pricing by stylist level: ${levels.map((level) => `${level.label} $${Number.isInteger(level.amount) ? level.amount : level.amount.toFixed(2)}`).join('; ')}`;
    services.push({
      name,
      priceAmount: minimum,
      priceType: levels.length > 1 ? 'from' : 'fixed',
      group: inferGroup(name),
      bookingNotes: notes,
    });
  }

  return services;
}

function cleanServiceName(name: string): string {
  return name
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\bOR(?=[A-Z])/g, 'OR ')
    .replace(/([A-Za-z])Involves\b/g, '$1 Involves')
    .replace(/\b(top of page|bottom of page|Load More|Contact Us)\b/gi, ' ')
    .replace(/BOOKING/gi, ' ')
    .replace(/\bBook Now\b/gi, ' ')
    .replace(/\bConsultation Required\b/gi, ' ')
    .replace(/\bInvolves\b.*$/i, '')
    .replace(/\bPricing is based\b.*$/i, '')
    .replace(/Pricing\s*is\s*based.*$/i, '')
    .replace(/Starting\s*at.*$/i, '')
    .replace(/Starts\s*at.*$/i, '')
    .replace(/^(services|service|treatments|treatment|menu)\s*:?\s*/i, '')
    .replace(/\b(from|starting at|starts at|starting)\s*$/i, '')
    .replace(/[-–—]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseRepeatedServiceName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  for (let size = 1; size <= Math.floor(words.length / 2); size += 1) {
    const phrase = words.slice(0, size).join(' ').toLowerCase();
    let offset = size;
    while (words.slice(offset, offset + size).join(' ').toLowerCase() === phrase) offset += size;
    if (offset > size) return words.slice(0, size).concat(words.slice(offset)).join(' ').trim();
  }
  return name;
}

function splitServiceHeadingPrefix(rawName: string): { group: string | null; name: string } {
  let cleaned = cleanServiceName(rawName);
  let group: string | null = null;
  for (let pass = 0; pass < 4; pass += 1) {
    let stripped = false;
    for (const heading of SERVICE_GROUP_HEADINGS) {
      const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const withSpace = new RegExp(`^${escapedHeading}\\s+(.+)$`, 'i');
      const spacedMatch = cleaned.match(withSpace);
      if (spacedMatch?.[1]?.trim()) {
        group = heading;
        cleaned = spacedMatch[1].trim();
        stripped = true;
        break;
      }
      const compactHeading = heading.replace(/\s+/g, '');
      const compactCleaned = cleaned.replace(/\s+/g, '');
      if (compactCleaned.toLowerCase().startsWith(compactHeading.toLowerCase())) {
        const name = cleaned.slice(heading.length).trim();
        if (name.length >= 3 && !/^&/.test(name)) {
          group = heading;
          cleaned = name;
          stripped = true;
          break;
        }
      }
    }
    if (!stripped) break;
  }
  if (group === 'Color' && /^(touch-up|correction|gloss|blocking)$/i.test(cleaned)) cleaned = `Color ${cleaned}`;
  return { group, name: cleaned };
}

function aliasFor(name: string): string[] {
  const lower = name.toLowerCase();
  const aliases: string[] = [];
  if (lower.includes('gel manicure')) aliases.push('gel mani', 'shellac');
  if (lower.includes('pedicure')) aliases.push('pedi');
  return aliases;
}

function normalizeServiceLinkName(value: string): string {
  return cleanServiceName(value)
    .replace(/\b(in|near)\s+[A-Z][A-Za-z\s,-]{2,40}$/i, '')
    .replace(/^(dallas|houston|fort worth|miami|boca raton|scottsdale)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function serviceNameFromLink(link: PagePreview['links'][number]): string | null {
  let name = normalizeServiceLinkName(link.text);
  if (!name || /^(home|overview|services?|online booking|book now|free consult|contact|locations?|stylists?|blog|before & after)$/i.test(name)) {
    const pathParts = new URL(link.href).pathname.split('/').filter(Boolean);
    const serviceIndex = pathParts.findIndex((part) => /^services?$/i.test(part));
    if (serviceIndex < 0 || !pathParts[serviceIndex + 1]) return null;
    name = normalizeServiceLinkName(
      decodeURIComponent(pathParts[serviceIndex + 1])
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    );
  }
  if (name.length < 3 || name.length > 80) return null;
  const lower = name.toLowerCase();
  if (!/(balayage|hair|color|highlight|blowout|extension|haircut|bridal|make|manicure|pedicure|massage|facial|wax|lash|brow|botox|filler|laser|skin|consult)/i.test(lower)) return null;
  return name;
}

function cleanMarkdownText(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isServiceListGroup(value: string): boolean {
  const cleaned = cleanMarkdownText(value);
  if (cleaned.length < 3 || cleaned.length > 100) return false;
  if (SERVICE_MENU_SOURCE_RE.test(cleaned) || ECOMMERCE_CONTEXT_RE.test(cleaned)) return false;
  return /\b(services?|hair|color|colour|cuts?|extensions?|restoration|replacement|methods?|weddings?|formal|makeup|make-up|nails?|manicure|pedicure|massage|facials?|waxing|lashes?|brows?|skin|treatments?)\b/i.test(cleaned);
}

function isServiceListItem(value: string): boolean {
  const cleaned = cleanMarkdownText(value);
  if (cleaned.length < 3 || cleaned.length > 100) return false;
  if (SERVICE_MENU_SOURCE_RE.test(cleaned) || ECOMMERCE_CONTEXT_RE.test(cleaned)) return false;
  if (/^(home|staff|gallery|testimonials|payment plans?|contact|contact us|service areas?|hours of operation)$/i.test(cleaned)) return false;
  if (/^uncategorized(?:\s+\d+)?$/i.test(cleaned)) return false;
  if (/\b(address|phone|email|hours|closed|appointment only|get in touch)\b/i.test(cleaned)) return false;
  return /[A-Za-z]/.test(cleaned);
}

function categoryFromServiceListGroup(group: string | null, serviceName: string): string {
  const cleaned = cleanMarkdownText(group ?? '');
  if (!cleaned || /^basic services?$/i.test(cleaned) || /^our services?$/i.test(cleaned)) return inferGroup(serviceName);
  return cleaned;
}

function extractServicesFromMarkdownLists(previews: PagePreview[]): ImportedServiceSuggestion[] {
  const services = new Map<string, ImportedServiceSuggestion>();
  for (const preview of previews) {
    const markdown = preview.markdown ?? '';
    const primaryContext = `${preview.url} ${preview.title} ${preview.h1}`;
    const serviceListPageIntent = /\b(our services?|service menu|services?|pricing|menu)\b/i.test(primaryContext)
      || /\/(?:our-services|services?|service-menu|salon-services|hairmenu|wax-lash-brow-menu|advanced-facials-menu)(?:\/|$)/i.test(primaryContext)
      || /^#{1,4}\s+Our Services\s*$/im.test(markdown);
    if (!markdown || !serviceListPageIntent) continue;
    let currentGroup: string | null = null;
    let inServiceSection = false;
    for (const rawLine of markdown.split(/\n+/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const text = cleanMarkdownText(heading[2]);
        if (/^(contact|contact us|contact information|hours of operation|testimonials?|faq|payment plans?|service areas?)$/i.test(text)) {
          currentGroup = null;
          inServiceSection = false;
          continue;
        }
        if (/^our services?$/i.test(text)) {
          inServiceSection = true;
          currentGroup = null;
          continue;
        }
        if (isServiceListGroup(text)) {
          inServiceSection = true;
          currentGroup = text;
          continue;
        }
        currentGroup = null;
        continue;
      }
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (!bullet || !inServiceSection) continue;
      const name = cleanServiceName(bullet[1]);
      if (!isServiceListItem(name)) continue;
      const categoryName = categoryFromServiceListGroup(currentGroup, name);
      const key = `${categoryName}:${name}`.toLowerCase();
      if (services.has(key)) continue;
      services.set(key, {
        categoryName,
        name,
        priceAmount: null,
        priceCurrency: CURRENCY,
        priceType: /consult/i.test(name) ? 'consultation' : 'varies',
        durationText: null,
        durationMinutes: null,
        aliases: aliasFor(name),
        bookable: true,
        source: preview.url,
        sourceHint: 'service_menu_list',
        confidence: 0.64,
        needsReview: true,
      });
    }
  }
  return [...services.values()].slice(0, 60);
}

function extractServiceLinks(previews: PagePreview[]): ImportedServiceSuggestion[] {
  const services = new Map<string, ImportedServiceSuggestion>();
  for (const preview of previews) {
    for (const link of preview.links) {
      const path = new URL(link.href).pathname;
      if (SERVICE_AREA_LINK_RE.test(path) || SERVICE_TAXONOMY_LINK_RE.test(path) || /service areas?/i.test(link.text)) continue;
      if (!/\/services?\//i.test(path) && !/services?/i.test(link.href)) continue;
      const name = serviceNameFromLink(link);
      if (!name) continue;
      const categoryName = inferGroup(name);
      const key = `${categoryName}:${name}`.toLowerCase();
      if (services.has(key)) continue;
      services.set(key, {
        categoryName,
        name,
        priceAmount: null,
        priceCurrency: CURRENCY,
        priceType: 'varies',
        durationText: null,
        durationMinutes: null,
        aliases: aliasFor(name),
        bookable: true,
        source: link.href,
        confidence: 0.62,
      });
    }
  }
  return [...services.values()].slice(0, 40);
}

function sanitizeSnippet(value: string | null | undefined, maxLength = 220): string | undefined {
  const cleaned = (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function cleanStaffName(value: string): string {
  return value.replace(/^(team|staff|meet|our)\s+/i, '').replace(/\s+/g, ' ').trim();
}

function isLikelyStaffName(value: string): boolean {
  const cleaned = cleanStaffName(value);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 60) return false;
  if (/\d|@|#|\/|\$/.test(cleaned)) return false;
  if (/^(master|massage|licensed|certified|senior|lead|medical|hairstylist|stylist|colorist|artist|apprentice|junior|receptionist|director|specialist|expert|owner|manager)$/i.test(cleaned)) return false;
  if (/^(?:master\s+)?(?:colorist|hairstylist|stylist|artist|apprentice|junior\s+stylist|studio\s+director|tooth\s+gem\s+specialist|hair\s+replacement\s+specialist)$/i.test(cleaned)) return false;
  if (/^(home|services?|artists?|team|staff|contact|contact information|book|booking|online booking|hours|about|policies?|policy|faq)$/i.test(cleaned)) return false;
  if (/\b(policy|policies|cancellation|deposit|specials?|offers?|faq|questions?|booking|available|hours|salon|spa|studio|clinic|business|services?)\b/i.test(cleaned)) return false;
  return /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}$/.test(cleaned);
}

function staffRoleFromContext(context: string): string | undefined {
  if (/stylist|hair|salon|artist/i.test(context)) return 'Artist';
  if (/technician/i.test(context)) return 'Technician';
  if (/provider/i.test(context)) return 'Provider';
  return undefined;
}

function normalizeStaffRole(value: string): string | undefined {
  const cleaned = value
    .replace(/\b(?:licensed|certified|experienced|senior)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > 80) return undefined;
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractVisibleFaqs(preview: PagePreview): FaqSuggestion[] {
  const context = `${preview.url} ${preview.title} ${preview.h1} ${preview.h2s.join(' ')}`;
  if (!/\b(faq|faqs|frequently asked|questions?)\b/i.test(context)) return [];
  const markdown = preview.markdown ?? preview.firstTextChars;
  const lines = markdown
    .split(/\n+/)
    .map((line) => cleanMarkdownText(line.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '')))
    .filter(Boolean);
  const out: FaqSuggestion[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const question = sanitizeSnippet(lines[i], 220);
    if (!question || !/\?$/.test(question) || question.length < 8) continue;
    if (/^(search|menu|contact|home|faq)$/i.test(question.replace(/\?$/, ''))) continue;
    const answerParts: string[] = [];
    for (let j = i + 1; j < lines.length && answerParts.join(' ').length < 900; j += 1) {
      const next = lines[j];
      if (/\?$/.test(next) || /^(contact us|contact information|hours of operation)$/i.test(next)) break;
      if (/^(home|staff|our services|service areas|gallery|hairpieces|salon policy|testimonials|faq|payment plans?|contact)$/i.test(next)) continue;
      answerParts.push(next);
    }
    const answer = sanitizeSnippet(answerParts.join(' '), 900);
    if (!answer || answer.length < 8) continue;
    out.push({
      question,
      answer,
      source: 'website',
      sourceUrl: preview.url,
      confidence: 0.76,
      evidenceSnippet: sanitizeSnippet(`${question} ${answer}`),
    });
  }
  return out.slice(0, 30);
}

function pageText(preview: PagePreview): string {
  return `${preview.title}\n${preview.h1}\n${preview.h2s.join('\n')}\n${preview.firstTextChars}`;
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function dedupeServices(services: ImportedServiceSuggestion[]): ImportedServiceSuggestion[] {
  const byKey = new Map<string, ImportedServiceSuggestion>();
  for (const service of services) {
    const key = `${service.categoryName}:${service.name}`.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, service);
      continue;
    }
    const existingHasPrice = typeof existing.priceAmount === 'number';
    const serviceHasPrice = typeof service.priceAmount === 'number';
    if (
      (serviceHasPrice && !existingHasPrice)
      || ((service.confidence ?? 0) > (existing.confidence ?? 0) && serviceHasPrice === existingHasPrice)
    ) {
      byKey.set(key, service);
    }
  }
  return [...byKey.values()];
}

function detectBookingPlatform(url: string): BookingSetupSuggestion['platform'] {
  if (/vagaro/i.test(url)) return 'vagaro';
  if (/booksy/i.test(url)) return 'booksy';
  if (/fresha/i.test(url)) return 'fresha';
  if (/glossgenius/i.test(url)) return 'glossgenius';
  if (/squareup|square\.site/i.test(url)) return 'square';
  if (/calendly/i.test(url)) return 'calendly';
  return null;
}

function classifyPolicyHeading(heading: string): PolicySuggestion['type'] {
  const lower = heading.toLowerCase();
  if (/cancell/.test(lower)) return 'cancellation';
  if (/no.?show|missed\s+appointment/.test(lower)) return 'no_show';
  if (/deposit|booking\s+fee|retainer/.test(lower)) return 'deposit';
  if (/late\s+arrival|late\s+fee|tardy/.test(lower)) return 'late_arrival';
  if (/walk.?in/.test(lower)) return 'walk_ins';
  if (/refund|return\s+policy/.test(lower)) return 'refund';
  if (/aftercare|before\s+your|appointment\s+prep|preparation/.test(lower)) return 'appointment_prep';
  if (/consultation\s+(?:required|policy)/.test(lower)) return 'consultation';
  return 'other';
}

export function extractSecondaryKnowledge(previews: PagePreview[]): {
  staffSuggestions: StaffSuggestion[];
  policySuggestions: PolicySuggestion[];
  faqSuggestions: FaqSuggestion[];
  promotionSuggestions: PromotionSuggestion[];
  bookingSetupSuggestions: BookingSetupSuggestion[];
} {
  const staffSuggestions: StaffSuggestion[] = [];
  const policySuggestions: PolicySuggestion[] = [];
  const faqSuggestions: FaqSuggestion[] = [];
  const promotionSuggestions: PromotionSuggestion[] = [];
  const bookingSetupSuggestions: BookingSetupSuggestion[] = [];

  for (const preview of previews) {
    const text = pageText(preview);
    const lowerContext = `${preview.url} ${preview.title} ${preview.h1} ${preview.h2s.join(' ')}`.toLowerCase();

    for (const node of flattenJsonLd(preview.jsonLd)) {
      const type = String(node['@type'] ?? '').toLowerCase();
      if (type.includes('person') && typeof node.name === 'string') {
        staffSuggestions.push({
          name: node.name.trim(),
          role: typeof node.jobTitle === 'string' ? node.jobTitle.trim() : undefined,
          bio: sanitizeSnippet(typeof node.description === 'string' ? node.description : null, 300),
          source: 'jsonld',
          sourceUrl: preview.url,
          confidence: 0.82,
          evidenceSnippet: sanitizeSnippet(`${node.name} ${typeof node.jobTitle === 'string' ? node.jobTitle : ''}`),
        });
      }
      if (type.includes('faqpage')) {
        const entities = Array.isArray(node.mainEntity) ? node.mainEntity : [];
        for (const entity of entities) {
          if (!entity || typeof entity !== 'object') continue;
          const raw = entity as Record<string, unknown>;
          const accepted = raw.acceptedAnswer && typeof raw.acceptedAnswer === 'object' ? raw.acceptedAnswer as Record<string, unknown> : null;
          const question = typeof raw.name === 'string' ? sanitizeSnippet(raw.name, 180) : undefined;
          const answer = typeof accepted?.text === 'string' ? sanitizeSnippet(accepted.text, 500) : undefined;
          if (question && answer) faqSuggestions.push({ question, answer, source: 'website', sourceUrl: preview.url, confidence: 0.9, evidenceSnippet: sanitizeSnippet(`${question} ${answer}`) });
        }
      }
    }

    faqSuggestions.push(...extractVisibleFaqs(preview));

    if (/(staff|team|stylist|artist|provider|injector|esthetician|barber|about)/i.test(lowerContext)) {
      // Structured STAFF_MEMBER: blocks from DOM extraction (includes Role: when available)
      const structuredStaffRe = /^STAFF_MEMBER:\s*([^|\n]+?)(?:\s*\|\s*Role:\s*([^|\n]+?))?(?:\s*\|\s*Bio:\s*([^\n]+))?$/gim;
      let structuredStaffCount = 0;
      for (const match of text.matchAll(structuredStaffRe)) {
        const name = cleanStaffName(match[1]);
        if (!isLikelyStaffName(name)) continue;
        const role = match[2]?.trim() || staffRoleFromContext(lowerContext);
        const bio = sanitizeSnippet(match[3], 500);
        structuredStaffCount += 1;
        staffSuggestions.push({
          name,
          role,
          specialties: [],
          bio,
          source: 'website',
          sourceUrl: preview.url,
          confidence: bio ? 0.78 : 0.68,
          evidenceSnippet: sanitizeSnippet(`${name}${role ? ` ${role}` : ''}${bio ? ` ${bio}` : ''}`),
        });
      }

      if (structuredStaffCount === 0) {
        // Fallback: "Name - Role" inline patterns
        const staffLineRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*(?:[-–—,|]\s*)?(Stylist|Colorist|Artist|Provider|Technician|Injector|Esthetician|Barber|Owner|Manager|Director|Founder|Specialist|Therapist|Aesthetician|Nail\s+Tech)\b/g;
        for (const match of text.matchAll(staffLineRe)) {
          const name = cleanStaffName(match[1]);
          if (!isLikelyStaffName(name)) continue;
          staffSuggestions.push({
            name,
            role: match[2].trim(),
            specialties: [],
            source: 'website',
            sourceUrl: preview.url,
            confidence: 0.68,
            evidenceSnippet: sanitizeSnippet(match[0]),
          });
        }

        const staffBioSentenceRe = /\b([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,2})[ \t]+is[ \t]+([^.\n]{0,360})/g;
        for (const match of text.matchAll(staffBioSentenceRe)) {
          const name = cleanStaffName(match[1]);
          if (!isLikelyStaffName(name)) continue;
          const roleMatch = match[2].match(/\b((?:licensed|certified|experienced|senior)\s+)?(massage\s+therapist|stylist|colorist|artist|provider|technician|injector|esthetician|barber|owner|manager|director|founder|specialist|therapist|aesthetician|nail\s+tech)\b/i);
          if (!roleMatch) continue;
          const role = normalizeStaffRole(roleMatch[0]) ?? staffRoleFromContext(lowerContext);
          const bio = sanitizeSnippet(match[0], 500);
          staffSuggestions.push({
            name,
            role,
            specialties: [],
            bio,
            source: 'website',
            sourceUrl: preview.url,
            confidence: bio ? 0.76 : 0.66,
            evidenceSnippet: sanitizeSnippet(match[0]),
          });
        }
      }
    }

    // Heading-anchored policy blocks (full content, not truncated at sentence end)
    const headingCapturedPolicyTypes = new Set<string>();
    for (const block of preview.policyBlocks ?? []) {
      const type = classifyPolicyHeading(block.heading);
      headingCapturedPolicyTypes.add(type);
      policySuggestions.push({
        type,
        title: block.heading.slice(0, 160),
        content: block.content.slice(0, 1200),
        source: 'website',
        sourceUrl: preview.url,
        confidence: 0.78,
        evidenceSnippet: sanitizeSnippet(block.content),
      });
    }

    // Regex fallback — only for policy types not already captured by DOM headings
    // Keywords deliberately narrow to avoid false positives
    const policyTypePatterns: Array<[PolicySuggestion['type'], RegExp, string]> = [
      ['cancellation', /\b(cancellation\s+policy|cancellations?)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Cancellation policy'],
      ['no_show', /\b(no-show|no\s+show|missed\s+appointment)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'No-show policy'],
      ['deposit', /\b(deposit|booking\s+fee|retainer)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Deposit policy'],
      ['late_arrival', /\b(late\s+arrival|late\s+fee)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Late arrival policy'],
      ['walk_ins', /\b(walk-ins?|walk\s+ins?|walk-in\s+policy)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Walk-ins'],
      ['refund', /\b(refund\s+policy|refunds?)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Refund policy'],
      ['appointment_prep', /\b(appointment\s+prep(?:aration)?|aftercare|before\s+your\s+appointment)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Appointment preparation'],
      ['consultation', /\b(consultation\s+required|consultation\s+policy)\b(?:[^\n]|\n(?!\n)){20,600}/gi, 'Consultation'],
    ];
    for (const [type, pattern, title] of policyTypePatterns) {
      if (headingCapturedPolicyTypes.has(type)) continue;
      for (const match of text.matchAll(pattern)) {
        const content = sanitizeSnippet(match[0], 600);
        if (content) policySuggestions.push({ type, title, content, source: 'website', sourceUrl: preview.url, confidence: 0.66, evidenceSnippet: sanitizeSnippet(content) });
      }
    }

    const promoRe = /\b(special|promotion|offer|deal|membership|package)\b[^.\n]{15,260}/gi;
    for (const match of text.matchAll(promoRe)) {
      const description = sanitizeSnippet(match[0], 260);
      if (description) promotionSuggestions.push({ title: description.split(/[:.-]/)[0]?.slice(0, 80) || 'Website offer', description, expiresAt: null, source: 'website', sourceUrl: preview.url, confidence: 0.58, evidenceSnippet: description });
    }

    for (const link of preview.links) {
      const platform = detectBookingPlatform(link.href);
      if (/book|booking|appointment|schedule|reserve|vagaro|booksy|fresha|glossgenius|square|calendly/i.test(`${link.text} ${link.href}`)) {
        bookingSetupSuggestions.push({
          type: platform ? 'booking_platform' : 'booking_link',
          label: sanitizeSnippet(link.text, 100) || (platform ? `${platform} booking` : 'Booking link'),
          value: link.href,
          platform: platform ?? null,
          source: 'deterministic',
          sourceUrl: preview.url,
          confidence: platform ? 0.86 : 0.72,
        });
      }
    }
    if (/\b(call to book|call us to book|book by phone)\b/i.test(text)) {
      bookingSetupSuggestions.push({ type: 'call_to_book', label: 'Call to book', source: 'website', sourceUrl: preview.url, confidence: 0.72 });
    }
    if (/\bconsultation required\b/i.test(text)) {
      bookingSetupSuggestions.push({ type: 'consultation_required', label: 'Consultation required', source: 'website', sourceUrl: preview.url, confidence: 0.68 });
    }
  }

  return {
    staffSuggestions: dedupeBy(staffSuggestions.filter((item) => item.name.trim()), (item) => item.name).slice(0, 20),
    policySuggestions: dedupeBy(policySuggestions.filter((item) => item.content.trim()), (item) => `${item.type}:${item.content}`).slice(0, 20),
    faqSuggestions: dedupeBy(faqSuggestions.filter((item) => item.question.trim() && item.answer.trim()), (item) => item.question).slice(0, 30),
    promotionSuggestions: dedupeBy(promotionSuggestions.filter((item) => item.title.trim()), (item) => item.title).slice(0, 12),
    bookingSetupSuggestions: dedupeBy(bookingSetupSuggestions, (item) => `${item.type}:${item.value ?? item.label}`).slice(0, 12),
  };
}

function jsonLdFacts(previews: PagePreview[]) {
  const facts: { name?: string; phone?: string; address?: string; hours?: ImportField<Record<string, unknown>> } = {};
  let bestName: { value: string; score: number } | null = null;
  for (const obj of flattenJsonLd(previews.flatMap((preview) => preview.jsonLd))) {
    if (typeof obj.name === 'string') {
      const type = Array.isArray(obj['@type']) ? obj['@type'].join(' ') : String(obj['@type'] ?? '');
      const isBusiness = /\b(LocalBusiness|Organization|BeautySalon|HairSalon|NailSalon|HealthAndBeautyBusiness|DaySpa|Spa|Store|WebSite)\b/i.test(type);
      const isPage = /\b(WebPage|Article|BlogPosting)\b/i.test(type);
      const score = (isBusiness ? 40 : 0) + (type.includes('WebSite') ? 10 : 0) - (isPage ? 30 : 0) - (obj.name.includes('|') ? 8 : 0);
      if (!bestName || score > bestName.score) bestName = { value: obj.name, score };
    }
    if (!facts.phone && typeof obj.telephone === 'string') facts.phone = obj.telephone;
    if (!facts.address && obj.address && typeof obj.address === 'object') {
      const addr = obj.address as Record<string, unknown>;
      facts.address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter((v): v is string => typeof v === 'string').join(', ');
    }
  }
  if (bestName?.value) facts.name = bestName.value.replace(/\s+\|.*$/, '').trim();
  facts.hours = extractHoursFromJsonLd(previews) ?? undefined;
  return facts;
}

function cleanBusinessNameCandidate(value?: string | null): string | null {
  const decoded = (value ?? '')
    .replace(/&#8211;|&#x2013;|&ndash;/gi, '–')
    .replace(/&#8212;|&#x2014;|&mdash;/gi, '—')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!decoded) return null;
  const [primary] = decoded.split(/\s+(?:\||–|—)\s+/);
  const cleaned = (primary ?? decoded).trim();
  return cleaned.length >= 2 ? cleaned : decoded;
}

function looksLikeVisibleBusinessName(value: string): boolean {
  const cleaned = value.trim();
  if (cleaned.length < 2 || cleaned.length > 80) return false;
  if (/\b(?:\d{3}[\s.-]?\d{3}[\s.-]?\d{4}|street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|suite|ste\.?)\b/i.test(cleaned)) return false;
  if (/^(?:home|about|contact|services?|menu|book(?: now)?|online booking|follow us|skip to content|learn more|massage therapy|hair salon|salon|spa)$/i.test(cleaned)) return false;
  if (/^(?:color|colou?r|cut|cuts|hair cuts?|haircuts?|extensions?|treatments?|nails?|waxing|facials?|massage|brows?|lashes?|makeup|injectables?|laser|skin)$/i.test(cleaned)) return false;
  if (/^(?:at|we|our|welcome|follow|book|call|get|discover|experience)\b/i.test(cleaned)) return false;
  if (/\b(?:appointment|appointments|premier|experience|specialize|top-rated|education|tips|tricks|available|hours?)\b/i.test(cleaned)) return false;
  if (/[!?]/.test(cleaned)) return false;
  if (/\.$/.test(cleaned) && !/\b(?:co|inc|llc)\.$/i.test(cleaned)) return false;
  return cleaned.split(/\s+/).length <= 7 && /[A-Za-z]/.test(cleaned);
}

function visibleBusinessNameCandidate(preview?: PagePreview): string | null {
  if (!preview) return null;
  const lines = preview.firstTextChars
    .split(/\n+/)
    .map((line) => cleanBusinessNameCandidate(line))
    .filter((line): line is string => Boolean(line));
  return lines.find(looksLikeVisibleBusinessName) ?? null;
}

function isHomepagePreview(previewUrl: string, sourceUrl: string): boolean {
  try {
    const preview = new URL(previewUrl);
    const source = new URL(sourceUrl);
    if (preview.origin !== source.origin) return false;
    return preview.pathname === '/' || preview.pathname === '';
  } catch {
    return false;
  }
}

function phonesFromText(text: string): string[] {
  return [...new Set(text.match(new RegExp(PHONE_RE.source, 'g')) ?? [])];
}

function extractVisiblePhone(previews: PagePreview[]): { value: string; source: string } | null {
  const scored: Array<{ value: string; score: number; source: string }> = [];
  for (const preview of previews) {
    const text = pageText(preview);
    const context = `${preview.url} ${preview.title} ${preview.h1}`.toLowerCase();
    const isContactLike = /contact|location|hours|directions/.test(context);
    for (const value of phonesFromText(text)) {
      scored.push({ value, score: isContactLike ? 20 : 10, source: isContactLike ? 'Contact page' : 'Website' });
    }
  }
  if (!scored.length) return null;
  const byDigits = new Map<string, { value: string; score: number; source: string }>();
  for (const candidate of scored) {
    const key = phoneComparableDigits(candidate.value);
    if (!key) continue;
    const existing = byDigits.get(key);
    if (!existing || candidate.score > existing.score) byDigits.set(key, candidate);
    else if (existing && candidate.score === existing.score) existing.score += 1;
  }
  return [...byDigits.values()].sort((a, b) => b.score - a.score)[0] ?? null;
}

function isJsonLdServiceGroupName(name: string): boolean {
  return /^(our\s+)?(?:hair|nail|spa|beauty|skin|massage|waxing|facial|lash|brow|makeup|injectable|laser)\s+services?$/i.test(name.trim())
    || /^(our\s+)?services$/i.test(name.trim());
}

function extractServicesFromJsonLd(previews: PagePreview[]): ImportedServiceSuggestion[] {
  const services: ImportedServiceSuggestion[] = [];
  const seen = new Set<string>();

  function pushService(node: Record<string, unknown>): void {
    const name = typeof node.name === 'string' ? node.name.trim() : null;
    if (!name || name.length < 3 || name.length > 100) return;
    if (SERVICE_MENU_SOURCE_RE.test(name) || ECOMMERCE_CONTEXT_RE.test(name)) return;
    if (isJsonLdServiceGroupName(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const description = typeof node.description === 'string' ? node.description.trim().slice(0, 400) : null;
    const rawOffers = Array.isArray(node.offers) ? (node.offers as Record<string, unknown>[]) :
      node.offers && typeof node.offers === 'object' ? [node.offers as Record<string, unknown>] : [];
    const offer = rawOffers[0];
    const rawPrice = offer?.price ?? node.price;
    const parsedPrice = typeof rawPrice === 'number' ? rawPrice :
      typeof rawPrice === 'string' ? Number(rawPrice.replace(/[^0-9.]/g, '')) : NaN;
    const priceAmount = Number.isFinite(parsedPrice) && parsedPrice >= 0 && parsedPrice < 10000 ? parsedPrice : null;
    const rawCurrency = String((offer?.priceCurrency ?? node.priceCurrency) ?? CURRENCY);
    services.push({
      categoryName: inferGroup(name),
      name,
      description: description && description.toLowerCase() !== name.toLowerCase() ? description : null,
      priceAmount,
      priceCurrency: /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : CURRENCY,
      priceType: priceAmount !== null && priceAmount > 0 ? 'fixed' : 'varies',
      durationText: null,
      durationMinutes: null,
      aliases: aliasFor(name),
      bookingNotes: null,
      bookable: true,
      source: 'jsonld',
      confidence: priceAmount !== null ? 0.88 : 0.72,
      needsReview: priceAmount === null,
    });
  }

  for (const node of flattenJsonLd(previews.flatMap((p) => p.jsonLd))) {
    const types = (Array.isArray(node['@type']) ? node['@type'] : [node['@type']]).map(
      (t) => String(t ?? '').replace(/^https?:\/\/schema\.org\//, '').toLowerCase(),
    );

    if (types.some((t) => /^(?:service|product|offer)$/.test(t))) {
      pushService(node);
      continue;
    }

    if (types.some((t) => /localbusiness|beautysalon|hairsalon|nailsalon|dayspa|healthandbeauty|spa/.test(t))) {
      const catalogs = (Array.isArray(node.hasOfferCatalog) ? node.hasOfferCatalog :
        node.hasOfferCatalog ? [node.hasOfferCatalog] : []) as Record<string, unknown>[];
      for (const catalog of catalogs) {
        const items = (Array.isArray(catalog.itemListElement) ? catalog.itemListElement : []) as Record<string, unknown>[];
        for (const item of items) pushService(item);
      }
      continue;
    }

    if (types.some((t) => /itemlist|offercatalog/.test(t))) {
      const items = (Array.isArray(node.itemListElement) ? node.itemListElement : []) as Record<string, unknown>[];
      for (const item of items) pushService(item);
    }
  }

  return services.slice(0, 60);
}

export function buildSuggestions(input: { sourceUrl: string; sourceType: ImportSourceType; previews: PagePreview[]; googlePlaces?: GooglePlacesSuggestion | null; llmExtraction?: LlmImportExtraction | null }): ImportSuggestions {
  const allText = input.previews.map((p) => `${p.title}\n${p.h1}\n${p.h2s.join('\n')}\n${p.firstTextChars}`).join('\n');
  const facts = jsonLdFacts(input.previews);
  const services = [
    ...extractServicesFromJsonLd(input.previews),
    ...extractServicesFromBlocks(input.previews),
    ...extractServicesFromMarkdownLists(input.previews),
    ...input.previews.flatMap((p) => {
      const hasStructuredServiceEvidence = (p.serviceBlocks?.length ?? 0) >= 3 || (p.serviceBlocks ?? []).some((block) => block.sourceHint === 'service_matrix_table');
      return hasStructuredServiceEvidence ? [] : extractServicesFromText(`${p.h1}\n${p.firstTextChars}`, p.url);
    }),
    ...extractServiceLinks(input.previews),
  ];
  const deduped = dedupeServices(services);
  const visiblePhone = extractVisiblePhone(input.previews);
  const rawWebsitePhone = visiblePhone?.value ?? facts.phone ?? allText.match(PHONE_RE)?.[0] ?? null;
  const websiteHours = facts.hours ?? extractHoursFromText(allText);
  const staticAddress = facts.address ?? extractAddressFromText(allText);
  const websitePhone = normalizePhoneForStorage(rawWebsitePhone, staticAddress ?? allText) ?? rawWebsitePhone;
  const warnings: string[] = [];
  if (visiblePhone?.value && facts.phone && phoneComparableDigits(visiblePhone.value) !== phoneComparableDigits(facts.phone)) {
    warnings.push('Visible website phone differs from structured website data. Review before saving.');
  }
  const firstPreview = input.previews[0];
  const firstH1 = firstPreview?.h1?.trim();
  const firstTitle = firstPreview?.title?.trim();
  const firstVisibleName = firstPreview && isHomepagePreview(firstPreview.url, input.sourceUrl)
    ? visibleBusinessNameCandidate(firstPreview)
    : null;
  const staticName = cleanBusinessNameCandidate(facts.name || firstH1 || firstVisibleName || firstTitle || null);
  const staticNameConfidence = facts.name ? 0.92 : firstH1 ? 0.68 : firstVisibleName ? 0.74 : staticName ? 0.62 : 0;
  const websitePrimaryType = inferPrimaryType(allText);
  const bookingLink = input.previews.flatMap((p) => p.links).find((link) => /book|appointment|schedule|reserve|vagaro|booksy|fresha|glossgenius|styleseat/i.test(`${link.text} ${link.href}`))?.href ?? null;
  const secondary = extractSecondaryKnowledge(input.previews);
  return mergeImportSuggestions({
    staticFacts: {
      sourceUrl: input.sourceUrl,
      sourceType: input.sourceType,
      name: field(staticName, staticNameConfidence, facts.name ? 'JSON-LD' : staticName ? 'Website' : null),
      primaryType: field(websitePrimaryType, websitePrimaryType ? 0.74 : 0, websitePrimaryType ? 'Website' : null),
      phone: field(websitePhone, visiblePhone ? 0.82 : facts.phone ? 0.9 : websitePhone ? 0.7 : 0, visiblePhone?.source ?? (facts.phone ? 'JSON-LD' : websitePhone ? 'Website' : null)),
      website: field(input.sourceUrl, 0.95, 'User'),
      address: field(staticAddress, staticAddress ? 0.86 : 0, staticAddress ? 'JSON-LD' : null),
      timezone: inferTimezoneFromAddress(staticAddress)?.value ? inferTimezoneFromAddress(staticAddress)! : field<string>(null, 0, null),
      hours: websiteHours ?? field<Record<string, unknown>>(null, 0, null),
      services: deduped,
      bookingUrl: field(bookingLink, bookingLink ? 0.8 : 0, bookingLink ? 'Website' : null),
      languages: extractLanguages(allText),
      ...secondary,
      warnings,
    },
    googlePlaces: input.googlePlaces,
    llm: input.llmExtraction,
  });
}
