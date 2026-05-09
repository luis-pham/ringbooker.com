import test, { beforeEach } from 'node:test';
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
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
  ADMIN_AUTH_EMAIL: 'billing-admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});

beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
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

test('active self-serve user can open Paddle-hosted manage billing without mutating billing state', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
    USER_AUTH_SHOP_ID: 'demo-shop',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const originalFetch = globalThis.fetch;
  const paddleRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    paddleRequests.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        data: {
          id: 'cpls_demo',
          customer_id: 'ctm_demo_paddle',
          urls: {
            general: { overview: 'https://customer-portal.paddle.com/session/general' },
            subscriptions: [
              {
                subscription_id: 'sub_demo_paddle',
                overview: 'https://customer-portal.paddle.com/session/subscription',
              },
            ],
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
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
        email: 'billing-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const billing = await app.request('/user/billing', { headers: { cookie } });
    const billingBody = (await billing.json()) as {
      billing: {
        manageBillingAvailable?: boolean;
        canViewInvoicesViaPortal?: boolean;
        canUpdatePaymentMethodViaPortal?: boolean;
        canCancelViaPortal?: boolean;
      };
    };
    assert.equal(billingBody.billing.manageBillingAvailable, true);
    assert.equal(billingBody.billing.canViewInvoicesViaPortal, true);
    assert.equal(billingBody.billing.canUpdatePaymentMethodViaPortal, true);
    assert.equal(billingBody.billing.canCancelViaPortal, true);

    const manage = await app.request('/user/billing/manage', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({}),
    });
    assert.equal(manage.status, 200);
    const manageBody = (await manage.json()) as Record<string, unknown>;
    assert.equal(manageBody.ok, true);
    assert.equal(manageBody.manageUrl, 'https://customer-portal.paddle.com/session/subscription');
    assert.equal('providerCustomerId' in manageBody, false);
    assert.equal('providerSubscriptionId' in manageBody, false);
    assert.equal(JSON.stringify(manageBody).includes(process.env.PADDLE_API_KEY ?? 'sk_test'), false);
    assert.equal(paddleRequests[0]?.url, 'https://sandbox-api.paddle.com/customers/ctm_demo_paddle/portal-sessions');
    assert.deepEqual(paddleRequests[0]?.body, { subscription_ids: ['sub_demo_paddle'] });

    const after = await billingSubscriptionsRepository.findCurrentByShopId('demo-shop');
    assert.equal(after?.status, 'active');
    assert.equal(after?.paymentMethodStatus, 'valid');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manage billing requires auth same-origin and rejects caller supplied provider ids or return URLs', async () => {
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

  const unauthenticated = await app.request('/user/billing/manage', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({}),
  });
  assert.equal(unauthenticated.status, 401);

  const login = await app.request('/auth/user/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'billing-user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);

  const missingOrigin = await app.request('/user/billing/manage', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(missingOrigin.status, 403);

  const attackerBody = await app.request('/user/billing/manage', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      provider_customer_id: 'ctm_attacker',
      provider_subscription_id: 'sub_attacker',
      returnUrl: 'https://evil.example/return',
    }),
  });
  assert.equal(attackerBody.status, 400);
  assert.deepEqual(await attackerBody.json(), { ok: false, error: 'invalid_payload' });
});

test('manage billing rejects enterprise missing provider ids and Paddle failures safely', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'manage-failure-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const enterpriseShop = await shopsRepository.create({
    name: 'Enterprise Billing Salon',
    phone_number: '+17145550101',
    user_phone: '+17145550102',
    timezone: 'America/Los_Angeles',
    plan: 'enterprise',
    active: true,
  });
  const missingIdsShop = await shopsRepository.create({
    name: 'Missing IDs Salon',
    phone_number: '+17145550103',
    user_phone: '+17145550104',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingSubscriptionsRepository.upsert({
    shopId: missingIdsShop.id,
    provider: 'paddle',
    providerCustomerId: null,
    providerSubscriptionId: null,
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } })) as typeof fetch;
  try {
    const buildAppForShop = (shopId: string) => {
      applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shopId });
      resetEnvCacheForTests();
      return createBackendApp({
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
    };

    const enterpriseApp = buildAppForShop(enterpriseShop.id);
    const enterpriseLogin = await enterpriseApp.request('/auth/user/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'manage-failure-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(enterpriseLogin.status, 200);
    const enterpriseCookie = enterpriseLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(enterpriseCookie);
    const enterpriseManage = await enterpriseApp.request('/user/billing/manage', {
      method: 'POST',
      headers: { cookie: enterpriseCookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    });
    assert.equal(enterpriseManage.status, 400);
    assert.equal((await enterpriseManage.json() as { error: string }).error, 'plan_not_self_serve');

    const missingIdsApp = buildAppForShop(missingIdsShop.id);
    const missingIdsLogin = await missingIdsApp.request('/auth/user/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'manage-failure-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(missingIdsLogin.status, 200);
    const missingIdsCookie = missingIdsLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(missingIdsCookie);
    const missingIdsManage = await missingIdsApp.request('/user/billing/manage', {
      method: 'POST',
      headers: { cookie: missingIdsCookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    });
    assert.equal(missingIdsManage.status, 409);
    assert.equal((await missingIdsManage.json() as { error: string }).error, 'missing_provider_customer_id');

    const paddleFailureApp = buildAppForShop('demo-shop');
    const paddleFailureLogin = await paddleFailureApp.request('/auth/user/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'manage-failure-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(paddleFailureLogin.status, 200);
    const paddleFailureCookie = paddleFailureLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(paddleFailureCookie);
    const paddleFailureManage = await paddleFailureApp.request('/user/billing/manage', {
      method: 'POST',
      headers: { cookie: paddleFailureCookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    });
    assert.equal(paddleFailureManage.status, 502);
    assert.deepEqual(await paddleFailureManage.json(), {
      ok: false,
      error: 'billing_management_failed',
      message: 'Billing management is not available right now. Please contact support or try again later.',
    });
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
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

  const reactivate = await app.request('/user/billing/reactivate', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({}),
  });
  assert.equal(reactivate.status, 503);
  assert.deepEqual(await reactivate.json(), {
    ok: false,
    error: 'billing_checkout_disabled',
    message: 'Billing checkout is not enabled for this environment yet.',
  });

  applyRequiredTestEnv({ BILLING_CHECKOUT_ENABLED: 'true' });
  resetEnvCacheForTests();
});

test('billing checkout rejects caller-provided return URLs and price ids', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-return-url-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Return URL Attack Salon',
    phone_number: '+17145558001',
    user_phone: '+17145558002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });

  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  let paddleRequestCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    paddleRequestCount += 1;
    return new Response('{}', { status: 500 });
  }) as typeof fetch;

  try {
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
        email: 'billing-return-url-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const checkout = await app.request('/user/billing/checkout', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        plan: 'starter',
        billing_interval: 'monthly',
        price_id: 'pri_attacker',
        successUrl: 'https://evil.example/success',
        cancelUrl: 'https://evil.example/cancel',
      }),
    });
    assert.equal(checkout.status, 400);
    assert.deepEqual(await checkout.json(), { ok: false, error: 'invalid_payload' });
    assert.equal(paddleRequestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});

test('billing checkout creates missing internal trial and opens Paddle sandbox checkout', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-new-trial-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Checkout Missing Trial Salon',
    phone_number: '+17145558888',
    user_phone: '+17145558889',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });

  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  const paddleRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    paddleRequests.push({
      url,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        data: {
          id: 'txn_sandbox_missing_trial',
          checkout: { url: 'https://sandbox-checkout.paddle.com/checkout/test' },
          customer_id: 'ctm_sandbox_missing_trial',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
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

    assert.equal(await billingSubscriptionsRepository.findCurrentByShopId(shop.id), null);

    const login = await app.request('/auth/user/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({
        email: 'billing-new-trial-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const checkout = await app.request('/user/billing/checkout', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        plan: 'starter',
        billing_interval: 'monthly',
      }),
    });

    assert.equal(checkout.status, 200);
    const body = (await checkout.json()) as { ok: boolean; checkoutUrl?: string };
    assert.equal(body.ok, true);
    assert.equal(body.checkoutUrl, 'https://sandbox-checkout.paddle.com/checkout/test');
    assert.equal(paddleRequests.length, 1);
    assert.equal(paddleRequests[0].url, 'https://sandbox-api.paddle.com/transactions');
    assert.deepEqual(paddleRequests[0].body.checkout, {
      url: 'http://localhost:3000/checkout/paddle',
    });
    assert.deepEqual((paddleRequests[0].body.items as Array<{ price_id: string; quantity: number }>)[0], {
      price_id: process.env.PADDLE_PRICE_STARTER_MONTHLY,
      quantity: 1,
    });
    assert.equal((await billingSubscriptionsRepository.findCurrentByShopId(shop.id))?.status, 'trialing');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});

test('billing checkout allows payment setup for incomplete subscriptions', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-incomplete-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Incomplete Billing Salon',
    phone_number: '+17145559990',
    user_phone: '+17145559991',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: null,
    providerCustomerId: null,
    providerPriceId: process.env.PADDLE_PRICE_STARTER_MONTHLY,
    providerProductId: null,
    plan: 'starter',
    status: 'incomplete',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'none',
  });

  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  let paddleRequestCount = 0;
  globalThis.fetch = (async () => {
    paddleRequestCount += 1;
    return new Response(
      JSON.stringify({
        data: {
          id: 'txn_sandbox_incomplete',
          checkout: { url: 'https://sandbox-checkout.paddle.com/checkout/incomplete' },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
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
        email: 'billing-incomplete-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const checkout = await app.request('/user/billing/checkout', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        billing_interval: 'monthly',
      }),
    });

    assert.equal(checkout.status, 200);
    const body = (await checkout.json()) as { ok: boolean; checkoutUrl?: string };
    assert.equal(body.ok, true);
    assert.equal(body.checkoutUrl, 'https://sandbox-checkout.paddle.com/checkout/incomplete');
    assert.equal(paddleRequestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});

test('billing checkout normalizes legacy unknown self-serve trial before Paddle checkout', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-legacy-unknown-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Legacy Unknown Trial Salon',
    phone_number: '+17145557770',
    user_phone: '+17145557771',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: false,
  });
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: null,
    providerCustomerId: null,
    providerPriceId: process.env.PADDLE_PRICE_STARTER_MONTHLY,
    providerProductId: null,
    plan: 'starter',
    status: 'unknown',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: now.toISOString(),
    currentPeriodEnd: trialEndsAt,
    trialStartedAt: now.toISOString(),
    trialEndsAt,
    paymentMethodStatus: 'unknown',
  });

  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  let paddleRequestCount = 0;
  globalThis.fetch = (async () => {
    paddleRequestCount += 1;
    return new Response(
      JSON.stringify({
        data: {
          id: 'txn_sandbox_legacy_unknown',
          checkout: { url: 'https://sandbox-checkout.paddle.com/checkout/legacy-unknown' },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
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
        email: 'billing-legacy-unknown-user@ringbooker.local',
        password: 'change_me_user_password',
      }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const checkout = await app.request('/user/billing/checkout', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ billing_interval: 'monthly' }),
    });

    assert.equal(checkout.status, 200);
    const body = (await checkout.json()) as { ok: boolean; checkoutUrl?: string };
    assert.equal(body.ok, true);
    assert.equal(body.checkoutUrl, 'https://sandbox-checkout.paddle.com/checkout/legacy-unknown');
    assert.equal(paddleRequestCount, 1);
    const normalized = await billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    assert.equal(normalized?.provider, 'internal');
    assert.equal(normalized?.status, 'trialing');
    assert.equal(normalized?.paymentMethodStatus, 'none');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});
