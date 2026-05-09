import test from 'node:test';
import assert from 'node:assert/strict';

import type { BillingSubscription, Shop } from '@/src/backend/domain/types';
import {
  buildAdminTrialEndingSoonWatchlist,
  trialDaysRemainingUtc,
} from '@/src/backend/services/admin/admin-dashboard-trial-watchlist';

function shop(id: string, name: string): Shop {
  return {
    id,
    name,
    vertical: 'nail_salon',
    phone_number: '+15550001111',
    user_phone: '+15550002222',
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
    current_onboarding_step: 4,
  };
}

function sub(over: Partial<BillingSubscription> & Pick<BillingSubscription, 'shopId'>): BillingSubscription {
  const base: BillingSubscription = {
    id: `bs_${over.shopId}`,
    shopId: over.shopId,
    provider: 'paddle',
    providerSubscriptionId: 'sub_x',
    providerCustomerId: 'cus_x',
    providerPriceId: null,
    providerProductId: null,
    plan: 'professional',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    amountCents: 14900,
    cancelAtPeriodEnd: false,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    trialStartedAt: '2026-05-01T00:00:00.000Z',
    trialEndsAt: '2026-05-20T00:00:00.000Z',
    trialExpiredAt: null,
    canceledAt: null,
    pausedAt: null,
    paymentMethodStatus: 'valid',
    paymentMethodAddedAt: null,
    activatedAt: null,
    metadata: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  };
  return { ...base, ...over };
}

test('trialDaysRemainingUtc uses ceiling days', () => {
  const now = new Date('2026-05-19T23:00:00.000Z');
  assert.equal(trialDaysRemainingUtc('2026-05-20T00:00:00.000Z', now), 1);
});

test('watchlist includes trialing + valid payment within window', () => {
  const now = new Date('2026-05-10T12:00:00.000Z');
  const shops = [shop('a', 'Salon A'), shop('b', 'Salon B')];
  const map = new Map<string, BillingSubscription | null>([
    ['a', sub({ shopId: 'a', trialEndsAt: '2026-05-21T00:00:00.000Z', paymentMethodStatus: 'valid' })],
    ['b', sub({ shopId: 'b', trialEndsAt: '2026-06-30T00:00:00.000Z', paymentMethodStatus: 'valid' })],
  ]);
  const list = buildAdminTrialEndingSoonWatchlist(shops, map, now, { windowDays: 14 });
  assert.equal(list.length, 1);
  assert.equal(list[0]?.shopId, 'a');
  assert.equal(list[0]?.daysRemaining, 11);
});

test('watchlist skips non-valid payment or non-trialing', () => {
  const now = new Date('2026-05-10T12:00:00.000Z');
  const shops = [shop('a', 'A'), shop('c', 'C'), shop('d', 'D')];
  const map = new Map<string, BillingSubscription | null>([
    ['a', sub({ shopId: 'a', trialEndsAt: '2026-05-15T00:00:00.000Z', paymentMethodStatus: 'pending' })],
    ['c', sub({ shopId: 'c', trialEndsAt: '2026-05-15T00:00:00.000Z', status: 'active', paymentMethodStatus: 'valid' })],
    ['d', sub({ shopId: 'd', trialEndsAt: '2026-05-15T00:00:00.000Z', paymentMethodStatus: 'valid' })],
  ]);
  const list = buildAdminTrialEndingSoonWatchlist(shops, map, now, { windowDays: 14 });
  assert.equal(list.length, 1);
  assert.equal(list[0]?.shopId, 'd');
});
