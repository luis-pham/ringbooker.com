import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopOverageChargesRepository } from '@/src/backend/adapters/memory/shop-overage-charges-repository';
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

function buildBillingTestApp(deps: {
  billingCustomersRepository: InMemoryBillingCustomersRepository;
  billingSubscriptionsRepository: InMemoryBillingSubscriptionsRepository;
  shopOverageChargesRepository?: InMemoryShopOverageChargesRepository;
  shopAccessStatesRepository: InMemoryShopAccessStatesRepository;
  shopsRepository: InMemoryShopsRepository;
  billingProvider?: PaddleBillingProvider;
}) {
  return createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    billingCustomersRepository: deps.billingCustomersRepository,
    billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
    shopOverageChargesRepository: deps.shopOverageChargesRepository,
    shopAccessStatesRepository: deps.shopAccessStatesRepository,
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: deps.shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    billingProvider:
      deps.billingProvider ??
      new PaddleBillingProvider({
        billingCustomersRepository: deps.billingCustomersRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopOverageChargesRepository: deps.shopOverageChargesRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        shopsRepository: deps.shopsRepository,
      }),
  });
}

async function loginBillingUser(app: ReturnType<typeof createBackendApp>, email = process.env.USER_AUTH_EMAIL ?? 'billing-user@ringbooker.local') {
  const login = await app.request('/auth/user/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email,
      password: 'change_me_user_password',
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

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

test('user billing overage charges endpoint returns current shop charges ordered by period', async () => {
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shopOverageChargesRepository = new InMemoryShopOverageChargesRepository();
  await shopOverageChargesRepository.create({
    shopId: 'demo-shop',
    billingSubscriptionId: 'bs_demo',
    periodStart: new Date('2026-03-01T00:00:00.000Z'),
    periodEnd: new Date('2026-04-01T00:00:00.000Z'),
    includedCallers: 300,
    capturedCallers: 302,
    overageCallers: 2,
    rateCents: 25,
    amountCents: 50,
    paddleSubscriptionId: 'sub_demo_paddle',
    status: 'charged',
    idempotencyKey: 'overage:demo-shop:2026-03-01T00:00:00.000Z',
  });
  await shopOverageChargesRepository.create({
    shopId: 'other-shop',
    periodStart: new Date('2026-04-01T00:00:00.000Z'),
    periodEnd: new Date('2026-05-01T00:00:00.000Z'),
    includedCallers: 100,
    capturedCallers: 200,
    overageCallers: 100,
    rateCents: 25,
    amountCents: 2500,
    status: 'charged',
    idempotencyKey: 'overage:other-shop:2026-04-01T00:00:00.000Z',
  });

  const app = buildBillingTestApp({
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    shopsRepository,
    shopOverageChargesRepository,
  });
  const cookie = await loginBillingUser(app);

  const response = await app.request('/user/billing/overage-charges', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    charges: Array<{ shopId?: string; overageCallers: number; amountCents: number; periodStart: string }>;
  };
  assert.equal(body.ok, true);
  assert.equal(body.charges.length, 1);
  assert.equal(body.charges[0]?.periodStart, '2026-03-01T00:00:00.000Z');
  assert.equal(body.charges[0]?.overageCallers, 2);
  assert.equal(body.charges[0]?.amountCents, 50);
  assert.equal(body.charges[0]?.shopId, undefined);
});

test('manage billing feature flag disables GET and POST without calling Paddle or mutating DB', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    BILLING_MANAGE_ENABLED: 'false',
    USER_AUTH_EMAIL: 'billing-manage-disabled-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
    USER_AUTH_SHOP_ID: 'demo-shop',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const before = await billingSubscriptionsRepository.findCurrentByShopId('demo-shop');
  let paddleCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    paddleCalled = true;
    return new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  try {
    const app = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository });
    const cookie = await loginBillingUser(app, 'billing-manage-disabled-user@ringbooker.local');

    const billing = await app.request('/user/billing', { headers: { cookie } });
    assert.equal(billing.status, 200);
    const billingBody = (await billing.json()) as {
      billing: { checkoutAvailable?: boolean; manageBillingAvailable?: boolean; manageBillingDisabledReason?: string | null };
    };
    assert.equal(billingBody.billing.checkoutAvailable, true);
    assert.equal(billingBody.billing.manageBillingAvailable, false);
    assert.equal(billingBody.billing.manageBillingDisabledReason, 'billing_manage_disabled');

    const manage = await app.request('/user/billing/manage', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    });
    assert.equal(manage.status, 503);
    assert.deepEqual(await manage.json(), {
      ok: false,
      error: 'billing_manage_disabled',
      message: 'Billing management is temporarily unavailable. Contact support if you need help updating payment details or managing your subscription.',
    });
    assert.equal(paddleCalled, false);
    const after = await billingSubscriptionsRepository.findCurrentByShopId('demo-shop');
    assert.deepEqual(after, before);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      BILLING_MANAGE_ENABLED: 'true',
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});

test('trialing self-serve user can open Paddle-hosted manage billing when flag is enabled', async () => {
  applyRequiredTestEnv({
    BILLING_MANAGE_ENABLED: 'true',
    USER_AUTH_EMAIL: 'billing-manage-trialing-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Trialing Manage Billing Salon',
    phone_number: '+17145551280',
    user_phone: '+17145551281',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_trialing_manage',
    email: 'billing-manage-trialing-user@ringbooker.local',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_trialing_manage',
    providerCustomerId: 'ctm_trialing_manage',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    data: {
      id: 'cpls_trialing_manage',
      customer_id: 'ctm_trialing_manage',
      urls: { subscriptions: [{ subscription_id: 'sub_trialing_manage', overview: 'https://customer-portal.paddle.com/session/trialing' }] },
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

  try {
    const app = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository });
    const cookie = await loginBillingUser(app, 'billing-manage-trialing-user@ringbooker.local');
    const manage = await app.request('/user/billing/manage', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({}),
    });
    assert.equal(manage.status, 200);
    const body = (await manage.json()) as { manageUrl?: string };
    assert.equal(body.manageUrl, 'https://customer-portal.paddle.com/session/trialing');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ USER_AUTH_EMAIL: 'billing-user@ringbooker.local', USER_AUTH_SHOP_ID: 'demo-shop' });
    resetEnvCacheForTests();
  }
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

test('Starter active user can request Professional upgrade without local plan mutation', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-upgrade-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
    PADDLE_PRICE_PROFESSIONAL_MONTHLY: 'pri_test_professional_monthly_upgrade_api',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Upgrade Starter Salon',
    phone_number: '+17145551230',
    user_phone: '+17145551231',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_upgrade_api',
    email: 'billing-upgrade-user@ringbooker.local',
  });
  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_upgrade_api',
    providerCustomerId: 'ctm_upgrade_api',
    providerPriceId: process.env.PADDLE_PRICE_STARTER_MONTHLY,
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
  });
  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  const paddleRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    paddleRequests.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ data: { id: 'sub_upgrade_api', customer_id: 'ctm_upgrade_api' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const app = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository });
    const cookie = await loginBillingUser(app, 'billing-upgrade-user@ringbooker.local');

    const upgrade = await app.request('/user/billing/upgrade', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ target_plan: 'professional', billing_interval: 'monthly' }),
    });
    assert.equal(upgrade.status, 200);
    assert.deepEqual(await upgrade.json(), {
      ok: true,
      status: 'pending',
      message: 'Your upgrade is being processed. Professional features will unlock after billing is confirmed.',
    });
    assert.equal(paddleRequests[0]?.url, 'https://sandbox-api.paddle.com/subscriptions/sub_upgrade_api');
    assert.deepEqual(paddleRequests[0]?.body, {
      items: [{ price_id: 'pri_test_professional_monthly_upgrade_api', quantity: 1 }],
      proration_billing_mode: 'prorated_next_billing_period',
      on_payment_failure: 'prevent_change',
    });

    const afterSubscription = await billingSubscriptionsRepository.findById(subscription.id);
    const afterShop = await shopsRepository.findById(shop.id);
    assert.equal(afterSubscription?.plan, 'starter');
    assert.equal(afterShop?.plan, 'starter');
    assert.equal((afterSubscription?.metadata?.pending_plan_upgrade as { targetPlan?: string } | undefined)?.targetPlan, 'professional');

    const settings = await app.request('/user/settings', { headers: { cookie } });
    const settingsBody = (await settings.json()) as { capabilities: { edit_transfer_settings: boolean; edit_reminder_sms: boolean } };
    assert.equal(settingsBody.capabilities.edit_transfer_settings, false);
    assert.equal(settingsBody.capabilities.edit_reminder_sms, false);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});

test('billing upgrade rejects unauthenticated CSRF invalid payload non-Starter and billing issue states', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    USER_AUTH_EMAIL: 'billing-upgrade-reject-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const starterShop = await shopsRepository.create({
    name: 'Reject Starter Salon',
    phone_number: '+17145551240',
    user_phone: '+17145551241',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingSubscriptionsRepository.upsert({
    shopId: starterShop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_upgrade_reject',
    providerCustomerId: 'ctm_upgrade_reject',
    plan: 'starter',
    status: 'past_due',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'failed',
  });
  const enterpriseShop = await shopsRepository.create({
    name: 'Reject Enterprise Salon',
    phone_number: '+17145551242',
    user_phone: '+17145551243',
    timezone: 'America/Los_Angeles',
    plan: 'enterprise',
    active: true,
  });
  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: starterShop.id });
  resetEnvCacheForTests();

  const app = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository });
  const unauthenticated = await app.request('/user/billing/upgrade', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ target_plan: 'professional' }),
  });
  assert.equal(unauthenticated.status, 401);

  const cookie = await loginBillingUser(app, 'billing-upgrade-reject-user@ringbooker.local');
  const missingOrigin = await app.request('/user/billing/upgrade', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ target_plan: 'professional' }),
  });
  assert.equal(missingOrigin.status, 403);

  const invalidPayload = await app.request('/user/billing/upgrade', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      target_plan: 'enterprise',
      price_id: 'pri_attacker',
      provider_subscription_id: 'sub_attacker',
      returnUrl: 'https://evil.example',
    }),
  });
  assert.equal(invalidPayload.status, 400);

  const pastDue = await app.request('/user/billing/upgrade', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ target_plan: 'professional' }),
  });
  assert.equal(pastDue.status, 409);
  assert.equal((await pastDue.json() as { error: string }).error, 'subscription_not_upgradeable');

  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: enterpriseShop.id });
  resetEnvCacheForTests();
  const enterpriseApp = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository });
  const enterpriseCookie = await loginBillingUser(enterpriseApp, 'billing-upgrade-reject-user@ringbooker.local');
  const enterpriseUpgrade = await enterpriseApp.request('/user/billing/upgrade', {
    method: 'POST',
    headers: { cookie: enterpriseCookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({ target_plan: 'professional' }),
  });
  assert.equal(enterpriseUpgrade.status, 409);
  assert.equal((await enterpriseUpgrade.json() as { error: string }).error, 'current_plan_not_starter');

  applyRequiredTestEnv({
    USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
    USER_AUTH_SHOP_ID: 'demo-shop',
  });
  resetEnvCacheForTests();
});

test('Paddle upgrade failure does not mutate local plan or pending metadata', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-upgrade-fail-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Upgrade Failure Salon',
    phone_number: '+17145551250',
    user_phone: '+17145551251',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_upgrade_failure',
    providerCustomerId: 'ctm_upgrade_failure',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_upgrade_failure',
    email: 'billing-upgrade-fail-user@ringbooker.local',
  });
  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: 'failed' } }), { status: 500 })) as typeof fetch;
  try {
    const app = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository });
    const cookie = await loginBillingUser(app, 'billing-upgrade-fail-user@ringbooker.local');
    const upgrade = await app.request('/user/billing/upgrade', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify({ target_plan: 'professional' }),
    });
    assert.equal(upgrade.status, 502);
    const afterSubscription = await billingSubscriptionsRepository.findById(subscription.id);
    const afterShop = await shopsRepository.findById(shop.id);
    assert.equal(afterSubscription?.plan, 'starter');
    assert.equal(afterShop?.plan, 'starter');
    assert.equal(afterSubscription?.metadata?.pending_plan_upgrade, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({
      USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
      USER_AUTH_SHOP_ID: 'demo-shop',
    });
    resetEnvCacheForTests();
  }
});

test('subscription.updated Professional price confirms upgrade and unlocks Professional settings gates', async () => {
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Webhook Upgrade Salon',
    phone_number: '+17145551260',
    user_phone: '+17145551261',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_webhook_upgrade',
    email: 'billing-webhook-upgrade-user@ringbooker.local',
  });
  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_webhook_upgrade',
    providerCustomerId: 'ctm_webhook_upgrade',
    providerPriceId: process.env.PADDLE_PRICE_STARTER_MONTHLY,
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
    metadata: {
      pending_plan_upgrade: {
        targetPlan: 'professional',
        billingInterval: 'year',
        requestedAt: '2026-05-09T00:00:00Z',
      },
    },
  });
  const provider = new PaddleBillingProvider({
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    shopsRepository,
  });

  const result = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_webhook_upgrade',
      status: 'active',
      customer_id: 'ctm_webhook_upgrade',
      custom_data: { shop_id: shop.id },
      payment_method_id: 'pm_webhook_upgrade',
      items: [{ price: { id: process.env.PADDLE_PRICE_PROFESSIONAL_ANNUAL } }],
      recurring_transaction_details: { interval: 'year' },
      unit_totals: { total: '149000' },
      occurred_at: '2026-05-09T01:00:00Z',
    },
  });
  assert.equal(result?.subscription?.plan, 'professional');
  assert.equal(result?.subscription?.interval, 'year');
  assert.equal(result?.subscription?.providerPriceId, process.env.PADDLE_PRICE_PROFESSIONAL_ANNUAL);

  const afterShop = await shopsRepository.findById(shop.id);
  const afterSubscription = await billingSubscriptionsRepository.findById(subscription.id);
  assert.equal(afterShop?.plan, 'professional');
  assert.equal(afterSubscription?.plan, 'professional');

  applyRequiredTestEnv({
    USER_AUTH_EMAIL: 'billing-webhook-upgrade-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
    USER_AUTH_SHOP_ID: shop.id,
  });
  resetEnvCacheForTests();
  const app = buildBillingTestApp({ billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository, shopsRepository, billingProvider: provider });
  const cookie = await loginBillingUser(app, 'billing-webhook-upgrade-user@ringbooker.local');
  const settings = await app.request('/user/settings', { headers: { cookie } });
  const settingsBody = (await settings.json()) as { capabilities: { edit_transfer_settings: boolean; edit_reminder_sms: boolean; edit_review_request_sms: boolean } };
  assert.equal(settingsBody.capabilities.edit_transfer_settings, true);
  assert.equal(settingsBody.capabilities.edit_reminder_sms, true);
  assert.equal(settingsBody.capabilities.edit_review_request_sms, true);

  applyRequiredTestEnv({
    USER_AUTH_EMAIL: 'billing-user@ringbooker.local',
    USER_AUTH_SHOP_ID: 'demo-shop',
  });
  resetEnvCacheForTests();
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

test('billing checkout blocks duplicate checkout when Paddle billing already exists', async () => {
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
  let paddleRequestCount = 0;
  globalThis.fetch = (async () => {
    paddleRequestCount += 1;
    return new Response(JSON.stringify({ data: { checkout: { url: 'https://should-not-open.example' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
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

    const checkout = await app.request('/user/billing/checkout', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ billing_interval: 'monthly' }),
    });

    assert.equal(checkout.status, 409);
    const body = (await checkout.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, 'billing_already_started');
    assert.equal(paddleRequestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('billing checkout blocks duplicate checkout while Paddle webhook is pending', async () => {
  applyRequiredTestEnv({
    BILLING_CHECKOUT_ENABLED: 'true',
    PADDLE_ENV: 'sandbox',
    USER_AUTH_EMAIL: 'billing-pending-paddle-user@ringbooker.local',
    USER_AUTH_PASSWORD: 'change_me_user_password',
  });
  resetEnvCacheForTests();

  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Pending Paddle Salon',
    phone_number: '+17145556660',
    user_phone: '+17145556661',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_pending_webhook',
    email: 'billing-pending-paddle-user@ringbooker.local',
  });
  applyRequiredTestEnv({ USER_AUTH_SHOP_ID: shop.id });
  resetEnvCacheForTests();

  const originalFetch = globalThis.fetch;
  let paddleRequestCount = 0;
  globalThis.fetch = (async () => {
    paddleRequestCount += 1;
    return new Response(JSON.stringify({ data: { checkout: { url: 'https://should-not-open.example' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
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
        email: 'billing-pending-paddle-user@ringbooker.local',
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

    assert.equal(checkout.status, 409);
    const body = (await checkout.json()) as { ok: boolean; error: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, 'payment_setup_pending');
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

test('user billing transactions endpoint requires auth', async () => {
  const app = buildBillingTestApp({
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    shopsRepository: new InMemoryShopsRepository(),
  });

  const response = await app.request('/user/billing/transactions');
  assert.equal(response.status, 401);
});

test('user billing transactions endpoint returns sanitized Paddle transactions', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'sandbox' });
  resetEnvCacheForTests();
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const app = buildBillingTestApp({
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    shopsRepository,
  });
  const cookie = await loginBillingUser(app);

  let paddleUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    paddleUrl = String(input);
    assert.equal(String((init?.headers as Record<string, string> | undefined)?.Authorization), `Bearer ${process.env.PADDLE_API_KEY}`);
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 'txn_api_history_1',
            status: 'completed',
            billed_at: '2026-05-24T00:00:00Z',
            currency_code: 'USD',
            invoice_number: 'INV-2001',
            details: { totals: { total: '14900' } },
            invoice_url: 'https://paddle.example/invoices/INV-2001',
            customer: { email: 'private@example.com' },
            provider_customer_id: 'ctm_demo_paddle',
            payment_method: { card: { last4: '4242' } },
          },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const response = await app.request('/user/billing/transactions', { headers: { cookie } });
    assert.equal(response.status, 200);
    const bodyText = await response.text();
    assert.equal(bodyText.includes(process.env.PADDLE_API_KEY ?? 'paddle_test_key'), false);
    assert.equal(bodyText.includes(process.env.PADDLE_WEBHOOK_SECRET ?? 'paddle_test_secret'), false);
    assert.equal(bodyText.includes('private@example.com'), false);
    assert.equal(bodyText.includes('4242'), false);
    assert.equal(bodyText.includes('provider_customer_id'), false);
    const body = JSON.parse(bodyText) as {
      ok: boolean;
      available: boolean;
      transactions: Array<{ id: string; amount: number; currency: string; invoiceNumber?: string; invoiceUrl?: string }>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.available, true);
    assert.equal(body.transactions[0]?.id, 'txn_api_history_1');
    assert.equal(body.transactions[0]?.amount, 149);
    assert.equal(body.transactions[0]?.currency, 'USD');
    assert.equal(body.transactions[0]?.invoiceNumber, 'INV-2001');
    assert.equal(body.transactions[0]?.invoiceUrl, 'https://paddle.example/invoices/INV-2001');
    assert.equal(paddleUrl, 'https://sandbox-api.paddle.com/transactions?customer_id=ctm_demo_paddle&subscription_id=sub_demo_paddle&per_page=20');
  } finally {
    globalThis.fetch = originalFetch;
    resetEnvCacheForTests();
  }
});

test('user billing transactions endpoint fails gracefully for missing customer and Paddle failures', async () => {
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  await billingSubscriptionsRepository.updateById('bs_demo', { providerCustomerId: null });
  const app = buildBillingTestApp({
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    shopsRepository,
  });
  const cookie = await loginBillingUser(app);

  const missingCustomer = await app.request('/user/billing/transactions', { headers: { cookie } });
  assert.equal(missingCustomer.status, 200);
  assert.deepEqual(await missingCustomer.json(), {
    ok: true,
    available: false,
    reason: 'missing_provider_customer_id',
    transactions: [],
    message: 'Payments and invoices will appear after your first billing event.',
  });

  await billingSubscriptionsRepository.updateById('bs_demo', { providerCustomerId: 'ctm_demo_paddle' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { code: 'failed' } }), { status: 500 })) as typeof fetch;
  try {
    const failed = await app.request('/user/billing/transactions', { headers: { cookie } });
    assert.equal(failed.status, 200);
    const body = (await failed.json()) as { ok: boolean; available: boolean; reason: string; transactions: unknown[]; message: string };
    assert.equal(body.ok, true);
    assert.equal(body.available, false);
    assert.equal(body.reason, 'paddle_transactions_unavailable');
    assert.deepEqual(body.transactions, []);
    assert.match(body.message, /Manage billing/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('user billing transactions endpoint rejects Paddle ownership conflicts', async () => {
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const otherShop = await shopsRepository.create({
    name: 'Other Shop',
    phone_number: '+17145550200',
    user_phone: '+17145550201',
    timezone: 'America/Los_Angeles',
  });
  await billingCustomersRepository.upsert({
    shopId: otherShop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_other_shop',
  });
  await billingSubscriptionsRepository.updateById('bs_demo', { providerCustomerId: 'ctm_other_shop' });
  const app = buildBillingTestApp({
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    shopsRepository,
  });
  const cookie = await loginBillingUser(app);

  const response = await app.request('/user/billing/transactions', { headers: { cookie } });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ok: false, error: 'billing_ownership_conflict' });
});
