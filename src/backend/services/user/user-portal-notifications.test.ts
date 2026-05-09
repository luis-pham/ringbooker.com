import test from 'node:test';
import assert from 'node:assert/strict';

import type { BillingSubscription } from '@/src/backend/domain/types';
import type { ShopBillingAccess } from '@/src/backend/services/billing/access';
import { buildUserPortalNotifications } from '@/src/backend/services/user/user-portal-notifications';

function createAccess(overrides?: Partial<ShopBillingAccess>): ShopBillingAccess {
  return {
    canReceiveLiveCalls: false,
    canGoLive: false,
    canTestCall: true,
    blockReason: 'payment_method_required',
    billingProvider: 'internal',
    subscriptionStatus: 'trialing',
    paymentMethodStatus: 'none',
    providerCustomerId: null,
    providerSubscriptionId: null,
    trialEndsAt: '2026-05-23T00:00:00.000Z',
    trialDaysRemaining: 14,
    liveCallsEnabled: false,
    amountCents: 7900,
    interval: 'month',
    currency: 'USD',
    testCallsUsed: 0,
    testCallLimit: 3,
    setupWizardComplete: true,
    hasForwardingNumber: false,
    forwardingSetupVerified: false,
    commercialGoLiveApproved: true,
    ...overrides,
  };
}

function createSubscription(overrides?: Partial<BillingSubscription>): BillingSubscription {
  return {
    id: 'sub-test',
    shopId: 'shop-test',
    provider: 'internal',
    providerSubscriptionId: null,
    providerCustomerId: null,
    providerPriceId: null,
    providerProductId: null,
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    cancelAtPeriodEnd: false,
    trialStartedAt: '2026-05-09T00:00:00.000Z',
    trialEndsAt: '2026-05-23T00:00:00.000Z',
    currentPeriodStart: '2026-05-09T00:00:00.000Z',
    currentPeriodEnd: '2026-05-23T00:00:00.000Z',
    paymentMethodStatus: 'none',
    ...overrides,
  };
}

test('billing notification stays visible until Paddle verifies payment method', () => {
  for (const paymentMethodStatus of ['none', 'unknown', 'pending'] as const) {
    const notifications = buildUserPortalNotifications({
      access: createAccess({ paymentMethodStatus, blockReason: 'payment_method_required' }),
      subscription: createSubscription({ paymentMethodStatus }),
      usage: null,
      now: new Date('2026-05-09T00:00:00.000Z'),
    });

    assert.ok(
      notifications.some((item) => item.id === 'payment_method_required'),
      `expected payment alert for ${paymentMethodStatus}`,
    );
  }
});

test('billing notification stays visible when checkout state changes before Paddle verification', () => {
  const notifications = buildUserPortalNotifications({
    access: createAccess({
      paymentMethodStatus: 'unknown',
      blockReason: 'forwarding_number_required',
    }),
    subscription: createSubscription({
      status: 'trialing',
      paymentMethodStatus: 'unknown',
      provider: 'paddle',
      providerCustomerId: 'ctm_pending',
      providerSubscriptionId: null,
    }),
    usage: null,
    now: new Date('2026-05-09T00:00:00.000Z'),
  });

  assert.ok(notifications.some((item) => item.id === 'payment_method_required'));
});

test('billing notification clears only after verified payment method removes payment block', () => {
  const notifications = buildUserPortalNotifications({
    access: createAccess({
      paymentMethodStatus: 'valid',
      blockReason: 'forwarding_number_required',
      providerCustomerId: 'ctm_verified',
      providerSubscriptionId: 'sub_verified',
    }),
    subscription: createSubscription({
      provider: 'paddle',
      providerCustomerId: 'ctm_verified',
      providerSubscriptionId: 'sub_verified',
      paymentMethodStatus: 'valid',
    }),
    usage: null,
    now: new Date('2026-05-09T00:00:00.000Z'),
  });

  assert.equal(notifications.some((item) => item.id === 'payment_method_required'), false);
});
