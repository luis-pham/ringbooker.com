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
const COMPRESSED_PRICE_SERVICE_RE = /([A-Z][^$\n]{2,100}?)\s*(?:from|starting at|starts at)?\s*\$\s?(\d{2,4})(\+)?/g;
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
  'Waxing Services',
  'Injectables',
  'Laser Services',
  'Skin Treatments',
  'Cut',
  'Color',
  'Extensions',
  'Style',
  'Blowout',
  'Treatments',
];

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
  if (/balayage|highlight|root|color|colour/.test(lower)) return 'Hair Color';
  if (/haircut|blowout|keratin|hair/.test(lower)) return 'Haircuts';
  if (/wax/.test(lower)) return 'Waxing';
  if (/massage/.test(lower)) return 'Massage';
  if (/facial|hydrafacial|peel/.test(lower)) return 'Facials';
  if (/botox|dysport|filler|inject/.test(lower)) return 'Injectables';
  if (/laser/.test(lower)) return 'Laser';
  if (/lash|brow|eyebrow/.test(lower)) return 'Brows & Lashes';
  if (/makeup|make-up/.test(lower)) return 'Makeup';
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
    { timezone: 'America/New_York', pattern: /\b(new york|ny|new jersey|nj|florida|fl|massachusetts|ma|pennsylvania|pa|washington dc|district of columbia|boston|miami|orlando|philadelphia)\b/i },
    { timezone: 'America/Chicago', pattern: /\b(texas|tx|illinois|il|chicago|dallas|houston|austin|minnesota|mn|wisconsin|wi)\b/i },
    { timezone: 'America/Denver', pattern: /\b(colorado|co|denver|utah|ut|arizona|az|phoenix|new mexico|nm)\b/i },
  ];
  const match = mappings.find((item) => item.pattern.test(address));
  return match ? field(match.timezone, 0.72, 'Address') : null;
}

export function extractServicesFromText(text: string, source: string): ImportedServiceSuggestion[] {
  const services = new Map<string, ImportedServiceSuggestion>();

  const addService = (input: {
    name: string;
    priceText?: string | null;
    priceAmount?: number | null;
    priceType?: ImportedServiceSuggestion['priceType'];
    durationMinutes?: number | null;
    group?: string | null;
    bookingNotes?: string | null;
    confidence: number;
  }) => {
    const name = collapseRepeatedServiceName(cleanServiceName(input.name));
    if (name.length < 3 || name.length > 90) return;
    if (isStylistPricingRowName(name)) return;
    if (/^(this is|service includes|includes|perfect for|ideal for|not sure|our service|pricing is based)\b/i.test(name)) return;
    const categoryName = input.group?.trim() || inferGroup(name);
    const key = `${categoryName.toLowerCase()}::${name.toLowerCase()}`;
    if (services.has(key)) return;
    const priceAmount = input.priceAmount ?? (input.priceText ? Number(input.priceText) : null);
    services.set(key, {
      categoryName,
      name,
      priceAmount,
      priceCurrency: CURRENCY,
      priceType: input.priceType ?? (priceAmount ? 'fixed' : /consult/i.test(name) ? 'consultation' : 'varies'),
      durationMinutes: input.durationMinutes ?? null,
      aliases: aliasFor(name),
      bookingNotes: input.bookingNotes ?? null,
      bookable: true,
      source,
      confidence: input.confidence,
    });
  };

  for (const item of extractStylistPricingServices(text)) {
    addService({ ...item, confidence: 0.86 });
  }

  for (const rawLine of text.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    const match = rawLine.match(SERVICE_LINE_RE);
    if (!match) continue;
    const lower = rawLine.toLowerCase();
    const parsed = splitServiceHeadingPrefix(match[1]);
    addService({
      name: parsed.name,
      priceText: match[2],
      priceType: /from|starting|starts at|\+/.test(lower) ? 'from' : 'fixed',
      durationMinutes: match[3] ? Number(match[3]) : null,
      group: parsed.group,
      confidence: parsed.group ? 0.88 : 0.84,
    });
  }

  let currentCompressedGroup: string | null = null;
  const compressedText = cleanCompressedServiceText(text);
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

  for (const rawLine of compressedText.split(/[\n•]+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    const line = rawLine.slice(0, 180);
    const match = line.match(SERVICE_LINE_RE);
    const hasServiceKeyword = /manicure|pedicure|balayage|highlight|haircut|massage|facial|wax|botox|filler|laser|lash|brow|treatment/i.test(line);
    if (!match && !hasServiceKeyword) continue;
    const priceText = match?.[2];
    const lower = line.toLowerCase();
    const parsed = splitServiceHeadingPrefix(match?.[1] ?? line.replace(/\$.*$/, ''));
    addService({
      name: parsed.name,
      priceText,
      priceType: /from|starting|starts at|\+/.test(lower) ? 'from' : priceText ? 'fixed' : /consult/.test(lower) ? 'consultation' : 'varies',
      durationMinutes: match?.[3] ? Number(match[3]) : null,
      group: parsed.group,
      confidence: match ? 0.82 : 0.62,
    });
  }
  return [...services.values()].slice(0, 80);
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
    .replace(/\bLoad More\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isStylistPricingRowName(name: string): boolean {
  return /^(assistant|level\s*\d|all levels?)\s+stylists?\b/i.test(name)
    || /\bpricing\s+(assistant|level\s*\d|all levels?)\s+stylists?\b/i.test(name);
}

function normalizePricingServiceName(value: string): string {
  return cleanServiceName(value)
    .replace(/\bpricing\b/gi, ' ')
    .replace(/\b(in|near)\s+[A-Z][A-Za-z\s,-]{2,40}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
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
    .replace(/\bInvolves\b.*$/i, '')
    .replace(/\bPricing is based\b.*$/i, '')
    .replace(/Pricing\s*is\s*based.*$/i, '')
    .replace(/Starting\s*at.*$/i, '')
    .replace(/Starts\s*at.*$/i, '')
    .replace(/^(services|service|treatments|treatment|menu)\s*:?\s*/i, '')
    .replace(/\b(from|starting at|starts at|starting)\s*$/i, '')
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

function extractServiceLinks(previews: PagePreview[]): ImportedServiceSuggestion[] {
  const services = new Map<string, ImportedServiceSuggestion>();
  for (const preview of previews) {
    for (const link of preview.links) {
      if (!/\/services?\//i.test(new URL(link.href).pathname) && !/services?/i.test(link.href)) continue;
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

    if (/(staff|team|stylist|artist|provider|injector|esthetician|barber)/i.test(lowerContext)) {
      const staffLineRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*(?:[-–—,|]\s*)?(Stylist|Colorist|Artist|Provider|Technician|Injector|Esthetician|Barber|Owner|Manager|Massage Therapist)\b/g;
      for (const match of text.matchAll(staffLineRe)) {
        const name = cleanStaffName(match[1]);
        if (!name) continue;
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
    }

    const policyTypePatterns: Array<[PolicySuggestion['type'], RegExp, string]> = [
      ['cancellation', /\b(cancellation|cancel)\b[^.\n]{20,420}/gi, 'Cancellation policy'],
      ['no_show', /\b(no-show|no show)\b[^.\n]{20,420}/gi, 'No-show policy'],
      ['deposit', /\b(deposit)\b[^.\n]{20,420}/gi, 'Deposit policy'],
      ['late_arrival', /\b(late arrival|late)\b[^.\n]{20,420}/gi, 'Late arrival policy'],
      ['walk_ins', /\b(walk-ins|walk ins|walkin)\b[^.\n]{20,420}/gi, 'Walk-ins'],
      ['refund', /\b(refund)\b[^.\n]{20,420}/gi, 'Refund policy'],
      ['appointment_prep', /\b(prep|preparation|aftercare)\b[^.\n]{20,420}/gi, 'Appointment preparation'],
      ['consultation', /\b(consultation required|consultation)\b[^.\n]{20,420}/gi, 'Consultation'],
    ];
    for (const [type, pattern, title] of policyTypePatterns) {
      for (const match of text.matchAll(pattern)) {
        const content = sanitizeSnippet(match[0], 500);
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

export function buildSuggestions(input: { sourceUrl: string; sourceType: ImportSourceType; previews: PagePreview[]; googlePlaces?: GooglePlacesSuggestion | null; llmExtraction?: LlmImportExtraction | null }): ImportSuggestions {
  const allText = input.previews.map((p) => `${p.title}\n${p.h1}\n${p.h2s.join('\n')}\n${p.firstTextChars}`).join('\n');
  const facts = jsonLdFacts(input.previews);
  const services = [
    ...input.previews.flatMap((p) => extractServicesFromText(`${p.h1}\n${p.h2s.join('\n')}\n${p.firstTextChars}`, p.url)),
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
  const staticName = facts.name ?? input.previews[0]?.h1 ?? input.previews[0]?.title ?? null;
  const websitePrimaryType = inferPrimaryType(allText);
  const bookingLink = input.previews.flatMap((p) => p.links).find((link) => /book|appointment|schedule|reserve|vagaro|booksy|fresha|glossgenius|styleseat/i.test(`${link.text} ${link.href}`))?.href ?? null;
  const secondary = extractSecondaryKnowledge(input.previews);
  return mergeImportSuggestions({
    staticFacts: {
      sourceUrl: input.sourceUrl,
      sourceType: input.sourceType,
      name: field(staticName, facts.name ? 0.92 : staticName ? 0.68 : 0, facts.name ? 'JSON-LD' : staticName ? 'Website' : null),
      primaryType: field(websitePrimaryType, websitePrimaryType ? 0.74 : 0, websitePrimaryType ? 'Website' : null),
      phone: field(websitePhone, visiblePhone ? 0.82 : facts.phone ? 0.9 : websitePhone ? 0.7 : 0, visiblePhone?.source ?? (facts.phone ? 'JSON-LD' : websitePhone ? 'Website' : null)),
      website: field(input.sourceUrl, 0.95, 'User'),
      address: field(staticAddress, staticAddress ? 0.86 : 0, staticAddress ? 'JSON-LD' : null),
      timezone: inferTimezoneFromAddress(staticAddress)?.value ? inferTimezoneFromAddress(staticAddress)! : field<string>(null, 0, null),
      hours: websiteHours ?? field<Record<string, unknown>>(null, 0, null),
      services: deduped,
      bookingUrl: field(bookingLink, bookingLink ? 0.8 : 0, bookingLink ? 'Website' : null),
      languages: [],
      ...secondary,
      warnings,
    },
    googlePlaces: input.googlePlaces,
    llm: input.llmExtraction,
  });
}
