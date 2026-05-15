import type {
  BookingSetupSuggestion,
  FaqSuggestion,
  ImportedServiceSuggestion,
  ImportField,
  ImportSuggestions,
  LlmImportExtraction,
  PolicySuggestion,
  PromotionSuggestion,
  StaffSuggestion,
  WebsiteImportCompleteness,
  WeeklyHours,
} from './types';
import type { GooglePlacesSuggestion } from './google-places';
import { normalizePhoneForStorage, phoneComparableDigits } from '@/lib/phone-number';

export type StaticImportFacts = {
  sourceUrl: string;
  sourceType: ImportSuggestions['sourceType'];
  name: ImportField<string>;
  primaryType: ImportField<string>;
  phone: ImportField<string>;
  website: ImportField<string>;
  address: ImportField<string>;
  timezone: ImportField<string>;
  hours: ImportField<WeeklyHours>;
  services: ImportedServiceSuggestion[];
  bookingUrl: ImportField<string>;
  languages?: Array<ImportField<string>>;
  staffSuggestions?: StaffSuggestion[];
  policySuggestions?: PolicySuggestion[];
  faqSuggestions?: FaqSuggestion[];
  promotionSuggestions?: PromotionSuggestion[];
  bookingSetupSuggestions?: BookingSetupSuggestion[];
  warnings?: string[];
};

function field<T>(value: T | null, confidence: number, source: string | null): ImportField<T> {
  return { value, confidence: value === null ? 0 : Math.max(0, Math.min(1, confidence)), source: value === null ? null : source };
}
function normalizeText(value?: string | null): string { return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' '); }
function normalizeDomain(value?: string | null): string {
  if (!value) return '';
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return value.replace(/^www\./, '').toLowerCase(); }
}
function normalizeAddressForCompare(value?: string | null): string {
  return normalizeText(value)
    .replace(/#\s*([a-z0-9-]+)/g, ' ste $1')
    .replace(/[.,]/g, '')
    .replace(/\b(united states of america|united states|usa|us)\b/g, '')
    .replace(/\b(street)\b/g, 'st')
    .replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(road)\b/g, 'rd')
    .replace(/\b(boulevard)\b/g, 'blvd')
    .replace(/\b(drive)\b/g, 'dr')
    .replace(/\b(lane)\b/g, 'ln')
    .replace(/\b(court)\b/g, 'ct')
    .replace(/\b(place)\b/g, 'pl')
    .replace(/\b(suite)\b/g, 'ste')
    .replace(/\b(unit|apt|apartment)\b/g, 'ste')
    .replace(/\b(north)\b/g, 'n')
    .replace(/\b(south)\b/g, 's')
    .replace(/\b(east)\b/g, 'e')
    .replace(/\b(west)\b/g, 'w')
    .replace(/\b(texas)\b/g, 'tx')
    .replace(/\b(california)\b/g, 'ca')
    .replace(/\b(ohio)\b/g, 'oh')
    .replace(/\b(new york)\b/g, 'ny')
    .replace(/\b(florida)\b/g, 'fl')
    .replace(/\s+/g, ' ')
    .trim();
}
function timeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().toLowerCase().replace(/\s+/g, '').match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3];
  if (hour > 23 || minute > 59) return null;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}
function normalizeDayHoursForCompare(value: unknown): string {
  if (!value || typeof value !== 'object') return normalizeText(String(value ?? ''));
  const raw = value as Record<string, unknown>;
  if (raw.closed === true) return 'closed';
  const open = timeToMinutes(raw.open);
  const close = timeToMinutes(raw.close);
  if (open !== null && close !== null) return `${open}-${close}`;
  return normalizeText(JSON.stringify(raw));
}
function normalizeHoursForCompare(value?: WeeklyHours | null): string {
  if (!value) return '';
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return JSON.stringify(days.reduce<Record<string, string>>((out, key) => {
    // Google Places only returns open periods; closed days are commonly absent.
    // Treat absent days as closed for weekly-hours conflict comparison.
    out[key] = Object.prototype.hasOwnProperty.call(value, key) ? normalizeDayHoursForCompare(value[key]) : 'closed';
    return out;
  }, {}));
}
function hoursDayCount(value?: WeeklyHours | null): number {
  return value ? Object.keys(value).length : 0;
}
function inferTimezoneFromAddress(address?: string | null): string | null {
  if (!address) return null;
  if (/\b(california|ca|los angeles|san francisco|san diego|san jose|sacramento|washington|oregon|nevada|seattle|portland|las vegas)\b/i.test(address)) return 'America/Los_Angeles';
  if (/\b(new york|ny|new jersey|nj|florida|fl|massachusetts|ma|pennsylvania|pa|ohio|oh|washington dc|district of columbia|boston|miami|orlando|philadelphia|cleveland|columbus)\b/i.test(address)) return 'America/New_York';
  if (/\b(texas|tx|illinois|il|chicago|dallas|houston|austin|minnesota|mn|wisconsin|wi)\b/i.test(address)) return 'America/Chicago';
  if (/\b(colorado|co|denver|utah|ut|arizona|az|phoenix|new mexico|nm)\b/i.test(address)) return 'America/Denver';
  return null;
}
function choose<T>(...candidates: Array<ImportField<T> | null | undefined>): ImportField<T> { return candidates.find((c) => c && c.value !== null && c.value !== undefined && c.value !== '') ?? field<T>(null, 0, null); }
function placesField<T>(value: T | null | undefined, confidence: number): ImportField<T> | null { return value === null || value === undefined || value === '' ? null : field(value, confidence, 'Google Places'); }
function maybeLlm<T>(candidate?: ImportField<T>): ImportField<T> | null { return candidate?.value === null || candidate?.value === undefined || candidate?.value === '' ? null : candidate ?? null; }
function parseServiceDuration(value: string): { durationText: string; durationMinutes: number | null } | null {
  const match = value.trim().match(/\b(\d{1,3})\s*(?:min|mins|minutes)(\+)?(?=\s|$)/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return { durationText: `${minutes} min${match[2] ? '+' : ''}`, durationMinutes: minutes };
}

function canonicalServiceGroupName(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'General Services';
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .trim();
  const compact = cleaned.replace(/\s+services?$/i, '').trim();
  const lower = compact.toLowerCase().replace(/[&+]/g, 'and');
  if (/^(hair\s*)?colou?r$/.test(lower)) return 'Hair Color';
  if (/^(hair\s*)?cuts?$/.test(lower) || /^hair\s+cuts?$/.test(lower) || /^cutting$/.test(lower)) return 'Haircuts';
  if (/^(hair\s*)?treatments?$/.test(lower) || /^conditioning treatments?$/.test(lower) || /^deep conditioning treatments?$/.test(lower)) return 'Treatments';
  if (/^(facial|facials|facial\/hydrafacial|hydrafacial|hydra facial)$/.test(lower)) return 'Facials';
  if (/^body treatments?$/.test(lower)) return 'Body Treatments';
  if (/^waxing?$/.test(lower)) return 'Waxing';
  return cleaned || 'General Services';
}

function splitMergedServiceName(service: ImportedServiceSuggestion): ImportedServiceSuggestion {
  const name = service.name?.trim() ?? '';
  if (!name.includes('•')) return { ...service, name };
  const parts = name.split(/\s*•\s*/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return { ...service, name };
  const durationPart = parts.find((part) => parseServiceDuration(part));
  const duration = durationPart ? parseServiceDuration(durationPart) : null;
  const first = parts[0].replace(/\s+/g, ' ').trim();
  const descriptionStart = first.search(/\b(shampoo\s*&\s*condition|shampoo\s+and\s+condition|wash\s*&\s*style|wash\s+and\s+style|blow\s+dry|style\s+included)\b/i);
  let cleanName = descriptionStart > 2 ? first.slice(0, descriptionStart).trim() : first;
  let categoryName = service.categoryName;
  const groupPrefixMatch = cleanName.match(/^(Blowout|Color|Cut|Extensions|Style|Treatments)\s+(.{3,80})$/i);
  if (groupPrefixMatch?.[1] && groupPrefixMatch[2]) {
    categoryName = canonicalServiceGroupName(groupPrefixMatch[1].replace(/\b\w/g, (char) => char.toUpperCase()));
    cleanName = groupPrefixMatch[2].trim();
  }
  const descriptionParts = [
    descriptionStart > 2 ? first.slice(descriptionStart).trim() : null,
    ...parts.slice(1).filter((part) => part !== durationPart && !/\$\s*\d/.test(part)),
  ].filter((part): part is string => Boolean(part));
  if (cleanName.length < 3) return { ...service, name };
  return {
    ...service,
    categoryName,
    name: cleanName,
    description: service.description ?? (descriptionParts.length ? descriptionParts.join(' • ') : null),
    durationText: service.durationText ?? duration?.durationText ?? null,
    durationMinutes: service.durationMinutes ?? duration?.durationMinutes ?? null,
  };
}
function isInvalidMergedServiceName(value: string): boolean {
  const name = value.trim();
  return !name
    || /^(?:\d+\s*(?:min|mins|minutes|hour|hours|hr)\+?|\$?\s*\d+|book now|book online|schedule|reserve|appointment|consultation required)$/i.test(name)
    || /\$/.test(name)
    || /\b\d{1,3}\s*(?:min|mins|minutes|hour|hours|hr)\+?\s*$/i.test(name)
    || (name.match(/\b\d{1,3}\s*(?:min|mins|minutes|hour|hours|hr)\b/gi)?.length ?? 0) >= 2
    || /^(?:you|your|our|we|at|experience|discover|looking|relax,)\b/i.test(name)
    || /\b(cancellation|refund|privacy|policy|faq|address|directions|contact us)\b/i.test(name);
}
function dedupeServices(services: ImportedServiceSuggestion[]): ImportedServiceSuggestion[] {
  const map = new Map<string, ImportedServiceSuggestion>();
  for (const rawService of services) {
    const service = splitMergedServiceName(rawService);
    const name = service.name?.trim();
    if (!name) continue;
    if (isInvalidMergedServiceName(name)) continue;
    const category = canonicalServiceGroupName(service.categoryName);
    const key = `${category}:${name}`.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...service, categoryName: category, name, variants: normalizeServiceVariantsForMerge(service.variants) });
      continue;
    }
    const mergedVariants = mergeServiceVariants(current.variants, service.variants);
    if ((service.confidence ?? 0) > (current.confidence ?? 0)) {
      map.set(key, { ...service, categoryName: category, name, variants: mergedVariants });
    } else {
      current.variants = mergedVariants;
      if (mergedVariants.length) current.needsReview = current.needsReview || service.needsReview;
    }
  }
  return [...map.values()].slice(0, 80);
}

function normalizeServiceVariantsForMerge(variants?: ImportedServiceSuggestion['variants']): NonNullable<ImportedServiceSuggestion['variants']> {
  return (variants ?? [])
    .map((variant, index) => ({
      label: variant.label?.trim() || variant.durationText?.trim() || (variant.priceAmount !== null && variant.priceAmount !== undefined ? `$${variant.priceAmount}` : `Option ${index + 1}`),
      durationMinutes: variant.durationMinutes ?? null,
      durationText: variant.durationText?.trim() || (variant.durationMinutes ? `${variant.durationMinutes} min` : null),
      priceAmount: variant.priceAmount ?? null,
      priceCurrency: variant.priceCurrency ?? 'USD',
      priceType: variant.priceType ?? 'fixed',
      sortOrder: variant.sortOrder ?? index,
      notes: variant.notes ?? null,
    }))
    .filter((variant) => variant.label || variant.durationText || variant.priceAmount !== null)
    .slice(0, 20);
}

function mergeServiceVariants(a?: ImportedServiceSuggestion['variants'], b?: ImportedServiceSuggestion['variants']): NonNullable<ImportedServiceSuggestion['variants']> {
  const out: NonNullable<ImportedServiceSuggestion['variants']> = [];
  const seen = new Set<string>();
  for (const variant of [...normalizeServiceVariantsForMerge(a), ...normalizeServiceVariantsForMerge(b)]) {
    const key = `${variant.durationText ?? variant.label}:${variant.priceAmount ?? ''}:${variant.priceType ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...variant, sortOrder: out.length });
  }
  return out.slice(0, 20);
}
function serviceGroups(services: ImportedServiceSuggestion[], llm?: LlmImportExtraction | null) {
  const groups = new Map<string, { name: string; source: string; confidence: number; groupKind: 'primary' | 'addon' | 'custom' | null }>();
  for (const category of llm?.serviceCatalog?.categories ?? []) {
    const name = canonicalServiceGroupName(category.name);
    if (!name.trim()) continue;
    const key = name.toLowerCase();
    const existing = groups.get(key);
    const next = { name, source: category.source ?? 'AI', confidence: category.confidence, groupKind: category.groupKind ?? null };
    if (!existing || next.confidence > existing.confidence) groups.set(key, next);
  }
  for (const service of services) {
    const name = canonicalServiceGroupName(service.categoryName);
    if (!groups.has(name.toLowerCase())) groups.set(name.toLowerCase(), { name, source: service.source || 'Website', confidence: Math.max(0.65, service.confidence ?? 0.65), groupKind: name === 'General Services' ? 'custom' : 'addon' });
  }
  return [...groups.values()];
}
function dedupeSuggestions<T>(items: T[], keyFn: (item: T) => string, max = 40): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item).trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, item);
  }
  return [...map.values()].slice(0, max);
}
export function computeCompleteness(suggestions: Omit<ImportSuggestions, 'completeness'>): WebsiteImportCompleteness {
  const missingFields: string[] = [];
  const lowConfidenceFields: string[] = [];
  const fields: Array<[string, ImportField<unknown>]> = [
    ['business name', suggestions.businessProfile.name], ['business type', suggestions.businessProfile.primaryType], ['phone', suggestions.businessProfile.phone], ['address', suggestions.businessProfile.address], ['timezone', suggestions.businessProfile.timezone], ['hours', suggestions.hours], ['booking URL', suggestions.bookingUrl],
  ];
  for (const [name, candidate] of fields) {
    if (!candidate.value) missingFields.push(name);
    else if (candidate.confidence < 0.7) lowConfidenceFields.push(name);
  }
  if (suggestions.serviceCatalog.services.length === 0) missingFields.push('services');
  else if (suggestions.serviceCatalog.confidence < 0.7) lowConfidenceFields.push('services');
  const businessProfileCompleteness = [suggestions.businessProfile.name, suggestions.businessProfile.primaryType, suggestions.businessProfile.timezone].filter((item) => item.value).length / 3;
  const contactCompleteness = [suggestions.businessProfile.phone, suggestions.businessProfile.address, suggestions.businessProfile.website].filter((item) => item.value).length / 3;
  const hoursCompleteness = suggestions.hours.value ? suggestions.hours.confidence : 0;
  const serviceCompleteness = suggestions.serviceCatalog.services.length >= 3 ? Math.max(0.7, suggestions.serviceCatalog.confidence) : suggestions.serviceCatalog.services.length > 0 ? suggestions.serviceCatalog.confidence : 0;
  const overallConfidence = Math.round(((businessProfileCompleteness * 0.3) + (contactCompleteness * 0.2) + (hoursCompleteness * 0.25) + (serviceCompleteness * 0.25)) * 100) / 100;
  let recommendedNextAction: WebsiteImportCompleteness['recommendedNextAction'] = 'ready_for_review';
  if (businessProfileCompleteness === 0 && contactCompleteness === 0 && serviceCompleteness === 0) recommendedNextAction = 'manual_setup_recommended';
  else if (suggestions.warnings.some((warning) => /differs|ambiguous|multiple/i.test(warning)) || lowConfidenceFields.length > 0) recommendedNextAction = 'needs_manual_review';
  else if (!suggestions.hours.value) recommendedNextAction = 'partial_import';
  else if (suggestions.serviceCatalog.services.length === 0) recommendedNextAction = 'service_details_incomplete';
  return { businessProfileCompleteness, contactCompleteness, hoursCompleteness, serviceCompleteness, overallConfidence, missingFields, lowConfidenceFields, recommendedNextAction };
}
export function mergeImportSuggestions(input: { staticFacts: StaticImportFacts; googlePlaces?: GooglePlacesSuggestion | null; llm?: LlmImportExtraction | null }): ImportSuggestions {
  const warnings = [...(input.staticFacts.warnings ?? []), ...(input.googlePlaces?.warnings ?? []), ...(input.llm?.warnings ?? [])];
  const places = input.googlePlaces ?? null;
  const llm = input.llm ?? null;
  const rawPlaceConfidence = places?.matchConfidence ?? (input.staticFacts.sourceType === 'google_maps' && places ? 0.95 : 0);
  // A Google Places result whose listed website exactly matches the submitted URL is a strong identity
  // signal even when phone/address hints were unavailable (e.g. website blocked the scraper).
  // Only activates for unambiguous matches (lookupGooglePlaces already returns a warning-only object
  // with no `website` field when two candidates score too closely, so this stays false in that case).
  const placesDomainMatchesSubmittedUrl = Boolean(
    places?.website && normalizeDomain(places.website) === normalizeDomain(input.staticFacts.sourceUrl),
  );
  const trustPlaces = Boolean(places) && (
    input.staticFacts.sourceType === 'google_maps'
    || rawPlaceConfidence >= 0.6
    || (placesDomainMatchesSubmittedUrl && rawPlaceConfidence >= 0.45)
  );
  const trustedPlaces = trustPlaces ? places : null;
  if (places && !trustPlaces && rawPlaceConfidence > 0) warnings.push('Google Places match was low confidence. Website details were kept for review.');
  if (trustedPlaces?.phone && input.staticFacts.phone.value && phoneComparableDigits(trustedPlaces.phone) !== phoneComparableDigits(input.staticFacts.phone.value)) warnings.push('Google Places phone differs from website phone. Review before saving.');
  const placesAddressSameAsWebsite = Boolean(trustedPlaces?.address && input.staticFacts.address.value && normalizeAddressForCompare(trustedPlaces.address) === normalizeAddressForCompare(input.staticFacts.address.value));
  const placesHoursSameAsWebsite = Boolean(trustedPlaces?.hours && input.staticFacts.hours.value && normalizeHoursForCompare(trustedPlaces.hours as WeeklyHours) === normalizeHoursForCompare(input.staticFacts.hours.value));
  if (trustedPlaces?.address && input.staticFacts.address.value && !placesAddressSameAsWebsite) warnings.push('Google Places address differs from website address. Review before saving.');
  if (trustedPlaces?.hours && input.staticFacts.hours.value && !placesHoursSameAsWebsite) warnings.push('Google Places hours differ from website hours. Review before saving.');
  const llmServices = llm?.serviceCatalog?.services ?? [];
  const staticServices = input.staticFacts.services;
  const services = dedupeServices(llmServices.length ? [...llmServices, ...staticServices] : staticServices);
  const serviceConfidence = services.length >= 3 ? Math.max(llm?.serviceCatalog?.confidence ?? 0, 0.78) : services.length > 0 ? Math.max(llm?.serviceCatalog?.confidence ?? 0, 0.55) : 0;
  if (serviceConfidence > 0 && serviceConfidence < 0.7) warnings.push('Some imported service details need review.');
  const placeConfidence = trustPlaces ? Math.max(0.85, rawPlaceConfidence) : 0;
  const isGoogleMapsImport = input.staticFacts.sourceType === 'google_maps';
  const placesWebsiteMatchesSubmitted = Boolean(trustedPlaces?.website && normalizeDomain(trustedPlaces.website) === normalizeDomain(input.staticFacts.sourceUrl));
  const placesPhoneMatchesWebsite = Boolean(trustedPlaces?.phone && input.staticFacts.phone.value && phoneComparableDigits(trustedPlaces.phone) === phoneComparableDigits(input.staticFacts.phone.value));
  const placesIdentityAllowedForWebsite = Boolean(
    !isGoogleMapsImport
    && trustedPlaces?.name
    && !input.staticFacts.name.value
    && (placesWebsiteMatchesSubmitted || placesPhoneMatchesWebsite || placesAddressSameAsWebsite),
  );
  // For normal websites, Google Places is used to strengthen contact details,
  // not to define identity unless domain/phone/address corroborates the match.
  // This avoids wrong account/place names replacing a sparse website import.
  const name = isGoogleMapsImport
    ? choose(placesField(trustedPlaces?.name, placeConfidence ? 0.94 : 0), input.staticFacts.name.source === 'JSON-LD' ? input.staticFacts.name : null, input.staticFacts.name, maybeLlm(llm?.businessProfile?.name))
    : choose(input.staticFacts.name.source === 'JSON-LD' ? input.staticFacts.name : null, input.staticFacts.name, maybeLlm(llm?.businessProfile?.name), placesIdentityAllowedForWebsite ? placesField(trustedPlaces?.name, placeConfidence ? 0.86 : 0) : null);
  const rawPhone = choose(placesField(trustedPlaces?.phone, placeConfidence ? 0.96 : 0), input.staticFacts.phone, maybeLlm(llm?.businessProfile?.phone));
  const address = choose(placesAddressSameAsWebsite ? input.staticFacts.address : null, placesField(trustedPlaces?.address, placeConfidence ? 0.96 : 0), input.staticFacts.address, maybeLlm(llm?.businessProfile?.address));
  const phone = rawPhone.value ? field(normalizePhoneForStorage(rawPhone.value, address.value ?? trustedPlaces?.address ?? input.staticFacts.address.value) ?? rawPhone.value, rawPhone.confidence, rawPhone.source) : rawPhone;
  const websiteHoursIsComplete = hoursDayCount(input.staticFacts.hours.value) >= 5 && input.staticFacts.hours.confidence >= 0.7;
  const hours = isGoogleMapsImport
    ? choose<WeeklyHours>(placesField(trustedPlaces?.hours ?? null, placeConfidence ? 0.95 : 0), input.staticFacts.hours.source === 'JSON-LD' ? input.staticFacts.hours : null, input.staticFacts.hours, maybeLlm(llm?.hours))
    : choose<WeeklyHours>(placesHoursSameAsWebsite || websiteHoursIsComplete ? input.staticFacts.hours : null, placesField(trustedPlaces?.hours ?? null, placeConfidence ? 0.95 : 0), input.staticFacts.hours.source === 'JSON-LD' ? input.staticFacts.hours : null, input.staticFacts.hours, maybeLlm(llm?.hours));
  const timezone = choose(placesField(trustedPlaces?.timezone ?? inferTimezoneFromAddress(trustedPlaces?.address), placeConfidence ? 0.9 : 0), input.staticFacts.timezone, maybeLlm(llm?.businessProfile?.timezone));
  const website = choose(placesField(trustedPlaces?.website, placeConfidence ? 0.94 : 0), input.staticFacts.website, maybeLlm(llm?.businessProfile?.website));
  const primaryType = isGoogleMapsImport
    ? choose(placesField(trustedPlaces?.primaryType, placeConfidence ? 0.78 : 0), input.staticFacts.primaryType, maybeLlm(llm?.businessProfile?.primaryType))
    : choose(input.staticFacts.primaryType, maybeLlm(llm?.businessProfile?.primaryType), placesIdentityAllowedForWebsite ? placesField(trustedPlaces?.primaryType, placeConfidence ? 0.72 : 0) : null);
  const bookingUrl = choose(input.staticFacts.bookingUrl, maybeLlm(llm?.bookingUrl));
  const categories = serviceGroups(services, llm);
  const staffSuggestions = dedupeSuggestions([...(input.staticFacts.staffSuggestions ?? []), ...(llm?.staffSuggestions ?? [])], (item) => item.name, 25);
  const policySuggestions = dedupeSuggestions([...(input.staticFacts.policySuggestions ?? []), ...(llm?.policySuggestions ?? [])], (item) => `${item.type}:${item.title}:${item.content}`, 25);
  const faqSuggestions = dedupeSuggestions([...(input.staticFacts.faqSuggestions ?? []), ...(llm?.faqSuggestions ?? [])], (item) => item.question, 40);
  const promotionSuggestions = dedupeSuggestions([...(input.staticFacts.promotionSuggestions ?? []), ...(llm?.promotionSuggestions ?? [])], (item) => item.title, 20);
  const bookingSetupSuggestions = dedupeSuggestions([...(input.staticFacts.bookingSetupSuggestions ?? []), ...(llm?.bookingSetupSuggestions ?? [])], (item) => `${item.type}:${item.value ?? item.label}`, 20);
  const base: Omit<ImportSuggestions, 'completeness'> = {
    status: name.value || phone.value || address.value || hours.value || services.length ? (services.length || phone.value || address.value || hours.value ? 'success' : 'partial') : 'failed',
    sourceUrl: input.staticFacts.sourceUrl,
    sourceType: input.staticFacts.sourceType,
    businessProfile: { name, primaryType, phone, website, address, timezone },
    hours,
    serviceCatalog: { confidence: serviceConfidence, source: services[0]?.source ?? llm?.serviceCatalog?.source ?? null, categories, services },
    alsoOffers: categories.map((category) => field(category.name, Math.max(0.7, category.confidence), 'Service catalog')),
    bookingUrl,
    languages: llm?.languages ?? input.staticFacts.languages ?? [],
    staffSuggestions,
    policySuggestions,
    faqSuggestions,
    promotionSuggestions,
    bookingSetupSuggestions,
    warnings: [...new Set(warnings)],
  };
  return { ...base, completeness: computeCompleteness(base) };
}
