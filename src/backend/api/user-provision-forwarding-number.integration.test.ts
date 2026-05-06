import { randomUUID } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';

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
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import { USER_SESSION_COOKIE, signSessionToken } from '@/src/backend/security/session';
import { hashPassword } from '@/src/backend/security/password';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: `unused-forward-seed-${randomUUID()}@ringbooker.local`,
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

class TrackingPhoneProvisioning implements PhoneProvisioningService {
  searchCalls = 0;
  provisionCalls = 0;
  onProvisionStarted?: () => void;
  provisionGate?: Promise<void>;

  async searchAvailableNumbers(): Promise<Array<{ phoneNumber: string }>> {
    this.searchCalls += 1;
    return [
      { phoneNumber: '+17145559901' },
      { phoneNumber: '+17145559902' },
    ];
  }

  async provisionNumber(params: { phoneNumber: string; requestId: string }) {
    this.provisionCalls += 1;
    this.onProvisionStarted?.();
    if (this.provisionGate) await this.provisionGate;
    return {
      phoneNumber: params.phoneNumber,
      providerNumberId: `pid-${params.phoneNumber.replace(/\D/g, '')}`,
      orderId: `ord-${params.requestId}`,
    };
  }
}

async function sessionCookieForShop(shopId: string, email: string): Promise<string> {
  const token = await signSessionToken({ role: 'user', email, shopId });
  return `${USER_SESSION_COOKIE}=${token}`;
}

type FixtureOpts = {
  paymentMethodStatus: 'none' | 'valid';
  telnyxPreset?: string | null;
  liveCallsEnabled?: boolean;
  plan?: 'starter' | 'professional' | 'enterprise';
  commercialApproved?: boolean;
};

async function createFixture(opts: FixtureOpts) {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const fakeProvisioning = new TrackingPhoneProvisioning();

  const shop = await shopsRepository.create({
    name: 'Forward Test Salon',
    phone_number: '+17145551111',
    user_phone: '+17145552222',
    timezone: 'America/Los_Angeles',
    plan: opts.plan ?? 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Alex Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Manicure', duration_min: 45, price: 35 }],
    current_onboarding_step: 4,
    ...(opts.telnyxPreset !== undefined && opts.telnyxPreset !== null
      ? { telnyx_number: opts.telnyxPreset }
      : {}),
  });

  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: opts.plan ?? 'professional',
    status: opts.plan === 'enterprise' ? 'active' : 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    trialEndsAt: trialEnds,
    paymentMethodStatus: opts.paymentMethodStatus,
  });

  if (opts.liveCallsEnabled || opts.commercialApproved) {
    await shopAccessStatesRepository.upsert({
      shopId: shop.id,
      liveCallsEnabled: opts.liveCallsEnabled ?? false,
      commercialGoLiveApprovedAt: opts.commercialApproved ? new Date().toISOString() : undefined,
      commercialGoLiveApprovedBy: opts.commercialApproved ? 'admin@example.com' : undefined,
      commercialGoLiveApprovalNote: opts.commercialApproved ? 'Approved for rollout.' : undefined,
    });
  }

  const email = `fwd-${shop.id.slice(-8)}@ringbooker.local`;
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
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await sessionCookieForShop(shop.id, email);
  return { app, shopsRepository, fakeProvisioning, shop, cookie };
}

const userHeaders = (cookie: string) => ({
  cookie,
  origin: 'http://localhost:3000',
  host: 'localhost:3000',
  'content-type': 'application/json',
});

test('provision forwarding returns 402 when payment method is not valid', async () => {
  const { app, cookie } = await createFixture({ paymentMethodStatus: 'none' });
  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 402);
  const body = (await res.json()) as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'payment_method_required');
});

test('provision forwarding returns 400 confirmation_required without explicit intent', async () => {
  const { app, cookie } = await createFixture({ paymentMethodStatus: 'valid' });
  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { ok: boolean; error?: string };
  assert.equal(body.error, 'confirmation_required');
});


test('enterprise cannot provision forwarding number without commercial approval', async () => {
  const { app, fakeProvisioning, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    plan: 'enterprise',
  });
  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'commercial_approval_required');
  assert.equal(fakeProvisioning.provisionCalls, 0);
});

test('enterprise with commercial approval can provision forwarding number', async () => {
  const { app, fakeProvisioning, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    plan: 'enterprise',
    commercialApproved: true,
  });
  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { forwardingNumber?: string };
  assert.equal(body.forwardingNumber, '+17145559901');
  assert.equal(fakeProvisioning.provisionCalls, 1);
});

test('provision forwarding with valid payment calls provisionNumber once and preserves shop.phone_number', async () => {
  const { app, shopsRepository, fakeProvisioning, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
  });
  const businessBefore = (await shopsRepository.findById(shop.id))?.phone_number;

  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    ok: boolean;
    forwardingNumber?: string;
    status?: string;
    nextStep?: string;
  };
  assert.equal(body.ok, true);
  assert.equal(body.forwardingNumber, '+17145559901');
  assert.equal(body.status, 'provisioned');
  assert.equal(body.nextStep, 'show_forwarding_instructions');

  assert.equal(fakeProvisioning.searchCalls, 1);
  assert.equal(fakeProvisioning.provisionCalls, 1);

  const updated = await shopsRepository.findById(shop.id);
  assert.equal(updated?.telnyx_number, '+17145559901');
  assert.equal(updated?.phone_number, businessBefore);
});

test('provision forwarding is idempotent when telnyx_number already set', async () => {
  const preset = '+17145558888';
  const { app, fakeProvisioning, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxPreset: preset,
  });

  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { forwardingNumber?: string; status?: string };
  assert.equal(body.forwardingNumber, preset);
  assert.equal(body.status, 'existing');
  assert.equal(fakeProvisioning.searchCalls, 0);
  assert.equal(fakeProvisioning.provisionCalls, 0);
});

test('provision forwarding returns 409 when provisioning lock is active', async () => {
  const { app, shopsRepository, fakeProvisioning, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
  });
  await shopsRepository.updateUserSettings(shop.id, {
    forwarding_number_status: 'provisioning',
    forwarding_number_provisioning_started_at: new Date().toISOString(),
  });

  const res = await app.request('/user/phone-numbers/provision-forwarding-number', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmGoLiveIntent: true }),
  });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'forwarding_number_provisioning_in_progress');
  assert.equal(fakeProvisioning.searchCalls, 0);
  assert.equal(fakeProvisioning.provisionCalls, 0);
});

test('concurrent provision forwarding requests call provisionNumber once', async () => {
  const { app, fakeProvisioning, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
  });
  let releaseProvision!: () => void;
  const provisionStarted = new Promise<void>((resolve) => {
    fakeProvisioning.onProvisionStarted = resolve;
  });
  fakeProvisioning.provisionGate = new Promise<void>((resolve) => {
    releaseProvision = resolve;
  });

  const request = () =>
    app.request('/user/phone-numbers/provision-forwarding-number', {
      method: 'POST',
      headers: userHeaders(cookie),
      body: JSON.stringify({ confirmGoLiveIntent: true }),
    });

  const r1Promise = request();
  await provisionStarted;
  const r2 = await request();
  releaseProvision();
  const r1 = await r1Promise;
  assert.equal(fakeProvisioning.provisionCalls, 1);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 409);
});
