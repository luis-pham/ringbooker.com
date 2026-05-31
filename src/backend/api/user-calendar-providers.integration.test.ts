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
import { parseSquareConnectionCredentials } from '@/src/backend/services/calendar/provider-connections';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
  SQUARE_APPLICATION_ID: 'sq0id-test',
  SQUARE_APPLICATION_SECRET: 'sq0secret-test',
  ACUITY_CLIENT_ID: 'acuity-client-test',
  ACUITY_CLIENT_SECRET: 'acuity-secret-test',
});

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const loginResponse = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
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

function withCalendarOAuthCookies(sessionCookie: string, provider: 'square_appointments' | 'acuity', state = 'state-test') {
  return `${sessionCookie}; rb_calendar_provider_state=${state}; rb_calendar_provider_name=${provider}; rb_calendar_provider_shop=demo-shop`;
}

async function waitForSquareCatalogSync(shopsRepository: InMemoryShopsRepository) {
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    const shop = await shopsRepository.findById('demo-shop');
    const manicure = shop?.service_catalog?.services.find((service) => service.name === 'Manicure');
    if (manicure?.externalProvider === 'square') return shop;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return shopsRepository.findById('demo-shop');
}

function mockOAuthFetch() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('squareupsandbox.com/oauth2/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'square-access-token',
          refresh_token: 'square-refresh-token',
          expires_at: '2026-06-30T00:00:00Z',
          merchant_id: 'square-merchant-id',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('squareupsandbox.com/v2/locations')) {
      return new Response(
        JSON.stringify({
          locations: [
            { id: 'L_INACTIVE', name: 'Inactive', status: 'INACTIVE' },
            { id: 'L_ACTIVE', name: 'Active', status: 'ACTIVE' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('squareupsandbox.com/v2/catalog/search')) {
      return new Response(
        JSON.stringify({
          objects: [
            {
              id: 'SV_MANICURE',
              type: 'ITEM_VARIATION',
              version: 7,
              is_deleted: false,
              item_variation_data: {
                name: 'Regular',
                item_id: 'ITEM_MANICURE',
                available_for_booking: true,
                service_duration: 1800000,
              },
            },
          ],
          related_objects: [
            {
              id: 'ITEM_MANICURE',
              type: 'ITEM',
              item_data: { name: 'Manicure' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('acuityscheduling.com/oauth2/token')) {
      return new Response(
        JSON.stringify({
          access_token: 'acuity-access-token',
          token_type: 'Bearer',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('acuityscheduling.com/api/v1/me')) {
      return new Response(
        JSON.stringify({
          id: 12345,
          email: 'owner@example.com',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(JSON.stringify({}), { status: 404, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('user calendar providers list + configure + disconnect flow works with shop-scoped credentials', async () => {
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

  const listBefore = await app.request('/user/calendar/providers', {
    headers: { cookie },
  });
  assert.equal(listBefore.status, 200);
  const listBeforeBody = (await listBefore.json()) as {
    ok: boolean;
    providers: Array<{ id: string; connected: boolean; configured: boolean }>;
  };
  assert.equal(listBeforeBody.ok, true);
  const squareBefore = listBeforeBody.providers.find((provider) => provider.id === 'square_appointments');
  assert.ok(squareBefore);
  assert.equal(squareBefore.connected, false);
  assert.equal(squareBefore.configured, false);

  const configureWithoutConnection = await app.request('/user/calendar/providers/square_appointments/configure', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      locationId: 'L_TEST',
      serviceVariationId: 'SV_TEST',
    }),
  });
  assert.equal(configureWithoutConnection.status, 400);
  const configureWithoutConnectionBody = (await configureWithoutConnection.json()) as { ok: boolean; error: string };
  assert.equal(configureWithoutConnectionBody.error, 'provider_not_connected');

  await shopsRepository.updateCalendarConnection('demo-shop', {
    google_cal_id: null,
    google_cal_credentials_encrypted: JSON.stringify({
      provider: 'square_appointments',
      access_token: 'sq0atp_test',
      refresh_token: 'sq0rtp_test',
      merchant_id: 'm_test',
    }),
  });

  const configureResponse = await app.request('/user/calendar/providers/square_appointments/configure', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      locationId: 'L_TEST',
      serviceVariationId: 'SV_TEST',
      teamMemberId: 'TM_TEST',
    }),
  });
  assert.equal(configureResponse.status, 200);
  const configureBody = (await configureResponse.json()) as { ok: boolean; configured: boolean };
  assert.equal(configureBody.ok, true);
  assert.equal(configureBody.configured, true);

  const listAfterConfigure = await app.request('/user/calendar/providers', {
    headers: { cookie },
  });
  assert.equal(listAfterConfigure.status, 200);
  const listAfterConfigureBody = (await listAfterConfigure.json()) as {
    ok: boolean;
    providers: Array<{ id: string; connected: boolean; configured: boolean }>;
  };
  const squareAfterConfigure = listAfterConfigureBody.providers.find((provider) => provider.id === 'square_appointments');
  assert.ok(squareAfterConfigure);
  assert.equal(squareAfterConfigure.connected, true);
  assert.equal(squareAfterConfigure.configured, true);

  const disconnectResponse = await app.request('/user/calendar/providers/square_appointments/disconnect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
  });
  assert.equal(disconnectResponse.status, 200);
  const disconnectBody = (await disconnectResponse.json()) as { ok: boolean; disconnected: boolean };
  assert.equal(disconnectBody.ok, true);
  assert.equal(disconnectBody.disconnected, true);
});

test('square oauth callback clears prior booking url on successful connect', async () => {
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
  await shopsRepository.updateUserSettings('demo-shop', {
    booking_url: 'https://old-booking.example/salon',
    booking_method: 'app',
    selected_integration: 'fresha',
  });
  const restoreFetch = mockOAuthFetch();
  try {
    const response = await app.request('/user/calendar/providers/square_appointments/connect/callback?state=state-test&code=square-code', {
      headers: {
        cookie: withCalendarOAuthCookies(cookie, 'square_appointments'),
        host: 'localhost:3000',
      },
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /calendar_connect=success/);
    const shop = await waitForSquareCatalogSync(shopsRepository);
    assert.equal(shop?.booking_url, null);
    assert.equal(shop?.booking_method, 'app');
    assert.equal(shop?.selected_integration, 'square_appointments');
    const credentials = parseSquareConnectionCredentials(shop?.google_cal_credentials_encrypted);
    assert.equal(credentials?.access_token, 'square-access-token');
    assert.equal(credentials?.refresh_token, 'square-refresh-token');
    assert.equal(credentials?.location_id, 'L_ACTIVE');
    const manicure = shop?.service_catalog?.services.find((service) => service.name === 'Manicure');
    assert.equal(manicure?.externalProvider, 'square');
    assert.equal(manicure?.externalServiceId, 'SV_MANICURE');
    assert.equal(manicure?.externalLocationId, 'L_ACTIVE');
    assert.equal(manicure?.externalMetadata?.variation_version, 7);
  } finally {
    restoreFetch();
  }
});

test('acuity oauth callback clears prior booking url on successful connect', async () => {
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
  await shopsRepository.updateUserSettings('demo-shop', {
    booking_url: 'https://old-acuity.example/schedule',
    booking_method: 'app',
    selected_integration: 'custom',
  });
  const restoreFetch = mockOAuthFetch();
  try {
    const response = await app.request('/user/calendar/providers/acuity/connect/callback?state=state-test&code=acuity-code', {
      headers: {
        cookie: withCalendarOAuthCookies(cookie, 'acuity'),
        host: 'localhost:3000',
      },
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /calendar_connect=success/);
    const shop = await shopsRepository.findById('demo-shop');
    assert.equal(shop?.booking_url, null);
    assert.equal(shop?.booking_method, 'app');
    assert.equal(shop?.selected_integration, 'acuity');
    assert.equal(shop?.acuity_connection_status, 'connected');
    assert.equal(shop?.acuity_user_id, '12345');
    assert.ok(shop?.acuity_access_token_encrypted);
  } finally {
    restoreFetch();
  }
});
