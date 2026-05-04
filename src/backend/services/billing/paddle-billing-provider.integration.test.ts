import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { PaddleBillingProvider } from '@/src/backend/adapters/paddle/billing-provider';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

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
            id: process.env.PADDLE_PRICE_PROFESSIONAL,
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
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER } }],
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
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER } }],
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
