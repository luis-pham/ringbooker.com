import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryTestCallAttemptsRepository } from '@/src/backend/adapters/memory/test-call-attempts-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: `unused-callme-seed-${randomUUID()}@ringbooker.local`,
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

class RecordingTelephonyService extends NoopTelephonyService {
  lastFrom: string | null = null;
  lastTo: string | null = null;

  override async createOutboundCall(params: Parameters<TelephonyService['createOutboundCall']>[0]) {
    this.lastFrom = params.from;
    this.lastTo = params.to;
    return super.createOutboundCall(params);
  }
}

function createCallMeApp(telephony: TelephonyService) {
  return createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: telephony,
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    testCallAttemptsRepository: new InMemoryTestCallAttemptsRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
}

async function signupAndFinishOnboarding(app: ReturnType<typeof createBackendApp>, email: string): Promise<string> {
  const signupResponse = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      email,
      password: 'new-user-password',
      remember: true,
      plan: 'starter',
    }),
  });
  assert.equal(signupResponse.status, 201);
  const cookie = signupResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const settings = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Call Me Test Salon',
      user_name: 'Owner Name',
      vertical: 'nail_salon',
      phone_number: '+15551110001',
      user_phone: '+15551110002',
      timezone: 'America/Los_Angeles',
      hours: { mon: { open: '09:00', close: '17:00' } },
      current_onboarding_step: 4,
    }),
  });
  assert.equal(settings.status, 200);
  return cookie;
}

test('call-me returns outbound_caller_id_not_configured when env unset', async () => {
  applyRequiredTestEnv();
  process.env.RINGBOOKER_OUTBOUND_CALLER_ID = '';
  process.env.TELNYX_OUTBOUND_CALLER_ID = '';
  resetEnvCacheForTests();

  const telephony = new RecordingTelephonyService();
  const app = createCallMeApp(telephony);
  const email = `callme-missing-cid-${randomUUID()}@ringbooker.local`;
  const cookie = await signupAndFinishOnboarding(app, email);

  const res = await app.request('/user/test-calls/call-me', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 503);
  const body = (await res.json()) as { ok: boolean; error?: string; message?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'outbound_caller_id_not_configured');
  assert.equal(telephony.lastFrom, null);

  process.env.RINGBOOKER_OUTBOUND_CALLER_ID = '+15555550199';
  resetEnvCacheForTests();
});

test('call-me uses shared RINGBOOKER_OUTBOUND_CALLER_ID as from', async () => {
  applyRequiredTestEnv();
  process.env.RINGBOOKER_OUTBOUND_CALLER_ID = '+15555550199';
  resetEnvCacheForTests();

  const telephony = new RecordingTelephonyService();
  const app = createCallMeApp(telephony);
  const email = `callme-happy-${randomUUID()}@ringbooker.local`;
  const cookie = await signupAndFinishOnboarding(app, email);

  const res = await app.request('/user/test-calls/call-me', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean };
  assert.equal(body.ok, true);
  assert.equal(telephony.lastFrom, '+15555550199');
  assert.equal(telephony.lastTo, '+15551110002');
});

test('call-me rejects arbitrary phoneNumber body override', async () => {
  applyRequiredTestEnv();
  process.env.RINGBOOKER_OUTBOUND_CALLER_ID = '+15555550199';
  resetEnvCacheForTests();

  const telephony = new RecordingTelephonyService();
  const app = createCallMeApp(telephony);
  const email = `callme-arbitrary-${randomUUID()}@ringbooker.local`;
  const cookie = await signupAndFinishOnboarding(app, email);

  const res = await app.request('/user/test-calls/call-me', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ phoneNumber: '+19005550123' }),
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid_payload');
  assert.equal(telephony.lastTo, null);
});

test('call-me returns phone_number_required when saved owner phone is invalid', async () => {
  applyRequiredTestEnv();
  process.env.RINGBOOKER_OUTBOUND_CALLER_ID = '+15555550199';
  resetEnvCacheForTests();

  const telephony = new RecordingTelephonyService();
  const app = createCallMeApp(telephony);
  const email = `callme-invalid-owner-${randomUUID()}@ringbooker.local`;
  const cookie = await signupAndFinishOnboarding(app, email);

  const settings = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ user_phone: 'abc' }),
  });
  assert.equal(settings.status, 200);

  const res = await app.request('/user/test-calls/call-me', {
    method: 'POST',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 422);
  const body = (await res.json()) as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'phone_number_required');
  assert.equal(telephony.lastTo, null);
});
