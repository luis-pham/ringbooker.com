import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
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
    shop: { cancel_policy: string; allow_callbacks: boolean; service_catalog?: { services: Array<{ name: string }> } };
  };
  assert.equal(allowedBody.ok, true);
  assert.equal(allowedBody.shop.allow_callbacks, false);
  assert.equal(
    allowedBody.shop.cancel_policy,
    'Appointments should be canceled at least 24 hours before the scheduled time.',
  );
  assert.equal(allowedBody.shop.service_catalog?.services[0]?.name, 'Basic Manicure');
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
            durationMinutes: 45,
            priceAmount: 45,
            priceType: 'from',
            sortOrder: 0,
          },
          {
            id: '44444444-4444-4444-8444-444444444444',
            categoryId: pedicureCategoryId,
            name: 'Deluxe Pedicure',
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
        services: Array<{ name: string; priceType: string; bookable: boolean }>;
      };
    };
  };
  assert.equal(body.ok, true);
  assert.deepEqual(body.shop.service_catalog.categories.map((category) => category.name), ['Manicure', 'Pedicure']);
  assert.deepEqual(body.shop.services.map((service) => service.name), ['Gel Manicure', 'Deluxe Pedicure']);
  assert.equal(body.shop.services[0]?.duration_min, 45);
  assert.equal(body.shop.services[0]?.price, 45);
  assert.equal(body.shop.service_catalog.services[1]?.priceType, 'varies');
  assert.equal(body.shop.service_catalog.services[1]?.bookable, false);
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
