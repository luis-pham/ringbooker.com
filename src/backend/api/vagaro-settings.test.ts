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

function createUserCalendarTestApp() {
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
  return { app, shopsRepository };
}

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

test('vagaro connect rejects missing businessId', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/vagaro/connect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      clientId: 'vagaro-client-id',
      clientSecretKey: 'vagaro-client-secret',
      region: 'us',
    }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.match(body.error, /business id is required/i);
});

test('vagaro options returns capability note', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/v2/services')) {
      return new Response(JSON.stringify({ services: [] }), { status: 200 });
    }
    if (url.includes('/api/v2/employees')) {
      return new Response(JSON.stringify({ employees: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  try {
    await shopsRepository.updateCalendarConnection('demo-shop', {
      google_cal_id: null,
      google_cal_credentials_encrypted: JSON.stringify({
        provider: 'vagaro',
        region: 'us',
        businessId: 'business-123',
        accessToken: 'vagaro-access-token',
      }),
    });

    const response = await app.request('/user/calendar/providers/vagaro/options', {
      headers: { cookie },
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; options?: { capabilityNote?: string } };
    assert.equal(body.ok, true);
    assert.match(body.options?.capabilityNote ?? '', /Availability checking supported/);
    assert.match(body.options?.capabilityNote ?? '', /Booking creation requires Vagaro app/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
