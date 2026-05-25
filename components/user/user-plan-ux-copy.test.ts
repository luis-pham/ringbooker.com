import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  BILLING_PLAN_CARD_FEATURES,
  CUSTOM_MANAGED_SETUP_ITEMS,
  getBilingualAnsweringPlanUx,
  getOwnerTransferPlanUx,
  getReturningCallerNotesPlanUx,
} from './user-plan-ux-copy';
import { getShopPlanCapabilities } from '@/src/backend/domain/shop-plan-capabilities';

test('owner transfer UI locks for Starter and is configurable for Professional', () => {
  const starterCapabilities = getShopPlanCapabilities('starter');
  const proCapabilities = getShopPlanCapabilities('professional');

  const starter = getOwnerTransferPlanUx('starter', starterCapabilities);
  assert.equal(starter.locked, true);
  assert.match(starter.badge, /Available on Professional/);
  assert.equal(starter.locked, !starterCapabilities.edit_transfer_settings);

  const professional = getOwnerTransferPlanUx('professional', proCapabilities);
  assert.equal(professional.locked, false);
  assert.match(professional.badge, /Professional/);
  assert.equal(professional.locked, !proCapabilities.edit_transfer_settings);
});

test('bilingual answering UX is locked for Starter and available for Professional', () => {
  const starter = getBilingualAnsweringPlanUx('starter');
  assert.equal(starter.locked, true);
  assert.match(starter.description, /available on Professional/i);

  const professional = getBilingualAnsweringPlanUx('professional');
  assert.equal(professional.locked, false);
  assert.match(professional.description, /languages RingBooker may use/i);
});

test('returning caller notes UX is locked for Starter and active for Professional', () => {
  const starter = getReturningCallerNotesPlanUx('starter');
  assert.equal(starter.locked, true);
  assert.match(starter.badge, /Available on Professional/);

  const professional = getReturningCallerNotesPlanUx('professional');
  assert.equal(professional.locked, false);
  assert.match(professional.badge, /Active on Professional/);
});

test('billing plan card copy matches public usage limits and Custom managed volume', () => {
  assert.ok(BILLING_PLAN_CARD_FEATURES.starter.some((feature) => /100 captured calls per billing period/i.test(feature)));
  assert.ok(BILLING_PLAN_CARD_FEATURES.professional.some((feature) => /200 captured calls per billing period/i.test(feature)));
  assert.ok(BILLING_PLAN_CARD_FEATURES.enterprise.some((feature) => /Custom captured call volume/i.test(feature)));
  assert.ok(!BILLING_PLAN_CARD_FEATURES.starter.some((feature) => /1 number included/i.test(feature)));
});

test('Custom managed setup panel includes implementation support items', () => {
  assert.ok(CUSTOM_MANAGED_SETUP_ITEMS.includes('Multi-location setup'));
  assert.ok(CUSTOM_MANAGED_SETUP_ITEMS.includes('Custom routing'));
  assert.ok(CUSTOM_MANAGED_SETUP_ITEMS.includes('Custom multilingual routing'));
  assert.ok(CUSTOM_MANAGED_SETUP_ITEMS.includes('Implementation support'));
});

test('bookings pages use safer availability copy', () => {
  const live = readFileSync('components/user/user-bookings-live.tsx', 'utf8');
  const template = readFileSync('components/user/user-bookings.tsx', 'utf8');
  for (const source of [live, template]) {
    assert.match(source, /AI can check live availability when a connected calendar integration is configured\./);
    assert.match(source, /See appointment requests and bookings RingBooker has captured or created\./);
    assert.doesNotMatch(source, /AI checks live availability before offering an appointment\./);
    assert.doesNotMatch(source, /See every appointment RingBooker has created, confirmed, or recovered\./);
  }
});

test('billing UI exposes self-serve Professional upgrade copy and endpoint', () => {
  const billingLive = readFileSync('components/user/user-billing-live.tsx', 'utf8');
  assert.match(billingLive, /Upgrade to Professional/);
  assert.match(billingLive, /Professional features will unlock after billing confirms the change/);
  assert.ok(billingLive.includes('/api/backend/user/billing/upgrade'));
  assert.match(billingLive, /Resolve billing first/);
  assert.match(billingLive, /Current plan/);
});

test('billing UI has safe fallback copy when Manage Billing is disabled', () => {
  const billingLive = readFileSync('components/user/user-billing-live.tsx', 'utf8');
  assert.match(billingLive, /billing_manage_disabled/);
  assert.match(billingLive, /Billing management is temporarily unavailable/);
  assert.match(billingLive, /Contact support if you need help updating payment details or managing your subscription/);
});

test('billing UI separates local account activity from Paddle payments and invoices', () => {
  const billingLive = readFileSync('components/user/user-billing-live.tsx', 'utf8');
  assert.match(billingLive, /Payments &amp; invoices/);
  assert.match(billingLive, /Official payments and receipts from Paddle/);
  assert.ok(billingLive.includes('/api/backend/user/billing/transactions'));
  assert.match(billingLive, /Account billing activity/);
  assert.match(billingLive, /This shows RingBooker account status changes/);
  assert.match(billingLive, /You can still view official invoices and receipts in Manage billing/);
});

test('user-facing call and billing dates use shop timezone helpers', () => {
  const callsLive = readFileSync('components/user/user-calls-live.tsx', 'utf8');
  const billingLive = readFileSync('components/user/user-billing-live.tsx', 'utf8');
  const dashboardLive = readFileSync('components/user/user-dashboard-live.tsx', 'utf8');

  assert.match(callsLive, /formatShopDate/);
  assert.match(callsLive, /formatShopTime/);
  assert.match(callsLive, /getShopTimezone/);
  assert.match(callsLive, /shop\?: \{ timezone\?: string \| null \}/);
  assert.doesNotMatch(callsLive, /toLocale(?:DateString|TimeString|String)/);

  assert.match(billingLive, /formatShopDate/);
  assert.match(billingLive, /getShopTimezone/);
  assert.doesNotMatch(billingLive, /toLocale(?:DateString|TimeString|String)/);

  assert.match(dashboardLive, /formatShopDateTime/);
  assert.match(dashboardLive, /getShopTimezone/);
});
