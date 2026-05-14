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
  provider: 'glossgenius' | 'fresha' | 'custom' | 'booksy';
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

test('custom booking link accepts any valid https URL', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await connectBookingLinkProvider({
    app,
    cookie,
    provider: 'custom',
    bookingUrl: 'https://booking.example.com/ringbooker-salon',
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; connected: boolean; provider: string };
  assert.deepEqual(body, { ok: true, connected: true, provider: 'custom' });

  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.booking_url, 'https://booking.example.com/ringbooker-salon');
});

test('integration preferences persist booking method and selected app', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/integrations/preferences', {
    method: 'PATCH',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ bookingMethod: 'direct', selectedIntegration: null }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; bookingMethod: string | null; selectedIntegration: string | null };
  assert.equal(body.ok, true);
  assert.equal(body.bookingMethod, 'direct');
  assert.equal(body.selectedIntegration, null);

  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.booking_method, 'direct');
  assert.equal(shop?.selected_integration, null);
});

test('vagaro booking link stores app selection without requiring API credentials', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/vagaro/booking-url', {
    method: 'PATCH',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ bookingUrl: 'https://vagaro.com/test-salon' }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; provider: string; bookingUrl: string };
  assert.equal(body.ok, true);
  assert.equal(body.provider, 'vagaro');
  assert.equal(body.bookingUrl, 'https://vagaro.com/test-salon');

  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.booking_url, 'https://vagaro.com/test-salon');
  assert.equal(shop?.booking_method, 'app');
  assert.equal(shop?.selected_integration, 'vagaro');
});

test('mindbody connect stores API credentials and app selection', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/mindbody/connect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      siteId: '12345',
      apiKey: 'mb-api-key',
      sourceName: 'RingBookerTest',
      bookingUrl: 'https://clients.mindbodyonline.com/test',
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; provider: string; connected: boolean; configured: boolean };
  assert.deepEqual(body, { ok: true, provider: 'mindbody', connected: true, configured: true });

  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.booking_method, 'app');
  assert.equal(shop?.selected_integration, 'mindbody');
  assert.equal(shop?.booking_url, 'https://clients.mindbodyonline.com/test');
  assert.match(shop?.integration_credentials_encrypted ?? '', /mindbody/);
});

test('mindbody disconnect clears provider credentials', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  await app.request('/user/calendar/providers/mindbody/connect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ siteId: '12345', apiKey: 'mb-api-key' }),
  });

  const response = await app.request('/user/calendar/providers/mindbody/disconnect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; disconnected: boolean; provider: string };
  assert.deepEqual(body, { ok: true, disconnected: true, provider: 'mindbody' });
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.integration_credentials_encrypted, null);
  assert.equal(shop?.selected_integration, null);
});

test('acuity connect stores API credentials and app selection', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/acuity/connect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      userId: 'acuity-user',
      apiKey: 'acuity-key',
      appointmentTypeId: '100',
      calendarId: '200',
      timezone: 'America/Chicago',
      bookingUrl: 'https://example.as.me/',
    }),
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; provider: string; connected: boolean; configured: boolean };
  assert.deepEqual(body, { ok: true, provider: 'acuity', connected: true, configured: true });

  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.booking_method, 'app');
  assert.equal(shop?.selected_integration, 'acuity');
  assert.equal(shop?.booking_url, 'https://example.as.me/');
  assert.match(shop?.integration_credentials_encrypted ?? '', /acuity/);
});

test('acuity connect rejects missing API credentials', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/acuity/connect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ appointmentTypeId: '100' }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.match(body.error, /Acuity User ID and API key|OAuth access token/i);
});

test('acuity disconnect clears provider credentials', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  await app.request('/user/calendar/providers/acuity/connect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ userId: 'acuity-user', apiKey: 'acuity-key' }),
  });

  const response = await app.request('/user/calendar/providers/acuity/disconnect', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
    },
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; disconnected: boolean; provider: string };
  assert.deepEqual(body, { ok: true, disconnected: true, provider: 'acuity' });
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.integration_credentials_encrypted, null);
  assert.equal(shop?.selected_integration, null);
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
