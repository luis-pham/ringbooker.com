import test from 'node:test';
import assert from 'node:assert/strict';

import type { BillingSubscription, Shop, ShopAccessState } from '@/src/backend/domain/types';
import { buildAdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';

function shopBase(over: Partial<Shop> = {}): Shop {
  return {
    id: 'shop_test',
    name: 'Test Salon',
    vertical: 'nail_salon',
    phone_number: '+15550001111',
    user_phone: '+15550002222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    hours: { mon: { open: '09:00', close: '17:00' } },
    cancel_policy: '24h',
    allow_transfers: false,
    allow_callbacks: true,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'starter',
    active: true,
    setup_method: 'forward',
    forwarding_type: 'no_answer',
    telnyx_number: '+15559999999',
    ...over,
  };
}

function subBase(over: Partial<BillingSubscription> = {}): BillingSubscription {
  const now = new Date('2026-05-10T12:00:00.000Z');
  return {
    id: 'bs1',
    shopId: 'shop_test',
    provider: 'paddle',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    cancelAtPeriodEnd: false,
    trialStartedAt: '2026-05-01T00:00:00.000Z',
    trialEndsAt: '2026-05-21T00:00:00.000Z',
    paymentMethodStatus: 'none',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...over,
  };
}

const accessOff: ShopAccessState = {
  id: 'sas1',
  shopId: 'shop_test',
  liveCallsEnabled: false,
  goLiveAt: null,
  liveCallsPausedReason: null,
  liveCallsPausedAt: null,
  lastAccessCheckAt: null,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

test('trialing with future trial end → trialing, days left > 0', () => {
  const now = new Date('2026-05-10T12:00:00.000Z');
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase(),
    accessState: accessOff,
    testCallsUsed: 0,
    now,
  });
  assert.equal(s.trialStatus, 'trialing');
  assert.ok((s.trialDaysLeft ?? 0) > 0);
  assert.equal(s.subscriptionStatus, 'trialing');
  assert.equal(s.paymentMethodStatus, 'none');
  assert.equal(s.blockReason, 'payment_method_required');
});

test('trialing past trialEndsAt → trial_ended', () => {
  const now = new Date('2026-06-01T12:00:00.000Z');
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase(),
    accessState: accessOff,
    testCallsUsed: 0,
    now,
  });
  assert.equal(s.trialStatus, 'trial_ended');
});

test('active subscription', () => {
  const now = new Date('2026-05-10T12:00:00.000Z');
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase({
      status: 'active',
      trialEndsAt: null,
      trialStartedAt: null,
      paymentMethodStatus: 'valid',
    }),
    accessState: { ...accessOff, liveCallsEnabled: true },
    testCallsUsed: 0,
    now,
  });
  assert.equal(s.subscriptionStatus, 'active');
  assert.equal(s.trialStatus, 'not_applicable');
  assert.equal(s.canGoLive, true);
  assert.equal(s.canReceiveLiveCalls, true);
  assert.equal(s.blockReason, 'none');
});

test('past_due', () => {
  const now = new Date('2026-05-10T12:00:00.000Z');
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase({ status: 'past_due', paymentMethodStatus: 'failed' }),
    accessState: accessOff,
    testCallsUsed: 0,
    now,
  });
  assert.equal(s.subscriptionStatus, 'past_due');
  assert.equal(s.canGoLive, false);
});

test('no subscription → subscriptionStatus null, trial none', () => {
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: null,
    accessState: accessOff,
    testCallsUsed: 0,
    now: new Date('2026-05-10T12:00:00.000Z'),
  });
  assert.equal(s.subscriptionStatus, null);
  assert.equal(s.trialStatus, 'none');
  assert.equal(s.blockReason, 'no_subscription');
});

test('payment method none label source', () => {
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase(),
    accessState: accessOff,
    testCallsUsed: 0,
    now: new Date('2026-05-10T12:00:00.000Z'),
  });
  assert.equal(s.paymentMethodStatus, 'none');
});

test('shop.active false → account inactive', () => {
  const s = buildAdminShopStatus({
    shop: shopBase({ active: false }),
    subscription: subBase({ status: 'active', paymentMethodStatus: 'valid' }),
    accessState: { ...accessOff, liveCallsEnabled: true },
    testCallsUsed: 0,
    now: new Date('2026-05-10T12:00:00.000Z'),
  });
  assert.equal(s.accountStatus, 'inactive');
  assert.equal(s.blockReason, 'account_inactive');
  assert.equal(s.canReceiveLiveCalls, false);
});

test('live_calls_enabled false → disabled', () => {
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase({ status: 'active', paymentMethodStatus: 'valid' }),
    accessState: accessOff,
    testCallsUsed: 0,
    now: new Date('2026-05-10T12:00:00.000Z'),
  });
  assert.equal(s.liveAnsweringStatus, 'disabled');
  assert.equal(s.canGoLive, true);
  assert.equal(s.canReceiveLiveCalls, false);
  assert.equal(s.blockReason, 'live_not_enabled');
});

test('canGoLive false shows blockReason payment when trialing no card', () => {
  const s = buildAdminShopStatus({
    shop: shopBase(),
    subscription: subBase(),
    accessState: accessOff,
    testCallsUsed: 0,
    now: new Date('2026-05-10T12:00:00.000Z'),
  });
  assert.equal(s.canGoLive, false);
  assert.equal(s.blockReason, 'payment_method_required');
});
