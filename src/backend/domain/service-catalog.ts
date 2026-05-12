import type { ServiceCategory, ServiceItem, ServiceMatchResult, ShopService, ShopServiceCatalog, ShopVertical } from '@/src/backend/domain/types';

export const GENERAL_SERVICE_CATEGORY_NAME = 'General Services';

export function serviceCatalogHasActiveServices(catalog?: ShopServiceCatalog | null): boolean {
  return Boolean(catalog?.services.some((service) => service.active !== false && service.name.trim().length > 0));
}

export function serviceCatalogToLegacyServices(catalog?: ShopServiceCatalog | null): ServiceItem[] {
  if (!catalog) return [];
  return catalog.services
    .filter((service) => service.active !== false && service.name.trim().length > 0)
    .sort((a, b) => {
      const categoryA = catalog.categories.find((category) => category.id === a.categoryId)?.sortOrder ?? 0;
      const categoryB = catalog.categories.find((category) => category.id === b.categoryId)?.sortOrder ?? 0;
      if (categoryA !== categoryB) return categoryA - categoryB;
      return a.sortOrder - b.sortOrder;
    })
    .map((service) => ({
      name: service.name,
      duration_min: service.durationMinutes ?? service.variants?.find((variant) => typeof variant.durationMinutes === 'number')?.durationMinutes ?? 60,
      price: service.priceAmount ?? service.variants?.find((variant) => typeof variant.priceAmount === 'number')?.priceAmount ?? 0,
    }));
}

export function buildGeneralServiceCatalog(params: {
  shopId: string;
  services: ServiceItem[];
  categoryId: string;
  serviceIdForIndex: (index: number) => string;
  now?: string;
}): ShopServiceCatalog {
  const now = params.now ?? new Date().toISOString();
  const category: ServiceCategory = {
    id: params.categoryId,
    shopId: params.shopId,
    name: GENERAL_SERVICE_CATEGORY_NAME,
    description: null,
    sortOrder: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  return {
    categories: [category],
    services: params.services
      .filter((service) => service.name.trim().length > 0)
      .map((service, index): ShopService => {
        const price = Number.isFinite(service.price) ? service.price : 0;
        return {
          id: params.serviceIdForIndex(index),
          shopId: params.shopId,
          categoryId: category.id,
          name: service.name.trim(),
          description: null,
          durationText: Number.isFinite(service.duration_min) ? `${service.duration_min} min` : null,
          durationMinutes: Number.isFinite(service.duration_min) ? service.duration_min : 60,
          priceAmount: price,
          priceCurrency: 'USD',
          priceType: price > 0 ? 'fixed' : 'varies',
          bookable: true,
          active: true,
          sortOrder: index,
          aliases: [],
          bookingNotes: null,
          variants: [],
          externalProvider: null,
          externalServiceId: null,
          externalLocationId: null,
          externalStaffRequired: false,
          externalMetadata: {},
          createdAt: now,
          updatedAt: now,
        };
      }),
  };
}

export type ImportedServiceSuggestion = {
  name: string;
  category?: string | null;
  description?: string | null;
  durationText?: string | null;
  durationMinutes?: number | null;
  priceAmount?: number | null;
  priceType?: ShopService['priceType'];
  aliases?: string[];
  bookingNotes?: string | null;
  bookable?: boolean;
};

const CATEGORY_PATTERNS: Array<{ category: string; pattern: RegExp; aliases?: Record<string, string[]> }> = [
  { category: 'Manicure', pattern: /\b(manicure|mani|gel\s+mani|shellac|dip)\b/i, aliases: { 'Gel Manicure': ['gel mani', 'shellac'] } },
  { category: 'Pedicure', pattern: /\b(pedicure|pedi)\b/i },
  { category: 'Acrylics / Extensions', pattern: /\b(acrylic|extension|full\s+set|fill)\b/i },
  { category: 'Haircuts', pattern: /\b(haircut|cut|trim|bangs)\b/i },
  { category: 'Color', pattern: /\b(color|colour|balayage|highlight|root\s+touch|toner)\b/i },
  { category: 'Treatments', pattern: /\b(keratin|treatment|deep\s+condition|repair)\b/i },
  { category: 'Facials', pattern: /\b(facial|hydrafacial|peel)\b/i },
  { category: 'Massage', pattern: /\b(massage|deep\s+tissue|swedish)\b/i },
  { category: 'Waxing', pattern: /\b(wax|waxing|bikini|brazilian)\b/i },
  { category: 'Injectables', pattern: /\b(botox|dysport|filler|injectable|xeomin)\b/i },
  { category: 'Laser', pattern: /\b(laser|ipl|hair\s+removal)\b/i },
];

export function normalizeServiceText(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(service|services|appointment|booking|please|want|need|like|for|the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferServiceGroupName(name: string, vertical?: ShopVertical | null): string {
  const normalized = normalizeServiceText(name);
  for (const entry of CATEGORY_PATTERNS) {
    if (entry.pattern.test(name) || entry.pattern.test(normalized)) return entry.category;
  }
  if (vertical === 'nail_salon') return 'Manicure';
  if (vertical === 'hair_salon') return 'Haircuts';
  if (vertical === 'day_spa') return 'Facials';
  if (vertical === 'med_spa') return 'Injectables';
  return GENERAL_SERVICE_CATEGORY_NAME;
}

export function mergeImportedServicesIntoCatalog(params: {
  shopId: string;
  currentCatalog?: ShopServiceCatalog | null;
  importedServices: ImportedServiceSuggestion[];
  vertical?: ShopVertical | null;
  idForCategory: () => string;
  idForService: () => string;
  now?: string;
}): { catalog: ShopServiceCatalog; addedCount: number } {
  const now = params.now ?? new Date().toISOString();
  const categories = [...(params.currentCatalog?.categories ?? [])];
  const services = [...(params.currentCatalog?.services ?? [])];
  const categoryByName = new Map(categories.map((category) => [normalizeServiceText(category.name), category]));
  let addedCount = 0;

  const ensureCategory = (name: string) => {
    const key = normalizeServiceText(name || GENERAL_SERVICE_CATEGORY_NAME);
    const existing = categoryByName.get(key);
    if (existing) return existing;
    const category: ServiceCategory = {
      id: params.idForCategory(),
      shopId: params.shopId,
      name: name || GENERAL_SERVICE_CATEGORY_NAME,
      description: null,
      sortOrder: categories.length,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    categories.push(category);
    categoryByName.set(key, category);
    return category;
  };

  for (const imported of params.importedServices) {
    const name = imported.name.trim();
    if (!name) continue;
    const category = ensureCategory(imported.category?.trim() || inferServiceGroupName(name, params.vertical));
    const serviceKey = `${category.id}:${normalizeServiceText(name)}`;
    const duplicate = services.some((service) => `${service.categoryId ?? ''}:${normalizeServiceText(service.name)}` === serviceKey);
    if (duplicate) continue;
    const extraAliases = CATEGORY_PATTERNS.find((entry) => entry.category === category.name)?.aliases?.[name] ?? [];
    services.push({
      id: params.idForService(),
      shopId: params.shopId,
      categoryId: category.id,
      name,
      description: imported.description ?? null,
      durationText: imported.durationText ?? (imported.durationMinutes ? `${imported.durationMinutes} min` : null),
      durationMinutes: imported.durationMinutes ?? null,
      priceAmount: imported.priceAmount ?? null,
      priceCurrency: 'USD',
      priceType: imported.priceType ?? ((imported.priceAmount ?? 0) > 0 ? 'fixed' : 'varies'),
      bookable: imported.bookable ?? true,
      active: true,
      sortOrder: services.filter((service) => service.categoryId === category.id).length,
      aliases: [...new Set([...(imported.aliases ?? []), ...extraAliases])],
      bookingNotes: imported.bookingNotes ?? null,
      externalProvider: null,
      externalServiceId: null,
      externalLocationId: null,
      externalStaffRequired: false,
      externalMetadata: { imported: true },
      createdAt: now,
      updatedAt: now,
    });
    addedCount += 1;
  }

  if (categories.length === 0) ensureCategory(GENERAL_SERVICE_CATEGORY_NAME);
  return { catalog: { categories, services }, addedCount };
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(normalizeServiceText(a).split(' ').filter(Boolean));
  const bTokens = new Set(normalizeServiceText(b).split(' ').filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) if (bTokens.has(token)) overlap += 1;
  return overlap / Math.max(aTokens.size, bTokens.size);
}

export function matchServiceFromCallerText(params: {
  shopServiceCatalog?: ShopServiceCatalog | null;
  callerText: string;
  vertical?: ShopVertical | null;
}): ServiceMatchResult {
  const catalog = params.shopServiceCatalog;
  const input = normalizeServiceText(params.callerText);
  if (!catalog || !input) return { confidence: 0, reason: 'no_catalog_or_text' };

  const activeServices = catalog.services.filter((service) => service.active !== false);
  const activeCategories = catalog.categories.filter((category) => category.active !== false);

  for (const service of activeServices) {
    if (normalizeServiceText(service.name) === input) {
      return {
        matchedServiceId: service.id,
        matchedCategoryId: service.categoryId ?? undefined,
        confidence: 1,
        matchedName: service.name,
        reason: 'exact_service_name',
        bookable: service.bookable,
      };
    }
  }

  for (const service of activeServices) {
    const alias = service.aliases.find((item) => {
      const normalizedAlias = normalizeServiceText(item);
      return normalizedAlias === input || input.includes(normalizedAlias);
    });
    if (alias) {
      return {
        matchedServiceId: service.id,
        matchedCategoryId: service.categoryId ?? undefined,
        confidence: 0.96,
        matchedName: service.name,
        reason: `alias:${alias}`,
        bookable: service.bookable,
      };
    }
  }

  const phraseMatches = activeServices
    .map((service) => ({ service, normalizedName: normalizeServiceText(service.name) }))
    .filter((item) => item.normalizedName.length > 0 && input.includes(item.normalizedName))
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length);
  if (phraseMatches.length > 0) {
    const match = phraseMatches[0]!.service;
    return {
      matchedServiceId: match.id,
      matchedCategoryId: match.categoryId ?? undefined,
      confidence: 0.94,
      matchedName: match.name,
      reason: 'service_name_phrase',
      bookable: match.bookable,
    };
  }

  let bestService: { service: ShopService; score: number } | null = null;
  for (const service of activeServices) {
    const score = Math.max(
      tokenOverlapScore(params.callerText, service.name),
      ...service.aliases.map((alias) => tokenOverlapScore(params.callerText, alias)),
    );
    if (!bestService || score > bestService.score) bestService = { service, score };
  }
  if (bestService && bestService.score >= 0.72) {
    return {
      matchedServiceId: bestService.service.id,
      matchedCategoryId: bestService.service.categoryId ?? undefined,
      confidence: Math.min(0.9, bestService.score),
      matchedName: bestService.service.name,
      reason: 'fuzzy_service_match',
      bookable: bestService.service.bookable,
    };
  }

  for (const category of activeCategories) {
    const categoryScore = tokenOverlapScore(params.callerText, category.name);
    const categoryServices = activeServices.filter((service) => service.categoryId === category.id);
    if (categoryScore >= 0.7 || normalizeServiceText(category.name) === input) {
      return {
        matchedCategoryId: category.id,
        confidence: 0.78,
        matchedName: category.name,
        reason: 'broad_category_match',
        requiresClarification: categoryServices.length > 1,
      };
    }
  }

  return { confidence: bestService?.score ?? 0, reason: 'low_confidence' };
}
