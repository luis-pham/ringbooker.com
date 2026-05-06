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
import { USER_SESSION_COOKIE, signSessionToken } from '@/src/backend/security/session';
import { hashPassword } from '@/src/backend/security/password';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { evaluateTelnyxCallControlInboundInitiated } from '@/src/backend/webhooks/telnyx-call-control';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: `unused-fwd-test-${randomUUID()}@ringbooker.local`,
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

async function sessionCookieForShop(shopId: string, email: string): Promise<string> {
  const token = await signSessionToken({ role: 'user', email, shopId });
  return `${USER_SESSION_COOKIE}=${token}`;
}

const userHeaders = (cookie: string) => ({
  cookie,
  origin: 'http://localhost:3000',
  host: 'localhost:3000',
  'content-type': 'application/json',
});

type Fx = {
  paymentMethodStatus: 'none' | 'valid';
  telnyxNumber: string | null;
  liveCallsEnabled?: boolean;
  onboardingComplete?: boolean;
  trialEndsAt?: string;
  plan?: 'starter' | 'professional' | 'enterprise';
  commercialApproved?: boolean;
};

async function createFixture(opts: Fx) {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const forwardingTestSessionsRepository = new InMemoryForwardingTestSessionsRepository();

  const shop = await shopsRepository.create({
    name: 'Fwd Test Salon',
    phone_number: '+17145551111',
    user_phone: '+17145552222',
    timezone: 'America/Los_Angeles',
    plan: opts.plan ?? 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Alex Owner',
    hours: opts.onboardingComplete === false ? {} : { mon: { open: '09:00', close: '17:00' } },
    services: opts.onboardingComplete === false ? [] : [{ name: 'Manicure', duration_min: 45, price: 35 }],
    current_onboarding_step: 4,
    ...(opts.telnyxNumber ? { telnyx_number: opts.telnyxNumber } : {}),
  });

  const trialEnds = opts.trialEndsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
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
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    testCallAttemptsRepository: new InMemoryTestCallAttemptsRepository(),
    forwardingTestSessionsRepository,
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await sessionCookieForShop(shop.id, email);
  return {
    app,
    shopsRepository,
    shopAccessStatesRepository,
    forwardingTestSessionsRepository,
    shop,
    cookie,
  };
}

test('POST /user/go-live/start-forwarding-test returns 402 when payment method not valid', async () => {
  const { app, cookie } = await createFixture({ paymentMethodStatus: 'none', telnyxNumber: '+17145559999' });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 402);
});

test('POST /user/go-live/start-forwarding-test returns 409 without telnyx_number', async () => {
  const { app, cookie } = await createFixture({ paymentMethodStatus: 'valid', telnyxNumber: null });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'forwarding_number_required');
});


test('enterprise without commercial approval cannot start forwarding test', async () => {
  const { app, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
    plan: 'enterprise',
  });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'commercial_approval_required');
});

test('POST /user/go-live/start-forwarding-test creates pending session', async () => {
  const { app, forwardingTestSessionsRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
  });
  const res = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean; status?: string; expiresAt?: string; sessionId?: string };
  assert.equal(body.ok, true);
  assert.equal(body.status, 'pending');
  assert.ok(body.expiresAt && body.sessionId);
  const latest = await forwardingTestSessionsRepository.findLatestByShopId(shop.id);
  assert.equal(latest?.status, 'pending');
});

test('POST /user/go-live/start-forwarding-test reuses unexpired pending session', async () => {
  const { app, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
  });
  const r1 = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  const b1 = (await r1.json()) as { sessionId?: string; expiresAt?: string };
  const r2 = await app.request('/user/go-live/start-forwarding-test', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  const b2 = (await r2.json()) as { sessionId?: string; expiresAt?: string };
  assert.equal(b1.sessionId, b2.sessionId);
  assert.equal(b1.expiresAt, b2.expiresAt);
});

test('POST /user/test-call-forwarding does not mark verified without inbound (legacy compat)', async () => {
  const { app, shopAccessStatesRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
  });
  const res = await app.request('/user/test-call-forwarding', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean; success?: boolean; status?: string };
  assert.equal(body.ok, true);
  assert.equal(body.success, false);
  assert.equal(body.status, 'pending');
  const access = await shopAccessStatesRepository.findByShopId(shop.id);
  assert.ok(!access?.forwardingSetupVerifiedAt);
});

test('POST /user/go-live/confirm-forwarding-setup rejects without valid payment', async () => {
  const { app, cookie } = await createFixture({ paymentMethodStatus: 'none', telnyxNumber: '+17145559999' });
  const res = await app.request('/user/go-live/confirm-forwarding-setup', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmForwardingReady: true }),
  });
  assert.equal(res.status, 402);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'payment_method_required');
});

test('POST /user/go-live/confirm-forwarding-setup rejects expired trial', async () => {
  const { app, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
    trialEndsAt: new Date(Date.now() - 60 * 1000).toISOString(),
  });
  const res = await app.request('/user/go-live/confirm-forwarding-setup', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmForwardingReady: true }),
  });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'trial_expired');
});

test('POST /user/go-live/confirm-forwarding-setup rejects incomplete onboarding', async () => {
  const { app, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
    onboardingComplete: false,
  });
  const res = await app.request('/user/go-live/confirm-forwarding-setup', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmForwardingReady: true }),
  });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'onboarding_incomplete');
});

test('POST /user/go-live/confirm-forwarding-setup rejects missing forwarding number', async () => {
  const { app, cookie } = await createFixture({ paymentMethodStatus: 'valid', telnyxNumber: null });
  const res = await app.request('/user/go-live/confirm-forwarding-setup', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmForwardingReady: true }),
  });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'forwarding_number_required');
});

test('POST /user/go-live/confirm-forwarding-setup succeeds for valid state', async () => {
  const { app, shopAccessStatesRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
  });
  const res = await app.request('/user/go-live/confirm-forwarding-setup', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmForwardingReady: true }),
  });
  assert.equal(res.status, 200);
  const access = await shopAccessStatesRepository.findByShopId(shop.id);
  assert.ok(access?.forwardingSetupVerifiedAt);
  assert.equal(access?.forwardingSetupVerifiedVia, 'manual_confirmation');
});

test('inbound call.initiated to telnyx_number marks forwarding test passed when session pending', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const forwardingTestSessionsRepository = new InMemoryForwardingTestSessionsRepository();

  const shop = await shopsRepository.create({
    name: 'Telnyx Fwd',
    phone_number: '+17145551111',
    user_phone: '+17145552222',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+17145559999',
  });

  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'professional',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    trialEndsAt: trialEnds,
    paymentMethodStatus: 'valid',
  });

  const now = new Date();
  await forwardingTestSessionsRepository.createSession({
    shopId: shop.id,
    forwardingNumber: '+17145559999',
    startedAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  });

  const payload = {
    call_control_id: 'cc_test_1',
    call_session_id: 'cs_test_1',
    direction: 'incoming',
    to: '+17145559999',
    from: '+17145550000',
  };

  const result = await evaluateTelnyxCallControlInboundInitiated(payload, {
    shopsRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    forwardingTestSessionsRepository,
  });

  assert.equal(result.handled, true);
  if (!result.handled) throw new Error('expected handled');
  assert.equal(result.forwardingConnectivityTest, true);
  assert.equal(result.decision === 'answer' || result.decision === 'dry_run', true);

  const access = await shopAccessStatesRepository.findByShopId(shop.id);
  assert.ok(access?.forwardingSetupVerifiedAt);
  assert.equal(access?.forwardingSetupVerifiedVia, 'inbound_test_call');
});

test('expired pending session is not marked passed on inbound', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const forwardingTestSessionsRepository = new InMemoryForwardingTestSessionsRepository();

  const shop = await shopsRepository.create({
    name: 'Telnyx Expired',
    phone_number: '+17145551111',
    user_phone: '+17145552222',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(shop.id, {
    vertical: 'nail_salon',
    user_name: 'Owner',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    current_onboarding_step: 4,
    telnyx_number: '+17145559988',
  });

  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'professional',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    trialEndsAt: trialEnds,
    paymentMethodStatus: 'valid',
  });

  const started = new Date(Date.now() - 30 * 60 * 1000);
  const expires = new Date(Date.now() - 5 * 60 * 1000);
  await forwardingTestSessionsRepository.createSession({
    shopId: shop.id,
    forwardingNumber: '+17145559988',
    startedAt: started,
    expiresAt: expires,
  });

  const payload = {
    call_control_id: 'cc_exp',
    call_session_id: 'cs_exp',
    direction: 'incoming',
    to: '+17145559988',
    from: '+17145550000',
  };

  const result = await evaluateTelnyxCallControlInboundInitiated(payload, {
    shopsRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    forwardingTestSessionsRepository,
  });

  assert.equal(result.handled, true);
  if (!result.handled) throw new Error('expected handled');
  assert.ok(!('forwardingConnectivityTest' in result && result.forwardingConnectivityTest));
  assert.equal(result.decision, 'reject');

  const access = await shopAccessStatesRepository.findByShopId(shop.id);
  assert.ok(!access?.forwardingSetupVerifiedAt);
});

test('POST /user/go-live/enable is blocked without forwarding verification', async () => {
  const { app, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
  });
  const res = await app.request('/user/go-live/enable', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'forwarding_verification_required');
});

test('POST /user/go-live/enable succeeds after manual_confirmation', async () => {
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
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok?: boolean };
  assert.equal(body.ok, true);
});


test('enterprise without commercial approval cannot confirm forwarding setup', async () => {
  const { app, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
    plan: 'enterprise',
  });
  const res = await app.request('/user/go-live/confirm-forwarding-setup', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({ confirmForwardingReady: true }),
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'commercial_approval_required');
});

test('enterprise without commercial approval cannot enable live answering', async () => {
  const { app, shopAccessStatesRepository, shop, cookie } = await createFixture({
    paymentMethodStatus: 'valid',
    telnyxNumber: '+17145559999',
    plan: 'enterprise',
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    forwardingSetupVerifiedAt: new Date().toISOString(),
    forwardingSetupVerifiedVia: 'forwarding_test',
  });
  const res = await app.request('/user/go-live/enable', {
    method: 'POST',
    headers: userHeaders(cookie),
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'commercial_approval_required');
});
