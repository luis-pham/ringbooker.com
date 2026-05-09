import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
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

test('paddle checkout uses sandbox API and annual price mapping from env', async () => {
  applyRequiredTestEnv({
    PADDLE_ENV: 'sandbox',
    PADDLE_ENVIRONMENT: 'production',
    PADDLE_PRICE_PROFESSIONAL_ANNUAL: 'pri_test_professional_annual_custom',
  });
  resetEnvCacheForTests();
  const { provider, shopsRepository } = buildProvider();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  const calls: Array<{ url: string; body: { items?: Array<{ price_id?: string }> } }> = [];
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
      successUrl: 'https://ringbooker.test/user/billing?checkout=success',
      cancelUrl: 'https://ringbooker.test/user/billing?checkout=cancelled',
    });
    assert.equal(session.checkoutUrl, 'https://sandbox-checkout.paddle.com/txn_test_annual');
    assert.equal(calls[0]?.url, 'https://sandbox-api.paddle.com/transactions');
    assert.equal(calls[0]?.body.items?.[0]?.price_id, 'pri_test_professional_annual_custom');
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
