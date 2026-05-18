import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryForwardingTestSessionsRepository } from '@/src/backend/adapters/memory/forwarding-test-sessions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryTestCallAttemptsRepository } from '@/src/backend/adapters/memory/test-call-attempts-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import { USER_SESSION_COOKIE, signSessionToken } from '@/src/backend/security/session';
import { hashPassword } from '@/src/backend/security/password';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: `go-live-regression-${randomUUID()}@ringbooker.local`,
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

class TrackingPhoneProvisioning implements PhoneProvisioningService {
  searchCalls = 0;
  provisionCalls = 0;
  searchResults: Array<{ phoneNumber: string }> = [
    { phoneNumber: '+17145559901' },
    { phoneNumber: '+17145559902' },
  ];

  async searchAvailableNumbers(): Promise<Array<{ phoneNumber: string }>> {
    this.searchCalls += 1;
    return this.searchResults;
  }

  async provisionNumber(params: { phoneNumber: string; requestId: string }) {
    this.provisionCalls += 1;
    return {
      phoneNumber: params.phoneNumber,
      providerNumberId: `pid-${params.phoneNumber.replace(/\D/g, '')}`,
      orderId: `ord-${params.requestId}`,
    };
  }

  async releaseNumber(_params: { phoneNumber: string; providerNumberId?: string; orderId?: string; reason: string }) {}
}

type Opts = {
  paymentMethodStatus: 'none' | 'valid';
  telnyxNumber?: string | null;
  liveCallsEnabled?: boolean;
  plan?: 'starter' | 'professional' | 'enterprise';
};

async function createFixture(opts: Opts) {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const forwardingTestSessionsRepository = new InMemoryForwardingTestSessionsRepository();
  const fakeProvisioning = new TrackingPhoneProvisioning();

  const shop = await shopsRepository.create({
    name: 'Regression Salon',
    phone_number: '+17145551111',
    user_phone: '+17145552222',
    timezone: 'America/Los_Angeles',
    plan: opts.plan ?? 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Manicure', duration_min: 45, price: 35 }],
    current_onboarding_step: 4,
    ...(opts.telnyxNumber ? { telnyx_number: opts.telnyxNumber } : {}),
  });

  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: opts.plan ?? 'professional',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    paymentMethodStatus: opts.paymentMethodStatus,
  });

  if (opts.liveCallsEnabled) {
    await shopAccessStatesRepository.upsert({ shopId: shop.id, liveCallsEnabled: true });
  }

  const email = `reg-${shop.id.slice(-8)}@ringbooker.local`;
  const authUsersRepository = new InMemoryAuthUsersRepository();
  await authUsersRepository.create({
    email,
    role: 'user',
    shopId: shop.id,
    passwordHash: hashPassword('pw'),
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: fakeProvisioning,
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    testCallAttemptsRepository: new InMemoryTestCallAttemptsRepository(),
    forwardingTestSessionsRepository,
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = `${USER_SESSION_COOKIE}=${await signSessionToken({ role: 'user', email, shopId: shop.id })}`;
  return { app, shopsRepository, shopAccessStatesRepository, forwardingTestSessionsRepository, fakeProvisioning, shop, cookie };
}

const h = (cookie: string) => ({
  cookie,
  origin: 'http://localhost:3000',
  host: 'localhost:3000',
  'content-type': 'application/json',
});

// 1. Provision number without billing → should succeed (200)
test('regression: provision number without billing succeeds and sets provisioned_at', async () => {
  const { app, shopsRepository, fakeProvisioning, shop, cookie } = await createFixture({ paymentMethodStatus: 'none' });
  const res = await app.request('/user/go-live/provision-number', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean; forwardingNumber?: string; status?: string };
  assert.equal(body.ok, true);
  assert.equal(body.forwardingNumber, '+17145559901');
  assert.equal(body.status, 'provisioned');
  assert.equal(fakeProvisioning.provisionCalls, 1);
  const updated = await shopsRepository.findById(shop.id);
  assert.ok(updated?.forwarding_number_provisioned_at);
  assert.equal(updated?.telnyx_number, '+17145559901');
  assert.equal(updated?.phone_number, '+17145551111');
});

// 2. Provision number twice for same shop → should return existing number (idempotent)
test('regression: provision number is idempotent when forwarding number already assigned', async () => {
  const preset = '+17145558888';
  const { app, fakeProvisioning, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: preset,
  });
  const res = await app.request('/user/go-live/provision-number', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { forwardingNumber?: string; status?: string };
  assert.equal(body.forwardingNumber, preset);
  assert.equal(body.status, 'existing');
  assert.equal(fakeProvisioning.searchCalls, 0);
  assert.equal(fakeProvisioning.provisionCalls, 0);
});

// 3. Provision number 4+ times in 24h → should return 429
test('regression: provision number rate-limited at 4th attempt within 24h', async () => {
  const { app, fakeProvisioning, cookie } = await createFixture({ paymentMethodStatus: 'none' });
  fakeProvisioning.searchResults = [];

  const provision = () =>
    app.request('/user/go-live/provision-number', {
      method: 'POST',
      headers: h(cookie),
      body: JSON.stringify({ confirmGoLiveIntent: true }),
    });

  assert.equal((await provision()).status, 503);
  assert.equal((await provision()).status, 503);
  assert.equal((await provision()).status, 503);
  const fourth = await provision();
  assert.equal(fourth.status, 429);
});

// 4. Start forwarding test without billing → should succeed
test('regression: start forwarding test without billing succeeds and increments count', async () => {
  const { app, shopsRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'none',
    telnyxNumber: '+17145559999',
  });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean; test_calls_remaining?: number; expiresAt?: string };
  assert.equal(body.ok, true);
  assert.equal(body.test_calls_remaining, 2);
  assert.ok(body.expiresAt);
  const updated = await shopsRepository.findById(shop.id);
  assert.equal(updated?.test_call_count, 1);
});

// 5. Start forwarding test when test_call_count >= 3 and not live → should return 429
test('regression: start forwarding test returns 429 when count at limit and not live', async () => {
  const { app, shopsRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'none',
    telnyxNumber: '+17145559999',
  });
  await shopsRepository.updateUserSettings(shop.id, { test_call_count: 3, test_call_limit: 3 });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 429);
  const body = (await res.json()) as { error?: string; test_calls_remaining?: number };
  assert.equal(body.error, 'test_call_limit_reached');
  assert.equal(body.test_calls_remaining, 0);
});

// 6. Start forwarding test when live_answering_enabled = true → should ignore limit, succeed
test('regression: start forwarding test ignores pre-billing limit when live answering is enabled', async () => {
  const { app, shopsRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'none',
    telnyxNumber: '+17145559999',
    liveCallsEnabled: true,
  });
  await shopsRepository.updateUserSettings(shop.id, { test_call_count: 3, test_call_limit: 3 });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean };
  assert.equal(body.ok, true);
});

// 7. POST /go-live/enable without billing → should fail (402 payment_method_required)
test('regression: enable live answering returns 402 when payment method not set up', async () => {
  const { app, shopAccessStatesRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'none',
    telnyxNumber: '+17145559999',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    forwardingSetupVerifiedAt: new Date().toISOString(),
    forwardingSetupVerifiedVia: 'manual_confirmation',
  });
  const res = await app.request('/user/go-live/enable', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 402);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'payment_method_required');
});

// 8. POST /go-live/enable with billing + verified forwarding → should succeed
test('regression: enable live answering succeeds with valid billing and forwarding verified', async () => {
  const { app, shopAccessStatesRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    forwardingSetupVerifiedAt: new Date().toISOString(),
    forwardingSetupVerifiedVia: 'manual_confirmation',
  });
  const res = await app.request('/user/go-live/enable', {
    method: 'POST',
    headers: h(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean; liveCallsEnabled?: boolean; goLiveAt?: string };
  assert.equal(body.ok, true);
  assert.equal(body.liveCallsEnabled, true);
  assert.ok(body.goLiveAt);
  const access = await shopAccessStatesRepository.findByShopId(shop.id);
  assert.equal(access?.liveCallsEnabled, true);
  assert.ok(access?.goLiveAt);
});
