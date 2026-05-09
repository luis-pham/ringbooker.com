import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { PaddleBillingProvider } from '@/src/backend/adapters/paddle/billing-provider';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { resetEnvCacheForTests } from '@/src/backend/config/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
  ADMIN_AUTH_EMAIL: 'billing-admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});

test('user billing and admin billing endpoints return normalized billing state', async () => {
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    billingProvider: new PaddleBillingProvider({
      billingCustomersRepository,
      billingSubscriptionsRepository,
      shopAccessStatesRepository,
      shopsRepository,
    }),
  });

  const userLogin = await app.request('/auth/user/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'billing-user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(userLogin.status, 200);
  const userCookie = userLogin.headers.get('set-cookie')?.split(';')[0];
  assert.ok(userCookie);

  const userBilling = await app.request('/user/billing', {
    headers: { cookie: userCookie! },
  });
  assert.equal(userBilling.status, 200);
  const userBillingBody = (await userBilling.json()) as {
    ok: boolean;
    billing: { provider: string; subscription: { plan: string; status: string; amount: number } | null };
  };
  assert.equal(userBillingBody.ok, true);
  assert.equal(userBillingBody.billing.provider, 'paddle');
  assert.equal((userBillingBody.billing as { checkoutAvailable?: boolean }).checkoutAvailable, true);
  assert.equal(userBillingBody.billing.subscription?.plan, 'professional');
  assert.equal(userBillingBody.billing.subscription?.status, 'active');
  assert.equal(userBillingBody.billing.subscription?.amount, 149);

  const invalidCheckout = await app.request('/user/billing/checkout', {
    method: 'POST',
    headers: {
      cookie: userCookie!,
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      plan: 'invalid-plan',
      billing_interval: 'monthly',
    }),
  });
  assert.equal(invalidCheckout.status, 400);
  assert.deepEqual(await invalidCheckout.json(), { ok: false, error: 'invalid_payload' });

  const adminLogin = await app.request('/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'billing-admin@ringbooker.local',
      password: 'change_me_admin_password',
    }),
  });
  assert.equal(adminLogin.status, 200);
  const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0];
  assert.ok(adminCookie);

  const adminBilling = await app.request('/admin/billing', {
    headers: { cookie: adminCookie! },
  });
  assert.equal(adminBilling.status, 200);
  const adminBillingBody = (await adminBilling.json()) as {
    ok: boolean;
    metrics: { activeSubscriptions: number; mrr: number };
    subscriptions: Array<{ shopId: string; plan: string }>;
  };
  assert.equal(adminBillingBody.ok, true);
  assert.equal(adminBillingBody.metrics.activeSubscriptions >= 1, true);
  assert.equal(adminBillingBody.metrics.mrr >= 149, true);
  assert.equal(adminBillingBody.subscriptions.some((item) => item.shopId === 'demo-shop'), true);
});

test('billing checkout endpoint is hidden when BILLING_CHECKOUT_ENABLED is false', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'false',
    USER_AUTH_EMAIL: 'billing-disabled-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
    USER_AUTH_SHOP_ID: 'demo-shop',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    billingProvider: new PaddleBillingProvider({
      billingCustomersRepository,
      billingSubscriptionsRepository,
      shopAccessStatesRepository,
      shopsRepository,
    }),
  });

  const login = await app.request('/auth/user/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'billing-disabled-user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const billing = await app.request('/user/billing', { headers: { cookie } });
  const billingBody = (await billing.json()) as { billing: { checkoutAvailable: boolean; checkoutDisabledReason: string } };
  assert.equal(billingBody.billing.checkoutAvailable, false);
  assert.equal(billingBody.billing.checkoutDisabledReason, 'billing_checkout_disabled');

  const checkout = await app.request('/user/billing/checkout', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      plan: 'professional',
      billing_interval: 'monthly',
    }),
  });
  assert.equal(checkout.status, 503);
  assert.deepEqual(await checkout.json(), {
    ok: false,
    error: 'billing_checkout_disabled',
    message: 'Billing checkout is not enabled for this environment yet.',
  });

  applyRequiredTestEnv({ BILLING_CHECKOUT_ENABLED: 'true' });
  resetEnvCacheForTests();
});
