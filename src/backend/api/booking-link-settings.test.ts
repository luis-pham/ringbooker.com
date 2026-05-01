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
  const uniqueTestIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
  const loginResponse = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      'x-forwarded-for': uniqueTestIp,
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

async function connectBookingLinkProvider(params: {
  app: ReturnType<typeof createBackendApp>;
  cookie: string;
  provider: 'glossgenius' | 'fresha' | 'booksy';
  bookingUrl: string;
}) {
  return params.app.request(`/user/calendar/providers/${params.provider}/connect`, {
    method: 'POST',
    headers: {
      cookie: params.cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ bookingUrl: params.bookingUrl }),
  });
}

test('glossgenius connect rejects invalid URL', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await connectBookingLinkProvider({
    app,
    cookie,
    provider: 'glossgenius',
    bookingUrl: 'not-a-url',
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.match(body.error, /https/i);
});

test('glossgenius connect rejects http URL', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await connectBookingLinkProvider({
    app,
    cookie,
    provider: 'glossgenius',
    bookingUrl: 'http://glossgenius.com/test',
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.match(body.error, /valid https/i);
});

test('glossgenius connect accepts valid https URL', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await connectBookingLinkProvider({
    app,
    cookie,
    provider: 'glossgenius',
    bookingUrl: 'https://glossgenius.com/test-salon',
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; connected: boolean; provider: string };
  assert.deepEqual(body, { ok: true, connected: true, provider: 'glossgenius' });
});

test('fresha connect accepts valid https URL', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await connectBookingLinkProvider({
    app,
    cookie,
    provider: 'fresha',
    bookingUrl: 'https://fresha.com/book-now/test',
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; connected: boolean; provider: string };
  assert.deepEqual(body, { ok: true, connected: true, provider: 'fresha' });
});

test('booksy connect accepts valid https URL', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await connectBookingLinkProvider({
    app,
    cookie,
    provider: 'booksy',
    bookingUrl: 'https://booksy.com/en-us/12345',
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; connected: boolean; provider: string };
  assert.deepEqual(body, { ok: true, connected: true, provider: 'booksy' });
});

test('options returns capability note for glossgenius', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/glossgenius/options', {
    headers: { cookie },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    type?: string;
    capabilities?: { hasBookingLink?: boolean };
  };
  assert.equal(body.ok, true);
  assert.equal(body.type, 'booking_link');
  assert.equal(body.capabilities?.hasBookingLink, true);
});

test('options returns capability note for fresha', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/fresha/options', {
    headers: { cookie },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; type?: string };
  assert.equal(body.ok, true);
  assert.equal(body.type, 'booking_link');
});

test('options returns capability note for booksy', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/booksy/options', {
    headers: { cookie },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; type?: string };
  assert.equal(body.ok, true);
  assert.equal(body.type, 'booking_link');
});
