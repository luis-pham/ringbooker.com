import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildGeneralServiceCatalog,
  GENERAL_SERVICE_CATEGORY_NAME,
  inferServiceGroupName,
  matchServiceFromCallerText,
  mergeImportedServicesIntoCatalog,
} from '@/src/backend/domain/service-catalog';
import type { ShopServiceCatalog } from '@/src/backend/domain/types';

function sampleCatalog(): ShopServiceCatalog {
  return {
    categories: [
      { id: 'cat-mani', shopId: 'shop-1', name: 'Manicure', sortOrder: 0, active: true },
      { id: 'cat-color', shopId: 'shop-1', name: 'Color', sortOrder: 1, active: true },
      { id: 'cat-pedi', shopId: 'shop-1', name: 'Pedicure', sortOrder: 2, active: true },
    ],
    services: [
      {
        id: 'svc-gel',
        shopId: 'shop-1',
        categoryId: 'cat-mani',
        name: 'Gel Manicure',
        durationMinutes: 45,
        priceAmount: 45,
        priceCurrency: 'USD',
        priceType: 'from',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: ['gel mani', 'shellac'],
      },
      {
        id: 'svc-classic',
        shopId: 'shop-1',
        categoryId: 'cat-mani',
        name: 'Classic Manicure',
        durationMinutes: 30,
        priceAmount: 30,
        priceCurrency: 'USD',
        priceType: 'fixed',
        bookable: true,
        active: true,
        sortOrder: 1,
        aliases: [],
      },
      {
        id: 'svc-balayage',
        shopId: 'shop-1',
        categoryId: 'cat-color',
        name: 'Balayage',
        durationMinutes: 120,
        priceAmount: 180,
        priceCurrency: 'USD',
        priceType: 'from',
        bookable: false,
        active: true,
        sortOrder: 0,
        aliases: [],
      },
      {
        id: 'svc-highlights',
        shopId: 'shop-1',
        categoryId: 'cat-color',
        name: 'Highlights',
        durationMinutes: 90,
        priceAmount: 120,
        priceCurrency: 'USD',
        priceType: 'from',
        bookable: true,
        active: true,
        sortOrder: 1,
        aliases: [],
      },
      {
        id: 'svc-deluxe-pedi',
        shopId: 'shop-1',
        categoryId: 'cat-pedi',
        name: 'Deluxe Pedicure',
        durationMinutes: 60,
        priceAmount: 65,
        priceCurrency: 'USD',
        priceType: 'fixed',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: [],
      },
    ],
  };
}

test('service matching exact service name', () => {
  const result = matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'Gel Manicure' });

  assert.equal(result.matchedServiceId, 'svc-gel');
  assert.equal(result.confidence, 1);
  assert.equal(result.reason, 'exact_service_name');
});

test('service matching alias maps caller wording to service', () => {
  const result = matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'I need gel mani' });

  assert.equal(result.matchedServiceId, 'svc-gel');
  assert.ok(result.confidence >= 0.7);
});

test('broad category match asks for clarification when multiple services exist', () => {
  const result = matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'manicure' });

  assert.equal(result.matchedCategoryId, 'cat-mani');
  assert.equal(result.requiresClarification, true);
  assert.equal(result.reason, 'broad_category_match');
});

test('low confidence does not force service id', () => {
  const result = matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'birthday party' });

  assert.equal(result.matchedServiceId, undefined);
  assert.ok(result.confidence < 0.72);
});

test('bookable false is surfaced for matched service', () => {
  const result = matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'balayage' });

  assert.equal(result.matchedServiceId, 'svc-balayage');
  assert.equal(result.bookable, false);
});

test('service matching finds service names inside natural caller phrases', () => {
  assert.equal(
    matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'I want balayage' }).matchedServiceId,
    'svc-balayage',
  );
  assert.equal(
    matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'Can I get a gel manicure?' }).matchedServiceId,
    'svc-gel',
  );
  assert.equal(
    matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'Need a deluxe pedicure' }).matchedServiceId,
    'svc-deluxe-pedi',
  );
});

test('service matching keeps broad category requests as clarification instead of forcing a service', () => {
  const result = matchServiceFromCallerText({ shopServiceCatalog: sampleCatalog(), callerText: 'color' });

  assert.equal(result.matchedServiceId, undefined);
  assert.equal(result.matchedCategoryId, 'cat-color');
  assert.equal(result.requiresClarification, true);
});

test('import grouping infers obvious service groups and aliases', () => {
  assert.equal(inferServiceGroupName('Gel Manicure', 'nail_salon'), 'Manicure');
  assert.equal(inferServiceGroupName('Root Touch Up', 'hair_salon'), 'Color');
  assert.equal(inferServiceGroupName('Botox', 'med_spa'), 'Injectables');

  const merged = mergeImportedServicesIntoCatalog({
    shopId: 'shop-1',
    currentCatalog: null,
    importedServices: [
      { name: 'Gel Manicure' },
      { name: 'Classic Manicure' },
      { name: 'Balayage' },
      { name: 'Gel Manicure' },
    ],
    vertical: 'nail_salon',
    idForCategory: () => `cat-${Math.random()}`,
    idForService: () => `svc-${Math.random()}`,
  });

  assert.equal(merged.addedCount, 3);
  assert.ok(merged.catalog.categories.some((category) => category.name === 'Manicure'));
  assert.ok(merged.catalog.categories.some((category) => category.name === 'Color'));
  assert.ok(merged.catalog.services.find((service) => service.name === 'Gel Manicure')?.aliases.includes('gel mani'));
});

test('ungrouped import falls back to general services without duplicates', () => {
  const merged = mergeImportedServicesIntoCatalog({
    shopId: 'shop-1',
    currentCatalog: {
      categories: [{ id: 'general', shopId: 'shop-1', name: GENERAL_SERVICE_CATEGORY_NAME, sortOrder: 0, active: true }],
      services: [
        {
          id: 'existing',
          shopId: 'shop-1',
          categoryId: 'general',
          name: 'Custom Consultation',
          durationMinutes: null,
          priceAmount: null,
          priceCurrency: 'USD',
          priceType: 'consultation',
          bookable: true,
          active: true,
          sortOrder: 0,
          aliases: [],
        },
      ],
    },
    importedServices: [{ name: 'Custom Consultation' }, { name: 'Unknown Service' }],
    idForCategory: () => 'new-cat',
    idForService: () => `svc-${Math.random()}`,
  });

  assert.equal(merged.addedCount, 1);
  assert.equal(merged.catalog.services.filter((service) => service.name === 'Custom Consultation').length, 1);
  assert.equal(merged.catalog.services.find((service) => service.name === 'Unknown Service')?.categoryId, 'general');
});

test('service catalog persistence uses atomic replace RPC migration', () => {
  const migration = readFileSync(
    path.join(process.cwd(), 'src/backend/db/migrations/0047_replace_shop_service_catalog_rpc.sql'),
    'utf8',
  );
  const repository = readFileSync(
    path.join(process.cwd(), 'src/backend/adapters/supabase/shops-repository.ts'),
    'utf8',
  );

  assert.match(migration, /create or replace function replace_shop_service_catalog/);
  assert.match(migration, /delete from shop_services[\s\S]*delete from shop_service_categories[\s\S]*insert into shop_service_categories[\s\S]*insert into shop_services[\s\S]*update shops/);
  assert.match(repository, /rpc\('replace_shop_service_catalog'/);
});

test('buildGeneralServiceCatalog stores a $0 service as priceType "fixed", not "varies"', () => {
  const catalog = buildGeneralServiceCatalog({
    shopId: 'shop-1',
    categoryId: 'cat-general',
    serviceIdForIndex: (index) => `svc-${index}`,
    services: [
      { name: 'Free Consultation', duration_min: 15, price: 0 },
      { name: 'Haircut', duration_min: 45, price: 45 },
    ],
  });

  const free = catalog.services.find((service) => service.name === 'Free Consultation');
  const paid = catalog.services.find((service) => service.name === 'Haircut');
  assert.equal(free?.priceType, 'fixed');
  assert.equal(free?.priceAmount, 0);
  assert.equal(paid?.priceType, 'fixed');
  assert.equal(paid?.priceAmount, 45);
});
