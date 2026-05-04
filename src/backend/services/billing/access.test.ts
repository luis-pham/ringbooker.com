import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';

test('billing access blocks go-live and live calls until payment method is verified', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const shop = await shopsRepository.create({
    name: 'Access Salon',
    phone_number: '+15551110000',
    user_phone: '+15551112222',
    timezone: 'America/New_York',
    plan: 'starter',
    active: true,
  });

  const subscription = await billingSubscriptionsRepository.upsert({
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
  await shopAccessStatesRepository.upsert({ shopId: shop.id, liveCallsEnabled: false });

  const withoutPayment = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z'), onboardingComplete: true },
  );
  assert.equal(withoutPayment.canGoLive, false);
  assert.equal(withoutPayment.canReceiveLiveCalls, false);
  assert.equal(withoutPayment.blockReason, 'payment_method_required');

  await billingSubscriptionsRepository.updateById(subscription.id, {
    provider: 'paddle',
    providerSubscriptionId: 'sub_verified',
    paymentMethodStatus: 'valid',
    paymentMethodAddedAt: '2026-05-04T00:00:00Z',
  });
  const paymentVerifiedButNotEnabled = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z'), onboardingComplete: true },
  );
  assert.equal(paymentVerifiedButNotEnabled.canGoLive, true);
  assert.equal(paymentVerifiedButNotEnabled.canReceiveLiveCalls, false);
  assert.equal(paymentVerifiedButNotEnabled.blockReason, 'live_not_enabled');

  await shopAccessStatesRepository.upsert({ shopId: shop.id, liveCallsEnabled: true });
  const live = await getShopBillingAccess(
    { shopsRepository, billingSubscriptionsRepository, shopAccessStatesRepository },
    { shopId: shop.id, now: new Date('2026-05-04T00:00:00Z'), onboardingComplete: true },
  );
  assert.equal(live.canGoLive, true);
  assert.equal(live.canReceiveLiveCalls, true);
});
