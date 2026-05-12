import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBusinessKnowledgeSuggestionsRepository } from '@/src/backend/adapters/memory/business-knowledge-suggestions-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { payloadHash, pendingSuggestionsFromImport } from '@/src/backend/domain/business-knowledge-suggestions';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

let loginCounter = 0;

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  loginCounter += 1;
  const loginResponse = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      'x-forwarded-for': `127.0.0.${loginCounter}`,
    },
    body: JSON.stringify({
      email: 'user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie!;
}

function createUserSettingsTestApp(shopsRepository = new InMemoryShopsRepository(), businessKnowledgeSuggestionsRepository = new InMemoryBusinessKnowledgeSuggestionsRepository()) {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    businessKnowledgeSuggestionsRepository,
  });
  return { app, shopsRepository, businessKnowledgeSuggestionsRepository };
}

test('starter plan user settings expose capabilities and reject locked fields', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter', active: true });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await loginUser(app);

  const getResponse = await app.request('/user/settings', {
    headers: {
      cookie,
    },
  });
  assert.equal(getResponse.status, 200);
  const getBody = (await getResponse.json()) as {
    ok: boolean;
    shop: { plan: string };
    capabilities: { edit_ai_voice: boolean; edit_transfer_settings: boolean; edit_ai_custom_instructions: boolean };
  };
  assert.equal(getBody.ok, true);
  assert.equal(getBody.shop.plan, 'starter');
  assert.equal(getBody.capabilities.edit_ai_voice, false);
  assert.equal(getBody.capabilities.edit_transfer_settings, false);
  assert.equal(getBody.capabilities.edit_ai_custom_instructions, false);

  const blockedResponse = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      send_review_request_sms: true,
      ai_custom_instructions: 'Only offer premium routing.',
    }),
  });
  assert.equal(blockedResponse.status, 403);
  const blockedBody = (await blockedResponse.json()) as { ok: boolean; error: string; fields: string[] };
  assert.equal(blockedBody.ok, false);
  assert.equal(blockedBody.error, 'plan_feature_locked');
  assert.deepEqual(blockedBody.fields.sort(), ['ai_custom_instructions']);

  const allowedResponse = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      cancel_policy: 'Appointments should be canceled at least 24 hours before the scheduled time.',
      allow_callbacks: false,
      not_offered_services: ['Acrylic nails'],
      service_catalog: {
        categories: [{ id: '99999999-9999-4999-8999-999999999999', name: 'Starter Services', sortOrder: 0 }],
        services: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            categoryId: '99999999-9999-4999-8999-999999999999',
            name: 'Basic Manicure',
            durationMinutes: 30,
            priceAmount: 30,
            priceType: 'fixed',
          },
        ],
      },
    }),
  });
  assert.equal(allowedResponse.status, 200);
  const allowedBody = (await allowedResponse.json()) as {
    ok: boolean;
    shop: { cancel_policy: string; allow_callbacks: boolean; not_offered_services?: string[]; service_catalog?: { services: Array<{ name: string }> } };
  };
  assert.equal(allowedBody.ok, true);
  assert.equal(allowedBody.shop.allow_callbacks, false);
  assert.equal(
    allowedBody.shop.cancel_policy,
    'Appointments should be canceled at least 24 hours before the scheduled time.',
  );
  assert.equal(allowedBody.shop.service_catalog?.services[0]?.name, 'Basic Manicure');
  assert.deepEqual(allowedBody.shop.not_offered_services, ['Acrylic nails']);
});

test('user can save business knowledge staff and FAQ fields', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await loginUser(app);
  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      staff: [
        { name: 'Sarah', role: 'Nail artist', specialties: ['Nail art', 'Gel'], notes: 'Clients may request Sarah.' },
      ],
      faqs: [
        { question: 'Do you accept walk-ins?', answer: 'Walk-ins are welcome when technicians are available.' },
      ],
    }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    shop: {
      staff: Array<{ name: string; role?: string | null; specialties?: string[] }>;
      faqs: Array<{ question: string; answer: string }>;
    };
  };
  assert.equal(body.ok, true);
  assert.equal(body.shop.staff[0]?.name, 'Sarah');
  assert.equal(body.shop.staff[0]?.specialties?.[0], 'Nail art');
  assert.equal(body.shop.faqs[0]?.question, 'Do you accept walk-ins?');
});

test('user can save grouped service catalog and legacy services are derived for compatibility', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await loginUser(app);
  const manicureCategoryId = '11111111-1111-4111-8111-111111111111';
  const pedicureCategoryId = '22222222-2222-4222-8222-222222222222';
  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      service_catalog: {
        categories: [
          { id: manicureCategoryId, name: 'Manicure', sortOrder: 0 },
          { id: pedicureCategoryId, name: 'Pedicure', sortOrder: 1 },
        ],
        services: [
          {
            id: '33333333-3333-4333-8333-333333333333',
            categoryId: manicureCategoryId,
            name: 'Gel Manicure',
            durationText: '45 min',
            durationMinutes: 45,
            priceAmount: 45,
            priceType: 'from',
            sortOrder: 0,
            variants: [
              {
                label: '30 min',
                durationText: '30 min',
                durationMinutes: 30,
                priceAmount: 65,
                priceCurrency: 'USD',
                priceType: 'from',
                sortOrder: 0,
              },
              {
                label: '60 min',
                durationText: '60 min',
                durationMinutes: 60,
                priceAmount: 95,
                priceCurrency: 'USD',
                priceType: 'from',
                sortOrder: 1,
              },
            ],
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            categoryId: pedicureCategoryId,
            name: 'Deluxe Pedicure',
            durationText: '1 hour+',
            durationMinutes: 60,
            priceAmount: null,
            priceType: 'varies',
            bookable: false,
            sortOrder: 0,
          },
        ],
      },
    }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    shop: {
      services: Array<{ name: string; duration_min: number; price: number }>;
      service_catalog: {
        categories: Array<{ name: string }>;
        services: Array<{ name: string; durationText?: string | null; priceType: string; bookable: boolean; variants?: Array<{ label: string; priceAmount: number }> }>;
      };
    };
  };
  assert.equal(body.ok, true);
  assert.deepEqual(body.shop.service_catalog.categories.map((category) => category.name), ['Manicure', 'Pedicure']);
  assert.deepEqual(body.shop.services.map((service) => service.name), ['Gel Manicure', 'Deluxe Pedicure']);
  assert.equal(body.shop.services[0]?.duration_min, 45);
  assert.equal(body.shop.services[0]?.price, 45);
  assert.equal(body.shop.service_catalog.services[1]?.durationText, '1 hour+');
  assert.equal(body.shop.service_catalog.services[1]?.priceType, 'varies');
  assert.equal(body.shop.service_catalog.services[1]?.bookable, false);
  assert.equal(body.shop.service_catalog.services[0]?.variants?.length, 2);
  assert.equal(body.shop.service_catalog.services[0]?.variants?.[1]?.priceAmount, 95);
});

test('normal user service catalog API strips external booking mapping fields', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.saveServiceCatalog('demo-shop', {
    categories: [{ id: '99999999-9999-4999-8999-999999999999', shopId: 'demo-shop', name: 'General Services', sortOrder: 0, active: true }],
    services: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        shopId: 'demo-shop',
        categoryId: '99999999-9999-4999-8999-999999999999',
        name: 'Imported Service',
        durationMinutes: 45,
        priceAmount: 50,
        priceCurrency: 'USD',
        priceType: 'fixed',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: [],
        externalProvider: 'square',
        externalServiceId: 'svc_secret',
        externalLocationId: 'loc_secret',
        externalStaffRequired: true,
        externalMetadata: { raw: 'secret_payload' },
      },
    ],
  });
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await loginUser(app);
  const getResponse = await app.request('/user/settings', { headers: { cookie } });
  assert.equal(getResponse.status, 200);
  const getBody = (await getResponse.json()) as { shop: { service_catalog: { services: Array<Record<string, unknown>> } } };
  assert.equal(getBody.shop.service_catalog.services[0]?.externalProvider, undefined);
  assert.equal(getBody.shop.service_catalog.services[0]?.externalServiceId, undefined);
  assert.equal(getBody.shop.service_catalog.services[0]?.externalLocationId, undefined);
  assert.equal(getBody.shop.service_catalog.services[0]?.externalStaffRequired, undefined);
  assert.equal(getBody.shop.service_catalog.services[0]?.externalMetadata, undefined);

  const putResponse = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      service_catalog: {
        categories: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Manicure', sortOrder: 0 }],
        services: [
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            categoryId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            name: 'Gel Manicure',
            priceType: 'fixed',
            externalProvider: 'square',
            externalServiceId: 'attacker_controlled',
            externalLocationId: 'attacker_location',
            externalStaffRequired: true,
            externalMetadata: { raw: 'payload' },
          },
        ],
      },
    }),
  });
  assert.equal(putResponse.status, 200);
  const putBody = (await putResponse.json()) as { shop: { service_catalog: { services: Array<Record<string, unknown>> } } };
  assert.equal(putBody.shop.service_catalog.services[0]?.externalProvider, undefined);
  assert.equal(putBody.shop.service_catalog.services[0]?.externalServiceId, undefined);
  assert.equal(putBody.shop.service_catalog.services[0]?.externalLocationId, undefined);
  assert.equal(putBody.shop.service_catalog.services[0]?.externalStaffRequired, undefined);
  assert.equal(putBody.shop.service_catalog.services[0]?.externalMetadata, undefined);
});

test('service catalog flag off keeps legacy services available and rejects grouped catalog writes', async () => {
  applyRequiredTestEnv({ SERVICE_CATALOG_ENABLED: 'false' });
  resetEnvCacheForTests();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      jobsRepository: new InMemoryJobsRepository(),
      bookingsRepository: new InMemoryBookingsRepository(),
      callbacksRepository: new InMemoryCallbacksRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      telephonyService: new NoopTelephonyService(),
      callLogsRepository: new InMemoryCallLogsRepository(),
      authUsersRepository: new InMemoryAuthUsersRepository(),
      realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    });

    const cookie = await loginUser(app);
    const getResponse = await app.request('/user/settings', { headers: { cookie } });
    assert.equal(getResponse.status, 200);
    const getBody = (await getResponse.json()) as { serviceCatalogEnabled: boolean; shop: { services: Array<{ name: string }>; service_catalog: null } };
    assert.equal(getBody.serviceCatalogEnabled, false);
    assert.equal(getBody.shop.service_catalog, null);
    assert.ok(getBody.shop.services.length > 0);

    const legacySave = await app.request('/user/settings', {
      method: 'PUT',
      headers: {
        cookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ services: [{ name: 'Simple Service', duration_min: 30, price: 25 }] }),
    });
    assert.equal(legacySave.status, 200);

    const groupedSave = await app.request('/user/settings', {
      method: 'PUT',
      headers: {
        cookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        service_catalog: {
          categories: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Blocked', sortOrder: 0 }],
          services: [],
        },
      }),
    });
    assert.equal(groupedSave.status, 503);
    const groupedBody = (await groupedSave.json()) as { error: string };
    assert.equal(groupedBody.error, 'service_catalog_disabled');
  } finally {
    applyRequiredTestEnv({ SERVICE_CATALOG_ENABLED: 'true' });
    resetEnvCacheForTests();
  }
});

test('service catalog fallback derives General Services from legacy flat services', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const catalog = await shopsRepository.findServiceCatalogByShopId('demo-shop');

  assert.ok(catalog);
  assert.deepEqual(catalog.categories.map((category) => category.name), ['General Services']);
  assert.deepEqual(catalog.services.map((service) => service.name), ['Manicure', 'Pedicure', 'Gel Nails']);
});

test('deleting another shop service category is rejected without mutation', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const otherShop = await shopsRepository.create({
    name: 'Other Salon',
    phone_number: '+15550001111',
    user_phone: '+15550002222',
    timezone: 'America/Los_Angeles',
  });
  const otherCategoryId = '55555555-5555-4555-8555-555555555555';
  await shopsRepository.saveServiceCatalog(otherShop.id, {
    categories: [{ id: otherCategoryId, shopId: otherShop.id, name: 'Hair Color', sortOrder: 0, active: true }],
    services: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        shopId: otherShop.id,
        categoryId: otherCategoryId,
        name: 'Balayage',
        durationMinutes: 120,
        priceAmount: 180,
        priceCurrency: 'USD',
        priceType: 'from',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: [],
      },
    ],
  });

  const result = await shopsRepository.deleteServiceCategory({ shopId: 'demo-shop', categoryId: otherCategoryId });
  const otherCatalog = await shopsRepository.findServiceCatalogByShopId(otherShop.id);

  assert.ok(result);
  assert.ok(otherCatalog);
  assert.equal(otherCatalog.categories[0]?.id, otherCategoryId);
  assert.equal(otherCatalog.services[0]?.categoryId, otherCategoryId);
});

test('deleting a service category moves services to General Services', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const categoryId = '77777777-7777-4777-8777-777777777777';
  await shopsRepository.saveServiceCatalog('demo-shop', {
    categories: [{ id: categoryId, shopId: 'demo-shop', name: 'Acrylics', sortOrder: 0, active: true }],
    services: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        shopId: 'demo-shop',
        categoryId,
        name: 'Acrylic Fill',
        durationMinutes: 75,
        priceAmount: 55,
        priceCurrency: 'USD',
        priceType: 'fixed',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: [],
      },
    ],
  });

  const updated = await shopsRepository.deleteServiceCategory({ shopId: 'demo-shop', categoryId });

  assert.ok(updated);
  assert.equal(updated.categories[0]?.name, 'General Services');
  assert.equal(updated.services[0]?.name, 'Acrylic Fill');
  assert.equal(updated.services[0]?.categoryId, updated.categories[0]?.id);
});

test('website service import groups, dedupes, and saves aliases', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await loginUser(app);
  const response = await app.request('/user/read-website', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://example.com',
      services: [
        { name: 'Gel Manicure' },
        { name: 'Gel Manicure' },
        { name: 'Balayage', priceAmount: 180, priceType: 'from' },
      ],
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; servicesFound: number };
  assert.equal(body.ok, true);
  assert.equal(body.servicesFound, 2);

  const settings = await app.request('/user/settings', { headers: { cookie } });
  assert.equal(settings.status, 200);
  const settingsBody = (await settings.json()) as {
    shop: {
      service_catalog: {
        categories: Array<{ name: string }>;
        services: Array<{ name: string; aliases: string[] }>;
      };
    };
  };
  assert.ok(settingsBody.shop.service_catalog.categories.some((category) => category.name === 'Manicure'));
  assert.ok(settingsBody.shop.service_catalog.categories.some((category) => category.name === 'Color'));
  assert.ok(settingsBody.shop.service_catalog.services.find((service) => service.name === 'Gel Manicure')?.aliases.includes('gel mani'));
});

test('professional plan user can save professional-tier automation fields', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'professional', active: true });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await loginUser(app);
  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      ai_voice: 'Puck',
      ai_welcome_message: 'Welcome to RingBooker Demo Salon. I can help with bookings and pricing.',
      send_reminder_sms: false,
      send_review_request_sms: false,
    }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    shop: {
      ai_voice: string;
      ai_welcome_message: string;
      send_reminder_sms: boolean;
      send_review_request_sms: boolean;
    };
    capabilities: {
      edit_ai_custom_instructions: boolean;
    };
  };
  assert.equal(body.ok, true);
  assert.equal(body.shop.ai_voice, 'Puck');
  assert.equal(body.shop.send_reminder_sms, false);
  assert.equal(body.shop.send_review_request_sms, false);
  assert.equal(body.capabilities.edit_ai_custom_instructions, false);
});

test('website import endpoint returns review suggestions without mutating shop data', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const businessKnowledgeSuggestionsRepository = new InMemoryBusinessKnowledgeSuggestionsRepository();
  const before = await shopsRepository.findById('demo-shop');
  assert.ok(before);
  const originalWebsiteUrl = before.website_url;

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    businessKnowledgeSuggestionsRepository,
  });
  const cookie = await loginUser(app);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/robots.txt')
      ? 'Sitemap: https://93.184.216.34/sitemap.xml'
      : url.endsWith('/sitemap.xml')
        ? '<urlset><url><loc>https://93.184.216.34/services</loc></url></urlset>'
        : url.endsWith('/services')
          ? '<h1>Services</h1><p>Gel Manicure $45 45 minutes</p><p>Deluxe Pedicure starts at $65 60 minutes</p>'
        : '<h1>Demo Nails</h1><script type="application/ld+json">[{"@type":"NailSalon","openingHours":"Mon-Fri 9am-7pm"},{"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Do you accept walk-ins?","acceptedAnswer":{"@type":"Answer","text":"Walk-ins are welcome when available."}}]}]</script><a href="/services">Services</a><p>Call (555) 111-2222</p>';
    return new Response(body, { status: 200, headers: { 'content-type': url.endsWith('.xml') ? 'application/xml' : 'text/html' } });
  }) as typeof fetch;
  try {
    const response = await app.request('/user/onboarding/import-website', {
      method: 'POST',
      headers: {
        cookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://93.184.216.34' }),
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; diagnostics?: unknown; selectedPages?: unknown; rawGooglePayload?: unknown; secondarySuggestionsSummary?: { faqCount: number }; suggestions: { businessProfile: { name: { value: string | null; confidence: number; source: string | null }; phone: { value: string | null; confidence: number; source: string | null } }; hours: { value: Record<string, unknown> | null; confidence: number; source: string | null }; serviceCatalog: { services: Array<{ name: string }> } } };
    assert.equal(body.ok, true);
    assert.equal('diagnostics' in body, false);
    assert.equal('selectedPages' in body, false);
    assert.equal('rawGooglePayload' in body, false);
    assert.equal(body.suggestions.businessProfile.name.value, 'Demo Nails');
    assert.equal(typeof body.suggestions.businessProfile.name.confidence, 'number');
    assert.equal(body.suggestions.businessProfile.name.source, 'Website');
    assert.equal(typeof body.suggestions.businessProfile.phone.confidence, 'number');
    assert.equal(body.suggestions.hours.source, 'JSON-LD');
    assert.ok(body.suggestions.serviceCatalog.services.some((service) => service.name.includes('Gel Manicure')));
    assert.equal(body.secondarySuggestionsSummary?.faqCount, 1);
    const pendingSuggestions = await businessKnowledgeSuggestionsRepository.listPendingSuggestions('demo-shop');
    assert.equal(pendingSuggestions.some((item) => item.suggestionType === 'faq'), true);
    const after = await shopsRepository.findById('demo-shop');
    assert.ok(after);
    assert.equal(after.website_url, originalWebsiteUrl);
    assert.deepEqual(after.services, before.services);
    assert.deepEqual(after.faqs, before.faqs);
    assert.deepEqual(after.staff, before.staff);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('website import endpoint rejects unauthenticated, CSRF, and unexpected internal fields', async () => {
  applyRequiredTestEnv({ WEBSITE_IMPORT_ENABLED: 'true' });
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  const { app } = createUserSettingsTestApp();
  const cookie = await loginUser(app);

  const unauthenticated = await app.request('/user/onboarding/import-website', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://93.184.216.34' }),
  });
  assert.equal(unauthenticated.status, 401);

  const missingOrigin = await app.request('/user/onboarding/import-website', {
    method: 'POST',
    headers: { cookie, host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://93.184.216.34' }),
  });
  assert.equal(missingOrigin.status, 403);

  const invalidOrigin = await app.request('/user/onboarding/import-website', {
    method: 'POST',
    headers: { cookie, origin: 'https://attacker.example', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://93.184.216.34' }),
  });
  assert.equal(invalidOrigin.status, 403);

  const unexpectedFields = await app.request('/user/onboarding/import-website', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({
      url: 'https://93.184.216.34',
      debug: true,
      maxPages: 1000,
      diagnostics: true,
      forcePlaywright: true,
      rawGoogleData: { apiKey: 'should-not-accept' },
      rawLlmData: { prompt: 'should-not-accept' },
    }),
  });
  assert.equal(unexpectedFields.status, 400);
  assert.deepEqual(await unexpectedFields.json(), { ok: false, error: 'invalid_payload' });
});

test('business knowledge suggestions list, apply edited payloads, and dismiss by current shop only', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const suggestionsRepository = new InMemoryBusinessKnowledgeSuggestionsRepository();
  const { app } = createUserSettingsTestApp(shopsRepository, suggestionsRepository);
  const cookie = await loginUser(app);

  const staffPayload = { name: 'Ava', role: 'Stylist', specialties: ['Color'], notes: 'Imported bio', active: true };
  const faqPayload = { question: 'Do you take walk-ins?', answer: 'Appointments are recommended.' };
  const policyPayload = { type: 'cancellation', title: 'Cancellation', content: 'Please cancel 24 hours before your appointment.' };
  const promotionPayload = { title: 'Spring special', description: '10% off facials', expiresAt: null };
  const bookingPayload = { type: 'booking_link', label: 'Book online', value: 'https://booking.example/demo', platform: 'other' };
  await suggestionsRepository.createPendingSuggestions('demo-shop', 'https://example.com', [
    { suggestionType: 'staff', payload: staffPayload, payloadHash: payloadHash(staffPayload), confidence: 0.86, source: 'website', evidenceSnippet: 'Team card' },
    { suggestionType: 'faq', payload: faqPayload, payloadHash: payloadHash(faqPayload), confidence: 0.84, source: 'llm', evidenceSnippet: 'FAQ section' },
    { suggestionType: 'policy', payload: policyPayload, payloadHash: payloadHash(policyPayload), confidence: 0.82, source: 'website', evidenceSnippet: 'Policy page' },
    { suggestionType: 'promotion', payload: promotionPayload, payloadHash: payloadHash(promotionPayload), confidence: 0.8, source: 'website', evidenceSnippet: 'Specials page' },
    { suggestionType: 'booking_hint', payload: bookingPayload, payloadHash: payloadHash(bookingPayload), confidence: 0.9, source: 'deterministic', evidenceSnippet: 'Book button' },
  ]);
  await suggestionsRepository.createPendingSuggestions('other-shop', 'https://example.com', [
    { suggestionType: 'faq', payload: { question: 'Other?', answer: 'No' }, payloadHash: payloadHash({ question: 'Other?', answer: 'No' }), confidence: 0.9, source: 'website', evidenceSnippet: null },
  ]);

  const listResponse = await app.request('/user/business-knowledge/suggestions', { headers: { cookie } });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as { ok: boolean; suggestions: Array<{ id: string; suggestionType: string; evidenceSnippet?: string }>; counts: Record<string, number> };
  assert.equal(listBody.ok, true);
  assert.equal(listBody.suggestions.length, 5);
  assert.equal(listBody.counts.staff, 1);
  assert.equal(listBody.suggestions.some((item) => item.evidenceSnippet?.includes('<script>')), false);

  const staff = listBody.suggestions.find((item) => item.suggestionType === 'staff');
  const faq = listBody.suggestions.find((item) => item.suggestionType === 'faq');
  const policy = listBody.suggestions.find((item) => item.suggestionType === 'policy');
  assert.ok(staff);
  assert.ok(faq);
  assert.ok(policy);

  const applyResponse = await app.request('/user/business-knowledge/suggestions/apply', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({
      suggestionIds: [staff.id, faq.id, policy.id],
      editedPayloads: {
        [staff.id]: { name: 'Ava Edited', role: 'Senior stylist', specialties: ['Balayage'], notes: 'Edited bio', active: true },
        [faq.id]: { question: 'Do you offer consultations?', answer: 'Yes, when providers are available.' },
      },
    }),
  });
  assert.equal(applyResponse.status, 200);
  const applyBody = (await applyResponse.json()) as { ok: boolean; appliedCount: number };
  assert.equal(applyBody.ok, true);
  assert.equal(applyBody.appliedCount, 3);

  const updatedShop = await shopsRepository.findById('demo-shop');
  assert.ok(updatedShop);
  assert.ok(updatedShop.staff?.some((item) => item.name === 'Ava Edited' && item.role === 'Senior stylist'));
  assert.ok(updatedShop.faqs?.some((item) => item.question === 'Do you offer consultations?' && item.answer.includes('providers')));
  assert.match(updatedShop.cancel_policy, /Cancellation: Please cancel 24 hours/);

  const pendingAfterApply = await suggestionsRepository.listPendingSuggestions('demo-shop');
  const remainingIds = pendingAfterApply.map((item) => item.id);
  assert.equal(remainingIds.length, 2);
  const dismissResponse = await app.request('/user/business-knowledge/suggestions/dismiss', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ suggestionIds: remainingIds }),
  });
  assert.equal(dismissResponse.status, 200);
  assert.equal((await suggestionsRepository.listPendingSuggestions('demo-shop')).length, 0);
});

test('business knowledge suggestions reject cross-shop apply and dedupe retry imports', async () => {
  const suggestionsRepository = new InMemoryBusinessKnowledgeSuggestionsRepository();
  const { app } = createUserSettingsTestApp(new InMemoryShopsRepository(), suggestionsRepository);
  const cookie = await loginUser(app);
  const payload = { question: 'Do you validate shop scope?', answer: 'Yes.' };
  const create = { suggestionType: 'faq' as const, payload, payloadHash: payloadHash(payload), confidence: 0.9, source: 'website' as const, evidenceSnippet: 'FAQ' };
  await suggestionsRepository.createPendingSuggestions('demo-shop', 'https://example.com', [create]);
  await suggestionsRepository.createPendingSuggestions('demo-shop', 'https://example.com', [create]);
  assert.equal((await suggestionsRepository.listPendingSuggestions('demo-shop')).length, 1);

  const other = await suggestionsRepository.createPendingSuggestions('other-shop', 'https://example.com', [
    { suggestionType: 'staff', payload: { name: 'Other Staff', active: true }, payloadHash: payloadHash({ name: 'Other Staff', active: true }), confidence: 0.9, source: 'website', evidenceSnippet: null },
  ]);
  const response = await app.request('/user/business-knowledge/suggestions/apply', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ suggestionIds: [other[0].id] }),
  });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'suggestion_not_found' });
  const dismissResponse = await app.request('/user/business-knowledge/suggestions/dismiss', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ suggestionIds: [other[0].id] }),
  });
  assert.equal(dismissResponse.status, 404);
});

test('business knowledge suggestion helpers sanitize imported HTML-like payloads and UI exposes review card copy', async () => {
  const creates = pendingSuggestionsFromImport({
    staffSuggestions: [{ name: '<script>Ava</script> Chen', bio: 'Lead <b>stylist</b>', source: 'website', confidence: 0.8 }],
    policySuggestions: [],
    faqSuggestions: [],
    promotionSuggestions: [],
    bookingSetupSuggestions: [],
  } as never);
  assert.equal(JSON.stringify(creates).includes('<script>'), false);
  assert.equal(JSON.stringify(creates).includes('<b>'), false);
  const component = readFileSync('components/user/user-settings-live.tsx', 'utf8');
  assert.match(component, /Website suggestions/);
  assert.match(component, /Apply selected/);
  assert.match(component, /Dismiss/);
  assert.match(component, /Staff found/);
  assert.match(component, /Booking hints found/);
});


test('website import endpoint is disabled when WEBSITE_IMPORT_ENABLED=false', async () => {
  applyRequiredTestEnv({ WEBSITE_IMPORT_ENABLED: 'false' });
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  const shopsRepository = new InMemoryShopsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  const cookie = await loginUser(app);
  const response = await app.request('/user/onboarding/import-website', {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://93.184.216.34' }),
  });
  assert.equal(response.status, 503);
  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'website_import_disabled');
  applyRequiredTestEnv({ WEBSITE_IMPORT_ENABLED: 'true' });
  resetEnvCacheForTests();
});

test('website import endpoint rate limit blocks repeated requests safely', async () => {
  applyRequiredTestEnv({ WEBSITE_IMPORT_ENABLED: 'true' });
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  const shopsRepository = new InMemoryShopsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  const cookie = await loginUser(app);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => new Response('<h1>Demo Nails</h1>', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
  try {
    let lastStatus = 0;
    for (let i = 0; i < 13; i += 1) {
      const response = await app.request('/user/onboarding/import-website', {
        method: 'POST',
        headers: { cookie, origin: 'http://localhost:3000', host: 'localhost:3000', 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.55' },
        body: JSON.stringify({ url: 'https://93.184.216.34' }),
      });
      lastStatus = response.status;
    }
    assert.equal(lastStatus, 429);
    const after = await shopsRepository.findById('demo-shop');
    assert.ok(after);
    assert.deepEqual(after.services, (await new InMemoryShopsRepository().findById('demo-shop'))?.services);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
