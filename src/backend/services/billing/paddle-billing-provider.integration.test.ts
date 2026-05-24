import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryShopOverageChargesRepository } from '@/src/backend/adapters/memory/shop-overage-charges-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { PaddleBillingProvider } from '@/src/backend/adapters/paddle/billing-provider';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';

applyRequiredTestEnv();

function buildProvider() {
  const shopsRepository = new InMemoryShopsRepository();
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  });
  return { provider, shopsRepository, billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository };
}

test('paddle checkout uses sandbox API, annual price mapping, and hosted checkout page URL', async () => {
  applyRequiredTestEnv({
    PADDLE_ENV: 'sandbox',
    PADDLE_ENVIRONMENT: 'production',
    PADDLE_PRICE_PROFESSIONAL_ANNUAL: 'pri_test_professional_annual_custom',
  });
  resetEnvCacheForTests();
  const { provider, shopsRepository } = buildProvider();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  const calls: Array<{
    url: string;
    body: { items?: Array<{ price_id?: string }>; checkout?: { url?: string }; custom_data?: Record<string, unknown> };
  }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as { items?: Array<{ price_id?: string }> },
    });
    return new Response(
      JSON.stringify({
        data: {
          id: 'txn_test_annual',
          checkout: { url: 'https://sandbox-checkout.paddle.com/txn_test_annual' },
          customer_id: 'ctm_test_annual',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const session = await provider.createCheckoutSession({
      shop,
      plan: 'professional',
      email: 'billing-user@ringbooker.local',
      billingInterval: 'year',
      checkoutUrl: 'https://ringbooker.test/checkout/paddle',
      successUrl: 'https://ringbooker.test/user/billing?checkout=success',
      cancelUrl: 'https://ringbooker.test/user/billing?checkout=cancelled',
    });
    assert.equal(session.checkoutUrl, 'https://sandbox-checkout.paddle.com/txn_test_annual');
    assert.equal(calls[0]?.url, 'https://sandbox-api.paddle.com/transactions');
    assert.equal(calls[0]?.body.items?.[0]?.price_id, 'pri_test_professional_annual_custom');
    assert.equal(calls[0]?.body.checkout?.url, 'https://ringbooker.test/checkout/paddle');
    assert.equal(calls[0]?.body.custom_data?.success_url, 'https://ringbooker.test/user/billing?checkout=success');
    assert.equal(calls[0]?.body.custom_data?.cancel_url, 'https://ringbooker.test/user/billing?checkout=cancelled');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle checkout uses production API when PADDLE_ENV=production', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'production', PADDLE_ENVIRONMENT: 'sandbox' });
  resetEnvCacheForTests();
  const { provider, shopsRepository } = buildProvider();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  let url = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    url = String(input);
    return new Response(JSON.stringify({ data: { id: 'txn_prod', checkout: { url: 'https://checkout.paddle.com/txn_prod' } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await provider.createCheckoutSession({
      shop,
      plan: 'starter',
      email: 'billing-user@ringbooker.local',
      billingInterval: 'month',
      checkoutUrl: 'https://ringbooker.test/checkout/paddle',
      successUrl: 'https://ringbooker.test/user/billing?checkout=success',
      cancelUrl: 'https://ringbooker.test/user/billing?checkout=cancelled',
    });
    assert.equal(url, 'https://api.paddle.com/transactions');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle manage billing creates sandbox customer portal session with subscription id', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'production' });
  resetEnvCacheForTests();
  const { provider, shopsRepository } = buildProvider();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  const calls: Array<{ url: string; body: { subscription_ids?: string[] } }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as { subscription_ids?: string[] },
    });
    return new Response(
      JSON.stringify({
        data: {
          id: 'cpls_test',
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
    const session = await provider.createManageBillingSession({
      shop,
      providerCustomerId: 'ctm_demo_paddle',
      providerSubscriptionId: 'sub_demo_paddle',
    });
    assert.equal(calls[0]?.url, 'https://sandbox-api.paddle.com/customers/ctm_demo_paddle/portal-sessions');
    assert.deepEqual(calls[0]?.body, { subscription_ids: ['sub_demo_paddle'] });
    assert.equal(session.manageUrl, 'https://customer-portal.paddle.com/session/subscription');
    assert.equal(session.providerPortalSessionId, 'cpls_test');
    assert.equal(session.canViewInvoicesViaPortal, true);
    assert.equal(session.canUpdatePaymentMethodViaPortal, true);
    assert.equal(session.canCancelViaPortal, true);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle chargeOverage calls subscription charge endpoint with amount and description', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'sandbox' });
  resetEnvCacheForTests();
  const { provider } = buildProvider();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : {},
    });
    return new Response(JSON.stringify({ data: { id: 'txn_overage_paddle' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await provider.chargeOverage({
      providerSubscriptionId: 'sub_demo_paddle',
      amountCents: 1250,
      description: 'Captured caller overage - 50 callers x $0.25',
    });

    assert.equal(result.providerTransactionId, 'txn_overage_paddle');
    assert.equal(calls[0]?.url, 'https://sandbox-api.paddle.com/subscriptions/sub_demo_paddle/charge');
    assert.deepEqual(calls[0]?.body, {
      effective_from: 'immediately',
      items: [
        {
          price: {
            description: 'Captured caller overage - 50 callers x $0.25',
            unit_price: {
              amount: '1250',
              currency_code: 'USD',
            },
          },
          quantity: 1,
        },
      ],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('paddle manage billing uses production API and maps Paddle failures safely', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'production', PADDLE_ENVIRONMENT: 'sandbox' });
  resetEnvCacheForTests();
  const { provider, shopsRepository } = buildProvider();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  let url = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    url = String(input);
    return new Response(JSON.stringify({ error: { code: 'nope' } }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        provider.createManageBillingSession({
          shop,
          providerCustomerId: 'ctm_demo_paddle',
          providerSubscriptionId: 'sub_demo_paddle',
        }),
      /paddle_create_portal_session_failed:500/,
    );
    assert.equal(url, 'https://api.paddle.com/customers/ctm_demo_paddle/portal-sessions');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle list billing transactions uses sandbox API and sanitizes transaction records', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'production' });
  resetEnvCacheForTests();
  const { provider } = buildProvider();

  let requestUrl = '';
  let authHeader = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requestUrl = String(input);
    authHeader = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '');
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 'txn_history_1',
            status: 'completed',
            customer_id: 'ctm_demo_paddle',
            subscription_id: 'sub_demo_paddle',
            invoice_number: 'INV-1001',
            billed_at: '2026-05-24T00:00:00Z',
            currency_code: 'USD',
            details: { totals: { total: '14900' } },
            invoice_pdf: 'https://paddle.example/invoice.pdf',
            payments: [{ receipt_url: 'https://paddle.example/receipt' }],
            customer: { email: 'customer@example.com' },
            raw_secret_like_field: 'do-not-return',
          },
        ],
        meta: { pagination: { has_more: false, next: null } },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const result = await provider.listBillingTransactions({
      providerCustomerId: 'ctm_demo_paddle',
      providerSubscriptionId: 'sub_demo_paddle',
      limit: 20,
    });
    assert.equal(requestUrl, 'https://sandbox-api.paddle.com/transactions?customer_id=ctm_demo_paddle&subscription_id=sub_demo_paddle&per_page=20');
    assert.equal(authHeader, `Bearer ${process.env.PADDLE_API_KEY}`);
    assert.deepEqual(result.transactions, [
      {
        id: 'txn_history_1',
        date: '2026-05-24T00:00:00Z',
        description: 'Invoice INV-1001',
        amount: 149,
        currency: 'USD',
        status: 'completed',
        type: 'invoice',
        billingPeriodStart: undefined,
        billingPeriodEnd: undefined,
        invoiceNumber: 'INV-1001',
        invoiceUrl: 'https://paddle.example/invoice.pdf',
        receiptUrl: 'https://paddle.example/receipt',
      },
    ]);
    assert.equal(JSON.stringify(result).includes('customer@example.com'), false);
    assert.equal(JSON.stringify(result).includes('do-not-return'), false);
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle list billing transactions uses production API and maps failures safely', async () => {
  applyRequiredTestEnv({ PADDLE_ENV: 'production', PADDLE_ENVIRONMENT: 'sandbox' });
  resetEnvCacheForTests();
  const { provider } = buildProvider();

  let url = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    url = String(input);
    return new Response(JSON.stringify({ error: { code: 'failed' } }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => provider.listBillingTransactions({ providerCustomerId: 'ctm_demo_paddle', limit: 20 }),
      /paddle_list_transactions_failed:500/,
    );
    assert.equal(url, 'https://api.paddle.com/transactions?customer_id=ctm_demo_paddle&per_page=20');
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle upgrade subscription uses sandbox API, Professional price, and next-period proration', async () => {
  applyRequiredTestEnv({
    PADDLE_ENV: 'sandbox',
    PADDLE_ENVIRONMENT: 'production',
    PADDLE_PRICE_PROFESSIONAL_MONTHLY: 'pri_test_professional_monthly_upgrade',
  });
  resetEnvCacheForTests();
  const { provider, shopsRepository } = buildProvider();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(
      JSON.stringify({
        data: {
          id: 'sub_demo_paddle',
          customer_id: 'ctm_demo_paddle',
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const result = await provider.upgradeSubscriptionPlan({
      shop,
      providerCustomerId: 'ctm_demo_paddle',
      providerSubscriptionId: 'sub_demo_paddle',
      targetPlan: 'professional',
      billingInterval: 'month',
      prorationBillingMode: 'prorated_next_billing_period',
    });
    assert.equal(result.providerSubscriptionId, 'sub_demo_paddle');
    assert.equal(calls[0]?.url, 'https://sandbox-api.paddle.com/subscriptions/sub_demo_paddle');
    assert.deepEqual(calls[0]?.body, {
      items: [{ price_id: 'pri_test_professional_monthly_upgrade', quantity: 1 }],
      proration_billing_mode: 'prorated_next_billing_period',
      on_payment_failure: 'prevent_change',
    });
  } finally {
    globalThis.fetch = originalFetch;
    applyRequiredTestEnv({ PADDLE_ENV: 'sandbox', PADDLE_ENVIRONMENT: 'sandbox' });
    resetEnvCacheForTests();
  }
});

test('paddle billing provider syncs webhook payload into normalized billing records', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
  });

  const result = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_live_123',
      status: 'active',
      currency_code: 'USD',
      custom_data: {
        shop_id: 'demo-shop',
      },
      customer_id: 'ctm_live_123',
      customer: {
        id: 'ctm_live_123',
        email: 'billing-user@ringbooker.local',
      },
      items: [
        {
          price: {
            id: process.env.PADDLE_PRICE_PROFESSIONAL_MONTHLY,
          },
        },
      ],
      recurring_transaction_details: {
        interval: 'month',
      },
      current_billing_period: {
        starts_at: '2026-04-01T00:00:00Z',
        ends_at: '2026-05-01T00:00:00Z',
      },
      unit_totals: {
        total: '14900',
      },
    },
  });

  assert.ok(result);
  assert.equal(result?.provider, 'paddle');
  assert.equal(result?.shopId, 'demo-shop');
  assert.equal(result?.subscription?.providerSubscriptionId, 'sub_live_123');
  assert.equal(result?.subscription?.plan, 'professional');
  assert.equal(result?.subscription?.status, 'active');
  assert.equal(result?.subscription?.amount, 149);

  const customer = await billingCustomersRepository.findByProviderCustomerId('paddle', 'ctm_live_123');
  assert.ok(customer);
  assert.equal(customer?.email, 'billing-user@ringbooker.local');

  const subscription = await billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', 'sub_live_123');
  assert.ok(subscription);
  assert.equal(subscription?.currency, 'USD');
  assert.equal(subscription?.paymentMethodStatus, 'unknown');

  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);
  assert.equal(shop?.plan, 'professional');
  assert.equal(shop?.active, true);
});

test('paddle subscription.updated renewal processes overage for previous billing period', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const shopOverageChargesRepository = new InMemoryShopOverageChargesRepository();
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    shopOverageChargesRepository,
  });
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);
  await billingSubscriptionsRepository.updateById('bs_demo', {
    plan: 'professional',
    status: 'active',
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
    providerSubscriptionId: 'sub_demo_paddle',
    paymentMethodStatus: 'valid',
  });
  for (let i = 0; i < 302; i += 1) {
    const requestId = `renewal-overage-req-${i}`;
    await callLogsRepository.createOrUpdateInboundCall({
      provider: 'telnyx_call_control',
      providerCallId: `renewal-overage-call-${i}`,
      shopId: shop.id,
      callerPhone: '+15550000002',
      startedAt: new Date('2026-03-20T12:00:00.000Z'),
      requestId,
    });
    await callLogsRepository.updateStructuredSummary(shop.id, requestId, { summaryServiceRequest: 'gel manicure' });
  }
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : {} });
    return new Response(JSON.stringify({ data: { id: 'txn_renewal_overage' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await provider.syncWebhookEvent({
      eventType: 'subscription.updated',
      payload: {
        id: 'sub_demo_paddle',
        status: 'active',
        currency_code: 'USD',
        custom_data: { shop_id: shop.id },
        customer_id: 'ctm_demo_paddle',
        items: [{ price: { id: process.env.PADDLE_PRICE_PROFESSIONAL_MONTHLY } }],
        recurring_transaction_details: { interval: 'month' },
        current_billing_period: {
          starts_at: '2026-04-15T00:00:00.000Z',
          ends_at: '2026-05-15T00:00:00.000Z',
        },
        unit_totals: { total: '14900' },
        occurred_at: '2026-04-15T00:00:01.000Z',
      },
    });

    assert.equal(result?.subscription?.currentPeriodStart, '2026-04-15T00:00:00.000Z');
    const overages = await shopOverageChargesRepository.listByShopId(shop.id);
    assert.equal(overages.length, 1);
    assert.equal(overages[0]?.status, 'charged');
    assert.equal(overages[0]?.periodStart, '2026-03-15T00:00:00.000Z');
    assert.equal(overages[0]?.periodEnd, '2026-04-15T00:00:00.000Z');
    assert.equal(overages[0]?.overageCallers, 2);
    assert.equal(overages[0]?.amountCents, 50);
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('paddle subscription.updated without period change does not process overage', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const shopOverageChargesRepository = new InMemoryShopOverageChargesRepository();
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    shopOverageChargesRepository,
  });
  const originalFetch = globalThis.fetch;
  let paddleCalled = false;
  globalThis.fetch = (async () => {
    paddleCalled = true;
    return new Response(JSON.stringify({ data: { id: 'txn_should_not_exist' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await provider.syncWebhookEvent({
      eventType: 'subscription.updated',
      payload: {
        id: 'sub_demo_paddle',
        status: 'active',
        currency_code: 'USD',
        custom_data: { shop_id: 'demo-shop' },
        customer_id: 'ctm_demo_paddle',
        items: [{ price: { id: process.env.PADDLE_PRICE_PROFESSIONAL_MONTHLY } }],
        recurring_transaction_details: { interval: 'month' },
        current_billing_period: {
          starts_at: '2026-04-01T00:00:00.000Z',
          ends_at: '2026-05-01T00:00:00.000Z',
        },
        unit_totals: { total: '14900' },
        occurred_at: '2026-04-01T00:00:01.000Z',
      },
    });

    assert.equal((await shopOverageChargesRepository.listByShopId('demo-shop')).length, 0);
    assert.equal(paddleCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('paddle webhook customer upsert merges repeated customer events for the same shop provider', async () => {
  const { provider, billingCustomersRepository, billingSubscriptionsRepository } = buildProvider();
  await billingCustomersRepository.upsert({
    shopId: 'demo-shop',
    provider: 'paddle',
    providerCustomerId: null,
    email: 'placeholder@ringbooker.local',
  });

  const basePayload = {
    customer_id: 'ctm_multi_event_retry',
    custom_data: { shop_id: 'demo-shop' },
    items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
    unit_totals: { total: '7900' },
  };
  const updated = await provider.syncWebhookEvent({
    eventType: 'transaction.updated',
    payload: {
      ...basePayload,
      id: 'txn_multi_event_retry_1',
      subscription_id: 'sub_multi_event_retry',
      occurred_at: '2026-05-09T18:00:00Z',
    },
  });
  const created = await provider.syncWebhookEvent({
    eventType: 'subscription.created',
    payload: {
      ...basePayload,
      id: 'sub_multi_event_retry',
      status: 'trialing',
      occurred_at: '2026-05-09T18:01:00Z',
    },
  });
  const trialing = await provider.syncWebhookEvent({
    eventType: 'subscription.trialing',
    payload: {
      ...basePayload,
      id: 'sub_multi_event_retry',
      status: 'trialing',
      occurred_at: '2026-05-09T18:02:00Z',
    },
  });
  const completed = await provider.syncWebhookEvent({
    eventType: 'transaction.completed',
    payload: {
      ...basePayload,
      id: 'txn_multi_event_retry_2',
      subscription_id: 'sub_multi_event_retry',
      payment_method_id: 'pm_multi_event_retry',
      occurred_at: '2026-05-09T18:03:00Z',
    },
  });

  assert.equal(updated?.shopId, 'demo-shop');
  assert.equal(created?.shopId, 'demo-shop');
  assert.equal(trialing?.shopId, 'demo-shop');
  assert.equal(completed?.shopId, 'demo-shop');
  assert.equal((await billingCustomersRepository.findByShopId('demo-shop', 'paddle'))?.providerCustomerId, 'ctm_multi_event_retry');
  assert.equal((await billingCustomersRepository.findByProviderCustomerId('paddle', 'ctm_multi_event_retry'))?.shopId, 'demo-shop');
  const subscription = await billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', 'sub_multi_event_retry');
  assert.equal(subscription?.providerCustomerId, 'ctm_multi_event_retry');
  assert.equal(subscription?.paymentMethodStatus, 'valid');
});

test('paddle webhook attaches provider data to existing internal trial row', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Webhook Attach Salon',
    phone_number: '+15550001111',
    user_phone: '+15550002222',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const internal = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'none',
  });
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  });

  const first = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_attach_123',
      status: 'trialing',
      currency_code: 'USD',
      payment_method_id: 'pm_verified_123',
      custom_data: {
        shop_id: shop.id,
        internal_subscription_id: internal.id,
      },
      customer_id: 'ctm_attach_123',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      recurring_transaction_details: { interval: 'month' },
      trial_dates: { ends_at: '2026-05-15T00:00:00Z' },
      unit_totals: { total: '7900' },
    },
  });
  const second = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_attach_123',
      status: 'trialing',
      currency_code: 'USD',
      payment_method_id: 'pm_verified_123',
      custom_data: {
        shop_id: shop.id,
        internal_subscription_id: internal.id,
      },
      customer_id: 'ctm_attach_123',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      recurring_transaction_details: { interval: 'month' },
      trial_dates: { ends_at: '2026-05-15T00:00:00Z' },
      unit_totals: { total: '7900' },
    },
  });

  assert.equal(first?.subscription?.id, internal.id);
  assert.equal(second?.subscription?.id, internal.id);
  const updated = await billingSubscriptionsRepository.findById(internal.id);
  assert.equal(updated?.provider, 'paddle');
  assert.equal(updated?.providerSubscriptionId, 'sub_attach_123');
  assert.equal(updated?.paymentMethodStatus, 'valid');
  const allForShop = await billingSubscriptionsRepository.list({ shopId: shop.id, limit: 10 });
  assert.equal(allForShop.length, 1);
});

test('paddle transaction events without subscription id do not corrupt internal no-card trial', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Checkout Transaction Created Salon',
    phone_number: '+15550003333',
    user_phone: '+15550004444',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const internal = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'none',
  });
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  });

  const result = await provider.syncWebhookEvent({
    eventType: 'transaction.created',
    payload: {
      id: 'txn_created_without_subscription',
      status: 'ready',
      currency_code: 'USD',
      custom_data: {
        shop_id: shop.id,
        internal_subscription_id: internal.id,
      },
      customer_id: 'ctm_checkout_created',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      unit_totals: { total: '7900' },
    },
  });

  assert.equal(result?.subscription?.id, internal.id);
  const after = await billingSubscriptionsRepository.findById(internal.id);
  assert.equal(after?.provider, 'internal');
  assert.equal(after?.providerSubscriptionId, null);
  assert.equal(after?.status, 'trialing');
  assert.equal(after?.paymentMethodStatus, 'none');
});

test('paddle subscription payment-method-change transaction keeps trial subscription usable', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.create({
    name: 'Payment Method Change Salon',
    phone_number: '+15550006666',
    user_phone: '+15550007777',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const internal = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2099-05-15T00:00:00Z',
    paymentMethodStatus: 'none',
  });
  const provider = new PaddleBillingProvider({
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  });

  const result = await provider.syncWebhookEvent({
    eventType: 'transaction.created',
    payload: {
      id: 'txn_payment_method_change_ready',
      origin: 'subscription_payment_method_change',
      status: 'ready',
      currency_code: 'USD',
      customer_id: 'ctm_payment_method_change',
      subscription_id: 'sub_payment_method_change',
      custom_data: {
        shop_id: shop.id,
        internal_subscription_id: internal.id,
        internal_trial_ends_at: '2099-05-15T00:00:00Z',
      },
      items: [
        {
          price: {
            id: process.env.PADDLE_PRICE_STARTER_MONTHLY,
            trial_period: { interval: 'day', frequency: 14, requires_payment_method: true },
          },
          quantity: 1,
        },
      ],
      details: { totals: { total: '0', grand_total: '0', currency_code: 'USD' } },
      payments: [],
    },
  });

  assert.equal(result?.subscription?.id, internal.id);
  assert.equal(result?.subscription?.provider, 'paddle');
  assert.equal(result?.subscription?.providerCustomerId, 'ctm_payment_method_change');
  assert.equal(result?.subscription?.providerSubscriptionId, 'sub_payment_method_change');
  assert.equal(result?.subscription?.status, 'trialing');
  assert.equal(result?.subscription?.paymentMethodStatus, 'valid');

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id },
  );
  assert.equal(access.subscriptionStatus, 'trialing');
  assert.equal(access.paymentMethodStatus, 'valid');
});

test('paddle subscription lifecycle events map to normalized statuses', async () => {
  const statusCases: Array<{ eventType: string; paddleStatus?: string; expected: string }> = [
    { eventType: 'subscription.created', paddleStatus: 'trialing', expected: 'trialing' },
    { eventType: 'subscription.trialing', expected: 'trialing' },
    { eventType: 'subscription.activated', expected: 'active' },
    { eventType: 'subscription.updated', paddleStatus: 'active', expected: 'active' },
    { eventType: 'subscription.canceled', expected: 'canceled' },
    { eventType: 'subscription.paused', expected: 'paused' },
    { eventType: 'subscription.resumed', expected: 'active' },
    { eventType: 'subscription.past_due', expected: 'past_due' },
  ];

  for (const statusCase of statusCases) {
    const { provider } = buildProvider();
    const result = await provider.syncWebhookEvent({
      eventType: statusCase.eventType,
      payload: {
        id: `sub_${statusCase.expected}_${statusCase.eventType.replace(/[^a-z]/g, '_')}`,
        status: statusCase.paddleStatus,
        currency_code: 'USD',
        payment_method_id: 'pm_lifecycle',
        custom_data: { shop_id: 'demo-shop' },
        customer_id: `ctm_${statusCase.expected}`,
        items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
        recurring_transaction_details: { interval: 'month' },
        unit_totals: { total: '7900' },
      },
    });
    assert.equal(result?.subscription?.status, statusCase.expected, statusCase.eventType);
  }
});

test('paddle canceled paused past_due and deleted payment method block live answering access', async () => {
  for (const eventType of ['subscription.canceled', 'subscription.paused', 'subscription.past_due'] as const) {
    const { provider, shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository } = buildProvider();
    await shopsRepository.updateUserSettings('demo-shop', {
      telnyx_number: '+15550006666',
      phone_number: '+15550007777',
      user_phone: '+15550008888',
      user_name: 'Billing Owner',
      timezone: 'America/New_York',
      vertical: 'nail_salon',
      hours: { mon: { open: '09:00', close: '17:00' } },
      services: [{ name: 'Manicure', duration_min: 45, price: 45 }],
      current_onboarding_step: 4,
    });
    await shopAccessStatesRepository.upsert({
      shopId: 'demo-shop',
      liveCallsEnabled: true,
      forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
      forwardingSetupVerifiedVia: 'forwarding_test',
    });
    const result = await provider.syncWebhookEvent({
      eventType,
      payload: {
        id: `sub_access_${eventType.replace(/[^a-z]/g, '_')}`,
        currency_code: 'USD',
        payment_method_id: 'pm_access',
        custom_data: { shop_id: 'demo-shop' },
        customer_id: 'ctm_access',
        items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
        recurring_transaction_details: { interval: 'month' },
        unit_totals: { total: '7900' },
      },
    });
    assert.equal(result?.subscription?.status, eventType.replace('subscription.', ''), eventType);
    const access = await getShopBillingAccess(
      { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
      { shopId: 'demo-shop' },
    );
    assert.equal(access.canReceiveLiveCalls, false, eventType);
  }

  const { provider, shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository } = buildProvider();
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+15550009999',
    phone_number: '+15550001111',
    user_phone: '+15550002222',
    user_name: 'Payment Owner',
    timezone: 'America/New_York',
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Pedicure', duration_min: 45, price: 45 }],
    current_onboarding_step: 4,
  });
  await shopAccessStatesRepository.upsert({
    shopId: 'demo-shop',
    liveCallsEnabled: true,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: 'demo-shop',
    provider: 'paddle',
    providerSubscriptionId: 'sub_payment_deleted_access',
    providerCustomerId: 'ctm_payment_deleted_access',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
  });
  await provider.syncWebhookEvent({
    eventType: 'payment_method.deleted',
    payload: {
      id: 'pm_deleted_access',
      custom_data: { shop_id: 'demo-shop' },
      customer_id: 'ctm_payment_deleted_access',
    },
  });
  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: 'demo-shop' },
  );
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'payment_method_required');
});

test('paddle subscription.updated scheduled cancellation keeps active access until status changes', async () => {
  const { provider, shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository } = buildProvider();
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+15550003333',
    phone_number: '+15550004445',
    user_phone: '+15550005556',
    user_name: 'Cancel Later Owner',
    timezone: 'America/New_York',
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Nail art', duration_min: 45, price: 45 }],
    current_onboarding_step: 4,
  });
  await shopAccessStatesRepository.upsert({
    shopId: 'demo-shop',
    liveCallsEnabled: true,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });
  const result = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_scheduled_cancel',
      status: 'active',
      currency_code: 'USD',
      payment_method_id: 'pm_scheduled_cancel',
      custom_data: { shop_id: 'demo-shop' },
      customer_id: 'ctm_scheduled_cancel',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      recurring_transaction_details: { interval: 'month' },
      current_billing_period: { starts_at: '2099-04-01T00:00:00Z', ends_at: '2099-05-01T00:00:00Z' },
      scheduled_change: { action: 'cancel', effective_at: '2099-05-01T00:00:00Z' },
      unit_totals: { total: '7900' },
    },
  });
  assert.equal(result?.subscription?.status, 'active');
  assert.equal(result?.subscription?.cancelAtPeriodEnd, true);
  assert.equal(result?.subscription?.currentPeriodEnd, '2099-05-01T00:00:00Z');

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: 'demo-shop' },
  );
  assert.equal(access.canReceiveLiveCalls, true);
});

test('paddle transaction and payment method events update entitlement-relevant subscription state', async () => {
  const { provider, shopsRepository, billingSubscriptionsRepository } = buildProvider();
  const shop = await shopsRepository.create({
    name: 'Paddle Payment Events Salon',
    phone_number: '+15550004444',
    user_phone: '+15550005555',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_payment_events',
    providerCustomerId: 'ctm_payment_events',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'none',
  });

  const customer = await provider.syncWebhookEvent({
    eventType: 'customer.created',
    payload: {
      id: 'ctm_created_123',
      email: 'customer-created@example.com',
      custom_data: { shop_id: shop.id },
    },
  });
  assert.equal(customer?.customer?.providerCustomerId, 'ctm_created_123');

  const saved = await provider.syncWebhookEvent({
    eventType: 'payment_method.saved',
    payload: {
      id: 'pm_saved_123',
      custom_data: { shop_id: shop.id },
      customer_id: 'ctm_payment_events',
    },
  });
  assert.equal(saved?.subscription?.id, subscription.id);
  assert.equal(saved?.subscription?.paymentMethodStatus, 'valid');

  const completed = await provider.syncWebhookEvent({
    eventType: 'transaction.completed',
    payload: {
      id: 'txn_completed_123',
      subscription_id: 'sub_payment_events',
      status: 'completed',
      currency_code: 'USD',
      payment_method_id: 'pm_completed_123',
      custom_data: { shop_id: shop.id },
      customer_id: 'ctm_payment_events',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ANNUAL } }],
      recurring_transaction_details: { interval: 'year' },
      unit_totals: { total: '79000' },
    },
  });
  assert.equal(completed?.subscription?.providerSubscriptionId, 'sub_payment_events');
  assert.equal(completed?.subscription?.status, 'active');
  assert.equal(completed?.subscription?.interval, 'year');
  assert.equal(completed?.subscription?.providerPriceId, process.env.PADDLE_PRICE_STARTER_ANNUAL);

  const failed = await provider.syncWebhookEvent({
    eventType: 'transaction.payment_failed',
    payload: {
      id: 'txn_failed_123',
      subscription_id: 'sub_payment_events',
      status: 'past_due',
      currency_code: 'USD',
      custom_data: { shop_id: shop.id },
      customer_id: 'ctm_payment_events',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_ANNUAL } }],
      unit_totals: { total: '79000' },
    },
  });
  assert.equal(failed?.subscription?.status, 'past_due');
  assert.equal(failed?.subscription?.paymentMethodStatus, 'failed');

  const deleted = await provider.syncWebhookEvent({
    eventType: 'payment_method.deleted',
    payload: {
      id: 'pm_deleted_123',
      custom_data: { shop_id: shop.id },
      customer_id: 'ctm_payment_events',
    },
  });
  assert.equal(deleted?.subscription?.paymentMethodStatus, 'failed');
});

test('paddle payment method events resolve subscription by customer id when shop id is absent', async () => {
  const { provider, shopsRepository, billingCustomersRepository, billingSubscriptionsRepository, shopAccessStatesRepository } = buildProvider();
  const shop = await shopsRepository.create({
    name: 'Customer Only Payment Salon',
    phone_number: '+15550101010',
    user_phone: '+15550101011',
    user_name: 'Customer Owner',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_customer_only',
    email: 'customer-only@example.com',
  });
  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_customer_only',
    providerCustomerId: 'ctm_customer_only',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'none',
  });

  const saved = await provider.syncWebhookEvent({
    eventType: 'payment_method.saved',
    payload: {
      id: 'pm_customer_only_saved',
      customer_id: 'ctm_customer_only',
      occurred_at: '2026-05-10T10:00:00Z',
    },
  });
  assert.equal(saved?.shopId, shop.id);
  assert.equal(saved?.subscription?.id, subscription.id);
  assert.equal(saved?.subscription?.paymentMethodStatus, 'valid');

  await shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15550101012',
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Gel manicure', duration_min: 45, price: 55 }],
    current_onboarding_step: 4,
  });
  await shopAccessStatesRepository.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
    forwardingSetupVerifiedAt: '2026-05-10T10:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const deleted = await provider.syncWebhookEvent({
    eventType: 'payment_method.deleted',
    payload: {
      id: 'pm_customer_only_deleted',
      customer_id: 'ctm_customer_only',
      occurred_at: '2026-05-10T11:00:00Z',
    },
  });
  assert.equal(deleted?.subscription?.paymentMethodStatus, 'failed');
  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-10T12:00:00Z') },
  );
  assert.equal(access.canReceiveLiveCalls, false);
  assert.equal(access.blockReason, 'payment_method_required');
});

test('paddle webhook rejects customer and subscription ownership conflicts without mutation', async () => {
  const { provider, shopsRepository, billingCustomersRepository, billingSubscriptionsRepository } = buildProvider();
  const ownerShop = await shopsRepository.create({
    name: 'Paddle Owner Shop',
    phone_number: '+15550202020',
    user_phone: '+15550202021',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  const attackerShop = await shopsRepository.create({
    name: 'Paddle Attacker Shop',
    phone_number: '+15550202022',
    user_phone: '+15550202023',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: ownerShop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_owned_elsewhere',
    email: 'owner@example.com',
  });
  const ownedSub = await billingSubscriptionsRepository.upsert({
    shopId: ownerShop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_owned_elsewhere',
    providerCustomerId: 'ctm_owned_elsewhere',
    plan: 'starter',
    status: 'canceled',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'failed',
  });

  const customerConflict = await provider.syncWebhookEvent({
    eventType: 'payment_method.saved',
    payload: {
      id: 'pm_conflict_customer',
      customer_id: 'ctm_owned_elsewhere',
      custom_data: { shop_id: attackerShop.id },
      occurred_at: '2026-05-11T10:00:00Z',
    },
  });
  assert.equal(customerConflict, null);
  assert.equal((await billingCustomersRepository.findByProviderCustomerId('paddle', 'ctm_owned_elsewhere'))?.shopId, ownerShop.id);

  const subscriptionConflict = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_owned_elsewhere',
      status: 'active',
      customer_id: 'ctm_owned_elsewhere',
      custom_data: { shop_id: attackerShop.id },
      payment_method_id: 'pm_conflict_subscription',
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      unit_totals: { total: '7900' },
      occurred_at: '2026-05-11T11:00:00Z',
    },
  });
  assert.equal(subscriptionConflict, null);
  const unchanged = await billingSubscriptionsRepository.findById(ownedSub.id);
  assert.equal(unchanged?.shopId, ownerShop.id);
  assert.equal(unchanged?.status, 'canceled');
  assert.equal(unchanged?.paymentMethodStatus, 'failed');
});

test('paddle stale subscription event cannot re-enable after newer canceled event', async () => {
  const { provider, shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository } = buildProvider();
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+15550303030',
    phone_number: '+15550303031',
    user_phone: '+15550303032',
    user_name: 'Stale Event Owner',
    timezone: 'America/New_York',
    vertical: 'nail_salon',
    hours: { mon: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Pedicure', duration_min: 45, price: 45 }],
    current_onboarding_step: 4,
  });
  await shopAccessStatesRepository.upsert({
    shopId: 'demo-shop',
    liveCallsEnabled: true,
    forwardingSetupVerifiedAt: '2026-05-04T00:00:00Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const canceled = await provider.syncWebhookEvent({
    eventType: 'subscription.canceled',
    payload: {
      id: 'sub_stale_guard',
      status: 'canceled',
      customer_id: 'ctm_stale_guard',
      custom_data: { shop_id: 'demo-shop' },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      unit_totals: { total: '7900' },
      occurred_at: '2026-05-12T12:00:00Z',
    },
  });
  assert.equal(canceled?.subscription?.status, 'canceled');

  const staleActive = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_stale_guard',
      status: 'active',
      payment_method_id: 'pm_stale_guard',
      customer_id: 'ctm_stale_guard',
      custom_data: { shop_id: 'demo-shop' },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      unit_totals: { total: '7900' },
      occurred_at: '2026-05-12T11:00:00Z',
    },
  });
  assert.equal(staleActive?.subscription?.status, 'canceled');
  const subscription = await billingSubscriptionsRepository.findByProviderSubscriptionId('paddle', 'sub_stale_guard');
  assert.equal(subscription?.status, 'canceled');

  const access = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: 'demo-shop', now: new Date('2026-05-12T13:00:00Z') },
  );
  assert.equal(access.canReceiveLiveCalls, false);
});
