import { matchServiceFromCallerText } from '@/src/backend/domain/service-catalog';
import type { Shop, ShopServiceCatalog } from '@/src/backend/domain/types';
import type { ShopsRepository } from '@/src/backend/ports/repositories';
import type { SquareConnectionOptions } from '@/src/backend/services/calendar/provider-connections';

type SquareServiceVariation = SquareConnectionOptions['serviceVariations'][number];

export type SquareCatalogSyncResult = {
  matched: number;
  unmatched: number;
  skippedDuplicate: number;
};

function squareMatchText(variation: SquareServiceVariation): string {
  return variation.itemName?.trim() || variation.name.trim() || variation.variationName?.trim() || variation.id;
}

function updateCatalogWithSquareMappings(params: {
  shop: Shop;
  catalog: ShopServiceCatalog;
  serviceVariations: SquareServiceVariation[];
  locationId?: string | null;
  syncedAt?: string;
}): { catalog: ShopServiceCatalog; result: SquareCatalogSyncResult; changed: boolean } {
  const servicesById = new Map(params.catalog.services.map((service) => [service.id, service]));
  const usedServiceIds = new Set<string>();
  const patches = new Map<string, SquareServiceVariation>();
  let unmatched = 0;
  let skippedDuplicate = 0;

  for (const variation of params.serviceVariations) {
    const match = matchServiceFromCallerText({
      shopServiceCatalog: params.catalog,
      callerText: squareMatchText(variation),
      vertical: params.shop.vertical ?? null,
    });

    if (!match.matchedServiceId || match.confidence < 0.72 || !servicesById.has(match.matchedServiceId)) {
      unmatched += 1;
      continue;
    }

    if (usedServiceIds.has(match.matchedServiceId)) {
      skippedDuplicate += 1;
      unmatched += 1;
      continue;
    }

    usedServiceIds.add(match.matchedServiceId);
    patches.set(match.matchedServiceId, variation);
  }

  let changed = false;
  const syncedAt = params.syncedAt ?? new Date().toISOString();
  const services = params.catalog.services.map((service) => {
    const variation = patches.get(service.id);
    if (!variation) return service;

    changed = true;
    return {
      ...service,
      externalProvider: 'square',
      externalServiceId: variation.id,
      externalLocationId: params.locationId ?? service.externalLocationId ?? null,
      externalMetadata: {
        ...(service.externalMetadata ?? {}),
        ...(typeof variation.version === 'number' ? { variation_version: variation.version } : {}),
        ...(typeof variation.durationMs === 'number' ? { duration_ms: variation.durationMs } : {}),
        ...(variation.itemName ? { square_item_name: variation.itemName } : {}),
        ...(variation.variationName ? { square_variation_name: variation.variationName } : {}),
        ...(variation.teamMemberIds?.length ? { teamMemberIds: variation.teamMemberIds } : {}),
        square_synced_at: syncedAt,
      },
    };
  });

  return {
    catalog: {
      categories: params.catalog.categories,
      services,
    },
    result: {
      matched: patches.size,
      unmatched,
      skippedDuplicate,
    },
    changed,
  };
}

export async function syncSquareCatalogToShopServices(params: {
  shopsRepository: ShopsRepository;
  shop: Shop;
  serviceVariations: SquareServiceVariation[];
  locationId?: string | null;
}): Promise<SquareCatalogSyncResult> {
  const catalog = await params.shopsRepository.findServiceCatalogByShopId(params.shop.id);
  if (!catalog?.services.length || params.serviceVariations.length === 0) {
    return {
      matched: 0,
      unmatched: params.serviceVariations.length,
      skippedDuplicate: 0,
    };
  }

  const updated = updateCatalogWithSquareMappings({
    shop: params.shop,
    catalog,
    serviceVariations: params.serviceVariations,
    locationId: params.locationId,
  });

  if (updated.changed) {
    await params.shopsRepository.saveServiceCatalog(params.shop.id, updated.catalog);
  }

  return updated.result;
}
