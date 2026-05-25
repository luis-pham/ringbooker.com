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

test('billing notification dates render in the shop timezone', () => {
  const trialEndsAt = '2026-05-01T06:30:00.000Z';
  const base = {
    access: createAccess({ trialEndsAt, trialDaysRemaining: 3 }),
    subscription: createSubscription({ trialEndsAt, currentPeriodEnd: trialEndsAt }),
    usage: null,
    now: new Date('2026-04-28T12:00:00.000Z'),
  };

  const la = buildUserPortalNotifications({
    ...base,
    shopTimezone: 'America/Los_Angeles',
  });
  const ny = buildUserPortalNotifications({
    ...base,
    shopTimezone: 'America/New_York',
  });

  assert.match(JSON.stringify(la), /Apr 30, 2026/);
  assert.match(JSON.stringify(ny), /May 1, 2026/);
});

test('over-limit notification uses overage copy for active paid subscriptions', () => {
  const notifications = buildUserPortalNotifications({
    access: createAccess({
      blockReason: 'none',
      subscriptionStatus: 'active',
      paymentMethodStatus: 'valid',
      canReceiveLiveCalls: true,
    }),
    subscription: createSubscription({
      status: 'active',
      paymentMethodStatus: 'valid',
      provider: 'paddle',
      providerCustomerId: 'ctm_active',
      providerSubscriptionId: 'sub_active',
    }),
    usage: {
      nearCapturedCallerLimit: false,
      overCapturedCallerLimit: true,
      capturedCallersUsed: 101,
      capturedCallersLimit: 100,
    },
    now: new Date('2026-05-09T00:00:00.000Z'),
  });

  const usage = notifications.find((item) => item.id === 'usage_captured_over');
  assert.equal(usage?.severity, 'warn');
  assert.equal(usage?.body, "You've exceeded your captured call limit. Additional captured calls are billed at $0.75 each.");
});

test('over-limit notification uses trial copy for trial subscriptions', () => {
  const notifications = buildUserPortalNotifications({
    access: createAccess({ subscriptionStatus: 'trialing', paymentMethodStatus: 'valid' }),
    subscription: createSubscription({ status: 'trialing', paymentMethodStatus: 'valid' }),
    usage: {
      nearCapturedCallerLimit: false,
      overCapturedCallerLimit: true,
      capturedCallersUsed: 100,
      capturedCallersLimit: 100,
    },
    now: new Date('2026-05-09T00:00:00.000Z'),
  });

  const usage = notifications.find((item) => item.id === 'usage_captured_over');
  assert.equal(usage?.severity, 'critical');
  assert.equal(usage?.body, "You've reached your trial caller limit. Add a payment method to continue.");
});

test('over-limit notification uses payment failed copy for past_due subscriptions', () => {
  const notifications = buildUserPortalNotifications({
    access: createAccess({
      subscriptionStatus: 'past_due',
      paymentMethodStatus: 'failed',
      blockReason: 'subscription_inactive',
    }),
    subscription: createSubscription({
      status: 'past_due',
      paymentMethodStatus: 'failed',
    }),
    usage: {
      nearCapturedCallerLimit: false,
      overCapturedCallerLimit: true,
      capturedCallersUsed: 100,
      capturedCallersLimit: 100,
    },
    now: new Date('2026-05-09T00:00:00.000Z'),
  });

  const usage = notifications.find((item) => item.id === 'usage_captured_over');
  assert.equal(usage?.severity, 'critical');
  assert.equal(usage?.body, 'Your payment failed. Please update your payment method to continue receiving calls.');
});
