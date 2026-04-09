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
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const loginResponse = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
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
