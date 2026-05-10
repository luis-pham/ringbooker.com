import type { ImportedServiceSuggestion, ImportField, ImportSuggestions, LlmImportExtraction, WebsiteImportCompleteness, WeeklyHours } from './types';
import type { GooglePlacesSuggestion } from './google-places';

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
  warnings?: string[];
};

function field<T>(value: T | null, confidence: number, source: string | null): ImportField<T> {
  return { value, confidence: value === null ? 0 : Math.max(0, Math.min(1, confidence)), source: value === null ? null : source };
}
function normalizePhone(value?: string | null): string { return (value ?? '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); }
function normalizeText(value?: string | null): string { return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' '); }
function inferTimezoneFromAddress(address?: string | null): string | null {
  if (!address) return null;
  if (/\b(california|ca|los angeles|san francisco|san diego|san jose|sacramento|washington|oregon|nevada|seattle|portland|las vegas)\b/i.test(address)) return 'America/Los_Angeles';
  if (/\b(new york|ny|new jersey|nj|florida|fl|massachusetts|ma|pennsylvania|pa|washington dc|district of columbia|boston|miami|orlando|philadelphia)\b/i.test(address)) return 'America/New_York';
  if (/\b(texas|tx|illinois|il|chicago|dallas|houston|austin|minnesota|mn|wisconsin|wi)\b/i.test(address)) return 'America/Chicago';
  if (/\b(colorado|co|denver|utah|ut|arizona|az|phoenix|new mexico|nm)\b/i.test(address)) return 'America/Denver';
  return null;
}
function choose<T>(...candidates: Array<ImportField<T> | null | undefined>): ImportField<T> { return candidates.find((c) => c && c.value !== null && c.value !== undefined && c.value !== '') ?? field<T>(null, 0, null); }
function placesField<T>(value: T | null | undefined, confidence: number): ImportField<T> | null { return value === null || value === undefined || value === '' ? null : field(value, confidence, 'Google Places'); }
function maybeLlm<T>(candidate?: ImportField<T>): ImportField<T> | null { return candidate?.value === null || candidate?.value === undefined || candidate?.value === '' ? null : candidate ?? null; }
function dedupeServices(services: ImportedServiceSuggestion[]): ImportedServiceSuggestion[] {
  const map = new Map<string, ImportedServiceSuggestion>();
  for (const service of services) {
    const name = service.name?.trim();
    if (!name) continue;
    const category = service.categoryName?.trim() || 'General Services';
    const key = `${category}:${name}`.toLowerCase();
    const current = map.get(key);
    if (!current || (service.confidence ?? 0) > (current.confidence ?? 0)) map.set(key, { ...service, categoryName: category, name });
  }
  return [...map.values()].slice(0, 80);
}
function serviceGroups(services: ImportedServiceSuggestion[], llm?: LlmImportExtraction | null) {
  const groups = new Map<string, { name: string; source: string; confidence: number; groupKind: 'primary' | 'addon' | 'custom' | null }>();
  for (const category of llm?.serviceCatalog?.categories ?? []) {
    if (category.name.trim()) groups.set(category.name.trim().toLowerCase(), { name: category.name.trim(), source: category.source ?? 'AI', confidence: category.confidence, groupKind: category.groupKind ?? null });
  }
  for (const service of services) {
    const name = service.categoryName?.trim() || 'General Services';
    if (!groups.has(name.toLowerCase())) groups.set(name.toLowerCase(), { name, source: service.source || 'Website', confidence: Math.max(0.65, service.confidence ?? 0.65), groupKind: name === 'General Services' ? 'custom' : 'addon' });
  }
  return [...groups.values()];
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
  if (places?.phone && input.staticFacts.phone.value && normalizePhone(places.phone) !== normalizePhone(input.staticFacts.phone.value)) warnings.push('Google Places phone differs from website phone. Review before saving.');
  if (places?.address && input.staticFacts.address.value && normalizeText(places.address) !== normalizeText(input.staticFacts.address.value)) warnings.push('Google Places address differs from website address. Review before saving.');
  if (places?.hours && input.staticFacts.hours.value && JSON.stringify(places.hours) !== JSON.stringify(input.staticFacts.hours.value)) warnings.push('Google Places hours differ from website hours. Review before saving.');
  const llmServices = llm?.serviceCatalog?.services ?? [];
  const staticServices = input.staticFacts.services;
  const services = dedupeServices(llmServices.length ? [...llmServices, ...staticServices] : staticServices);
  const serviceConfidence = services.length >= 3 ? Math.max(llm?.serviceCatalog?.confidence ?? 0, 0.78) : services.length > 0 ? Math.max(llm?.serviceCatalog?.confidence ?? 0, 0.55) : 0;
  if (serviceConfidence > 0 && serviceConfidence < 0.7) warnings.push('Some imported service details need review.');
  const placeConfidence = Math.max(0.85, places?.matchConfidence ?? 0);
  const name = choose(placesField(places?.name, placeConfidence >= 0.82 ? 0.94 : 0.72), input.staticFacts.name.source === 'JSON-LD' ? input.staticFacts.name : null, input.staticFacts.name, maybeLlm(llm?.businessProfile?.name));
  const phone = choose(placesField(places?.phone, placeConfidence >= 0.82 ? 0.96 : 0.72), input.staticFacts.phone, maybeLlm(llm?.businessProfile?.phone));
  const address = choose(placesField(places?.address, placeConfidence >= 0.82 ? 0.96 : 0.72), input.staticFacts.address, maybeLlm(llm?.businessProfile?.address));
  const hours = choose<WeeklyHours>(placesField(places?.hours ?? null, placeConfidence >= 0.82 ? 0.95 : 0.72), input.staticFacts.hours.source === 'JSON-LD' ? input.staticFacts.hours : null, input.staticFacts.hours, maybeLlm(llm?.hours));
  const timezone = choose(placesField(places?.timezone ?? inferTimezoneFromAddress(places?.address), placeConfidence >= 0.82 ? 0.9 : 0.68), input.staticFacts.timezone, maybeLlm(llm?.businessProfile?.timezone));
  const website = choose(placesField(places?.website, placeConfidence >= 0.82 ? 0.94 : 0.68), input.staticFacts.website, maybeLlm(llm?.businessProfile?.website));
  const primaryType = choose(input.staticFacts.primaryType, placesField(places?.primaryType, 0.78), maybeLlm(llm?.businessProfile?.primaryType));
  const bookingUrl = choose(input.staticFacts.bookingUrl, maybeLlm(llm?.bookingUrl));
  const categories = serviceGroups(services, llm);
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
    warnings: [...new Set(warnings)],
  };
  return { ...base, completeness: computeCompleteness(base) };
}
