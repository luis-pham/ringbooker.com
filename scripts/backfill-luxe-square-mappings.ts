import { createClient } from '@supabase/supabase-js';

import { SupabaseShopsRepository } from '@/src/backend/adapters/supabase/shops-repository';
import { normalizeServiceText } from '@/src/backend/domain/service-catalog';
import {
  encodeSquareConnectionCredentials,
  parseSquareConnectionCredentials,
  squareFetchConnectionOptions,
} from '@/src/backend/services/calendar/provider-connections';

const SHOP_ID = process.env.LUXE_SHOP_ID?.trim() || '7b443d4d-5772-4ba1-96f7-b4bd0ee2f575';
const LOCATION_ID = 'L7H9ZE952EPJ6';

const expectedMappings = [
  { serviceName: "Women's haircut & style", variationId: '4ROFLHBTZKXMHR4JQ34PD5YO', durationMs: 60 * 60_000 },
  { serviceName: "Men's haircut", variationId: '3DSXT3VUUOWFB3GYLZK63N6Y', durationMs: 30 * 60_000 },
  { serviceName: 'Kids haircut (under 12)', variationId: 'FQ5GFMVTI237V6ATWGGJVRMP', durationMs: 30 * 60_000 },
  { serviceName: 'Bang trim', variationId: 'FF6Z3OEZJPRN74UN3BI2ZAGL', durationMs: 15 * 60_000 },
  { serviceName: 'Full highlights', variationId: 'OSMQNWU5UWS22VBYVW45WUN7', durationMs: 150 * 60_000 },
  { serviceName: 'Partial highlights', variationId: 'ZSH6QUX5PXASVUYRR2W6HGE4', durationMs: 105 * 60_000 },
  { serviceName: 'Single process color', variationId: 'PTCEKXWFHFUSGIO6DJVNPT3R', durationMs: 90 * 60_000 },
  { serviceName: 'Balayage / ombre', variationId: 'PVJLYB5INVEZUEA3QCGXZKQP', durationMs: 180 * 60_000 },
  { serviceName: 'Color correction', variationId: '5XQRIWCXDX4AF2BLLGNCSB3L', durationMs: 240 * 60_000 },
  { serviceName: 'Toner / gloss', variationId: '5FNGXX7YHQ4ORMFRKSBGRZ6Z', durationMs: 45 * 60_000 },
  { serviceName: 'Blowout', variationId: 'Z2DWTFNUYP33UMCYUZOZQXMU', durationMs: 45 * 60_000 },
  { serviceName: 'Blowout + style', variationId: 'YT73NY4ZVUVUXT2P7E5LHCGS', durationMs: 60 * 60_000 },
  { serviceName: 'Keratin treatment', variationId: 'XUSTCLPGFKQFHT3FJMSPKKVN', durationMs: 150 * 60_000 },
  { serviceName: 'Bridal updo', variationId: 'SGXLESHCWQ4P3JC22CG22JQ2', durationMs: 90 * 60_000 },
] as const;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  const shopsRepository = new SupabaseShopsRepository(supabase);
  const shop = await shopsRepository.findById(SHOP_ID);
  if (!shop) throw new Error(`shop_not_found:${SHOP_ID}`);

  const currentCredentials = parseSquareConnectionCredentials(shop.google_cal_credentials_encrypted);
  if (!currentCredentials?.access_token || !currentCredentials.refresh_token) {
    throw new Error(`square_credentials_missing:${SHOP_ID}`);
  }

  const credentialsWithLocation = {
    ...currentCredentials,
    location_id: LOCATION_ID,
  };
  await shopsRepository.updateCalendarConnection(shop.id, {
    google_cal_id: shop.google_cal_id ?? null,
    google_cal_credentials_encrypted: encodeSquareConnectionCredentials(credentialsWithLocation),
  });

  const catalogVersions = new Map<string, { version?: number; durationMs?: number }>();
  try {
    const options = await squareFetchConnectionOptions(credentialsWithLocation);
    for (const variation of options.options.serviceVariations) {
      catalogVersions.set(variation.id, {
        version: variation.version,
        durationMs: variation.durationMs,
      });
    }
  } catch (error) {
    console.warn('square_catalog_fetch_failed_using_expected_mappings', error);
  }

  const catalog = await shopsRepository.findServiceCatalogByShopId(shop.id);
  if (!catalog?.services.length) throw new Error(`service_catalog_missing:${SHOP_ID}`);

  const mappingByServiceName = new Map(expectedMappings.map((mapping) => [normalizeServiceText(mapping.serviceName), mapping]));
  let matched = 0;
  const services = catalog.services.map((service) => {
    const mapping = mappingByServiceName.get(normalizeServiceText(service.name));
    if (!mapping) return service;

    matched += 1;
    const fetched = catalogVersions.get(mapping.variationId);
    return {
      ...service,
      externalProvider: 'square',
      externalServiceId: mapping.variationId,
      externalLocationId: LOCATION_ID,
      externalMetadata: {
        ...(service.externalMetadata ?? {}),
        ...(typeof fetched?.version === 'number' ? { variation_version: fetched.version } : {}),
        duration_ms: fetched?.durationMs ?? mapping.durationMs,
        square_synced_at: new Date().toISOString(),
        square_backfill: 'luxe_manual_2026_05_30',
      },
    };
  });

  await shopsRepository.saveServiceCatalog(shop.id, {
    categories: catalog.categories,
    services,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        shopId: shop.id,
        locationId: LOCATION_ID,
        matched,
        expected: expectedMappings.length,
        skipped: ['Deep conditioning treatment'],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
