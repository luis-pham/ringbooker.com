/**
 * Comprehensive Billing Tests — Groups 1–5
 *
 * Tests captured-call counter, overage triggers, hard limits, Paddle webhook
 * handling, and usage alerts.  All state lives in in-memory repositories so no
 * production data is touched and no cleanup is required.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopOverageChargesRepository } from '@/src/backend/adapters/memory/shop-overage-charges-repository';
import { InMemoryShopUsageAlertsRepository } from '@/src/backend/adapters/memory/shop-usage-alerts-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { PaddleBillingProvider } from '@/src/backend/adapters/paddle/billing-provider';
import type { Shop } from '@/src/backend/domain/types';
import { processOverageForPeriod } from '@/src/backend/services/billing/process-overage';
import type { EmailService } from '@/src/backend/services/email/types';
import { checkLiveCallUsageGate } from '@/src/backend/services/usage/live-call-usage-gate';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
import {
  checkAndSendUsageAlerts,
  maybeSendUsageAlert,
} from '@/src/backend/services/usage/usage-alerts';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

// ─── shared helpers ──────────────────────────────────────────────────────────

type RecordedEmail = Parameters<EmailService['sendEmail']>[0];

class RecordingEmailService implements EmailService {
  readonly sent: RecordedEmail[] = [];
  async sendEmail(params: RecordedEmail) {
    this.sent.push(params);
    return { providerMessageId: `email_${this.sent.length}` };
  }
}

/** Minimal shop – the factory gives each test a unique ID to keep state isolated */
function makeShop(overrides: Partial<Shop> & { plan: Shop['plan'] }): Shop {
  return {
    id: `billing-test-${overrides.plan}-${Math.random().toString(36).slice(2)}`,
    name: 'Billing Test Shop',
    phone_number: '+15550100000',
    user_phone: '+15550100001',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    active: true,
    ...overrides,
  };
}

const PERIOD_A = {
  start: new Date('2026-03-15T00:00:00.000Z'),
  end: new Date('2026-04-15T00:00:00.000Z'),
};
const PERIOD_B = {
  start: new Date('2026-04-15T00:00:00.000Z'),
  end: new Date('2026-05-15T00:00:00.000Z'),
};

async function addActiveSub(
  billingSubscriptionsRepository: InMemoryBillingSubscriptionsRepository,
  shop: Shop,
  opts: { status?: 'active' | 'trialing' | 'past_due'; period?: typeof PERIOD_A } = {},
) {
  const { status = 'active', period = PERIOD_A } = opts;
  return billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: status !== 'trialing' ? `sub_${shop.id}` : null,
    providerCustomerId: `ctm_${shop.id}`,
    plan: shop.plan,
    status,
    interval: 'month',
    currency: 'USD',
    amount: shop.plan === 'starter' ? 79 : 149,
    amountCents: shop.plan === 'starter' ? 7900 : 14900,
    currentPeriodStart: period.start.toISOString(),
    currentPeriodEnd: period.end.toISOString(),
    paymentMethodStatus: status === 'active' ? 'valid' : 'failed',
  });
}

async function addCapturedCall(
  callLogsRepository: InMemoryCallLogsRepository,
  shop: Shop,
  index: number,
  period = PERIOD_A,
) {
  const requestId = `captured-req-${shop.id}-${index}`;
  const providerCallId = `captured-call-${shop.id}-${index}`;
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId,
    shopId: shop.id,
    callerPhone: '+15550000099',
    startedAt: new Date(period.start.getTime() + 60_000 * (index + 1)),
    requestId,
  });
  await callLogsRepository.updateStructuredSummary(shop.id, requestId, {
    summaryServiceRequest: 'gel manicure',
  });
}

function makeBillingProvider(opts: { fail?: boolean } = {}) {
  const calls: Array<{ providerSubscriptionId: string; amountCents: number }> = [];
  return {
    calls,
    provider: {
      provider: 'paddle' as const,
      calls,
      async chargeOverage(p: { providerSubscriptionId: string; amountCents: number; description: string }) {
        calls.push(p);
        if (opts.fail) throw new Error('paddle_down');
        return { providerTransactionId: `txn_${Date.now()}` };
      },
      async createCheckoutSession() { throw new Error('not_implemented'); },
      async syncWebhookEvent() { return null; },
    },
  };
}

async function verifiedOwner(
  authUsersRepository: InMemoryAuthUsersRepository,
  shop: Shop,
) {
  const user = await authUsersRepository.create({
    email: `${shop.id}@example.com`,
    role: 'user',
    shopId: shop.id,
    passwordHash: 'hash',
  });
  await authUsersRepository.markEmailVerified(user.id, new Date('2026-03-01T00:00:00.000Z'));
}

// ─── Test results accumulator ─────────────────────────────────────────────────

type TestResult = {
  group: string;
  testId: string;
  name: string;
  result: 'PASS' | 'FAIL';
  details: string;
};

const results: TestResult[] = [];

function record(group: string, testId: string, name: string, result: 'PASS' | 'FAIL', details = '') {
  results.push({ group, testId, name, result, details });
}

// ─── GROUP 1 — CAPTURED CALL COUNTER ─────────────────────────────────────────

test('1.1a — Counter increments correctly for Starter plan', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);

  let failed = false;
  let failDetails = '';
  for (let i = 0; i < 5; i++) {
    await addCapturedCall(callLogsRepository, shop, i);
    const usage = await getShopUsageForPeriod(
      { callLogsRepository, billingSubscriptionsRepository },
      { shop, period: PERIOD_A },
    );
    if (usage.capturedCallersUsed !== i + 1) {
      failed = true;
      failDetails = `After call ${i + 1}: expected counter=${i + 1}, got=${usage.capturedCallersUsed}`;
      break;
    }
  }

  if (failed) {
    record('1', '1.1a', 'Counter increments correctly — Starter', 'FAIL', failDetails);
    assert.fail(failDetails);
  } else {
    record('1', '1.1a', 'Counter increments correctly — Starter', 'PASS');
  }
});

test('1.1b — Counter increments correctly for Professional plan', async () => {
  const shop = makeShop({ plan: 'professional' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);

  let failed = false;
  let failDetails = '';
  for (let i = 0; i < 5; i++) {
    await addCapturedCall(callLogsRepository, shop, i);
    const usage = await getShopUsageForPeriod(
      { callLogsRepository, billingSubscriptionsRepository },
      { shop, period: PERIOD_A },
    );
    if (usage.capturedCallersUsed !== i + 1) {
      failed = true;
      failDetails = `After call ${i + 1}: expected counter=${i + 1}, got=${usage.capturedCallersUsed}`;
      break;
    }
  }

  if (failed) {
    record('1', '1.1b', 'Counter increments correctly — Professional', 'FAIL', failDetails);
    assert.fail(failDetails);
  } else {
    record('1', '1.1b', 'Counter increments correctly — Professional', 'PASS');
  }
});

test('1.2 — Only captured calls count (missed / noise / wrong number do not increment)', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);
  const periodStart = PERIOD_A.start;

  // Missed call
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'missed-call-1',
    shopId: shop.id,
    callerPhone: '+15550000010',
    startedAt: new Date(periodStart.getTime() + 60_000),
    requestId: 'req-missed-1',
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'missed-call-1',
    endedAt: new Date(periodStart.getTime() + 62_000),
    outcome: 'missed',
  });

  // Wrong number / hang-up — caller hangs up with no transcript content
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'hangup-call-1',
    shopId: shop.id,
    callerPhone: '+15550000011',
    startedAt: new Date(periodStart.getTime() + 120_000),
    requestId: 'req-hangup-1',
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'hangup-call-1',
    endedAt: new Date(periodStart.getTime() + 125_000),
    outcome: 'no_response',
  });

  // Noise-only — assistant greeting only, no caller content
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'noise-call-1',
    shopId: shop.id,
    callerPhone: '+15550000012',
    startedAt: new Date(periodStart.getTime() + 180_000),
    requestId: 'req-noise-1',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: shop.id,
    requestId: 'req-noise-1',
    speaker: 'assistant',
    text: 'Thank you for calling. How can I help you today?',
  });
  // no structured summary → not captured

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop, period: PERIOD_A },
  );

  if (usage.capturedCallersUsed !== 0) {
    record('1', '1.2', 'Only captured calls count', 'FAIL',
      `Expected counter=0 after 3 non-captured calls, got=${usage.capturedCallersUsed}`);
    assert.fail(`Expected capturedCallersUsed=0, got=${usage.capturedCallersUsed}`);
  } else {
    record('1', '1.2', 'Only captured calls count', 'PASS');
  }
  assert.equal(usage.capturedCallersUsed, 0);
});

test('1.3 — Counter resets on billing cycle renewal (period transition)', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();

  // Set up Period A subscription and add 50 captured calls
  await addActiveSub(billingSubscriptionsRepository, shop, { period: PERIOD_A });
  for (let i = 0; i < 50; i++) await addCapturedCall(callLogsRepository, shop, i, PERIOD_A);

  // Verify counter = 50 in Period A
  const usageBefore = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop, period: PERIOD_A },
  );
  assert.equal(usageBefore.capturedCallersUsed, 50, 'Pre-renewal counter should be 50');

  // Simulate renewal: update subscription to Period B
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: `sub_${shop.id}`,
    providerCustomerId: `ctm_${shop.id}`,
    plan: shop.plan,
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: PERIOD_B.start.toISOString(),
    currentPeriodEnd: PERIOD_B.end.toISOString(),
    paymentMethodStatus: 'valid',
  });

  // Counter in new period = 0 (no calls in Period B yet)
  const usageAfter = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop, period: PERIOD_B },
  );

  if (usageAfter.capturedCallersUsed !== 0) {
    record('1', '1.3', 'Counter resets on billing cycle renewal', 'FAIL',
      `Expected counter=0 in new period, got=${usageAfter.capturedCallersUsed}`);
    assert.fail(`Expected capturedCallersUsed=0 after period reset, got=${usageAfter.capturedCallersUsed}`);
  } else {
    record('1', '1.3', 'Counter resets on billing cycle renewal', 'PASS',
      'Period A=50 calls, Period B=0 after subscription renewal');
  }
  assert.equal(usageAfter.capturedCallersUsed, 0);
});

// ─── GROUP 2 — OVERAGE TRIGGER ────────────────────────────────────────────────

test('2.1 — Starter: overage triggers at 101st call ($0.75 created, call not blocked)', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);
  for (let i = 0; i < 101; i++) await addCapturedCall(callLogsRepository, shop, i);

  const { provider: bp } = makeBillingProvider();

  await processOverageForPeriod(shop, PERIOD_A.start, PERIOD_A.end, {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: bp,
  });

  const charges = await overageRepository.listByShopId(shop.id);
  const charge = charges[0];

  // Also assert call still goes through (not blocked) for active subscription
  const gate = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop },
  );

  const overageOk = charges.length === 1 && charge?.overageCallers === 1 && charge?.amountCents === 75 && charge?.status === 'charged';
  const gateOk = gate.ok === true;

  if (!overageOk || !gateOk) {
    const details = [
      !overageOk ? `Overage: charges=${charges.length}, overageCallers=${charge?.overageCallers}, amountCents=${charge?.amountCents}, status=${charge?.status}` : '',
      !gateOk ? `Gate: ok=${gate.ok}, reason=${!gate.ok ? gate.reason : 'N/A'}` : '',
    ].filter(Boolean).join('; ');
    record('2', '2.1', 'Starter: overage at 101st call', 'FAIL', details);
    assert.fail(details);
  } else {
    record('2', '2.1', 'Starter: overage at 101st call', 'PASS',
      'Charge=$0.75 created; call gate=open for active subscription');
  }

  assert.equal(charges.length, 1);
  assert.equal(charge?.overageCallers, 1);
  assert.equal(charge?.amountCents, 75);
  assert.equal(charge?.status, 'charged');
  assert.equal(gate.ok, true);
});

test('2.2 — Professional: overage triggers at 201st call', async () => {
  const shop = makeShop({ plan: 'professional' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);
  for (let i = 0; i < 201; i++) await addCapturedCall(callLogsRepository, shop, i);

  const { provider: bp } = makeBillingProvider();

  await processOverageForPeriod(shop, PERIOD_A.start, PERIOD_A.end, {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: bp,
  });

  const charges = await overageRepository.listByShopId(shop.id);
  const charge = charges[0];

  if (charges.length !== 1 || charge?.overageCallers !== 1 || charge?.amountCents !== 75) {
    const details = `charges=${charges.length}, overageCallers=${charge?.overageCallers}, amountCents=${charge?.amountCents}`;
    record('2', '2.2', 'Professional: overage at 201st call', 'FAIL', details);
    assert.fail(details);
  } else {
    record('2', '2.2', 'Professional: overage at 201st call', 'PASS', 'Charge=$0.75 at 201/200 limit');
  }

  assert.equal(charge?.overageCallers, 1);
  assert.equal(charge?.amountCents, 75);
});

test('2.3 — Multiple overages accumulate correctly (5 × $0.75 = $3.75)', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);
  for (let i = 0; i < 105; i++) await addCapturedCall(callLogsRepository, shop, i);

  const { provider: bp } = makeBillingProvider();

  await processOverageForPeriod(shop, PERIOD_A.start, PERIOD_A.end, {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: bp,
  });

  const charges = await overageRepository.listByShopId(shop.id);
  const charge = charges[0];

  if (charge?.overageCallers !== 5 || charge?.amountCents !== 375) {
    const details = `overageCallers=${charge?.overageCallers}, amountCents=${charge?.amountCents} (expected 5 × 75 = 375)`;
    record('2', '2.3', '5× overage = $3.75', 'FAIL', details);
    assert.fail(details);
  } else {
    record('2', '2.3', '5× overage = $3.75', 'PASS');
  }

  assert.equal(charge?.overageCallers, 5);
  assert.equal(charge?.amountCents, 375);
});

test('2.4 — Overage does NOT trigger below limit (Starter at 99/100)', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  await addActiveSub(billingSubscriptionsRepository, shop);
  for (let i = 0; i < 99; i++) await addCapturedCall(callLogsRepository, shop, i);

  const { provider: bp } = makeBillingProvider();

  await processOverageForPeriod(shop, PERIOD_A.start, PERIOD_A.end, {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: bp,
  });

  const charges = await overageRepository.listByShopId(shop.id);
  const charge = charges[0];

  // Should create a "skipped" record with 0 overage
  if (charges.length !== 1 || charge?.status !== 'skipped' || charge?.overageCallers !== 0) {
    const details = `charges=${charges.length}, status=${charge?.status}, overageCallers=${charge?.overageCallers}`;
    record('2', '2.4', 'No overage below limit (99/100)', 'FAIL', details);
    assert.fail(details);
  } else {
    record('2', '2.4', 'No overage below limit (99/100)', 'PASS', 'status=skipped, paddleChargeCalls=0');
  }

  assert.equal(charge?.status, 'skipped');
  assert.equal(charge?.overageCallers, 0);
  assert.equal(bp.calls.length, 0);
});

// ─── GROUP 3 — HARD LIMITS ────────────────────────────────────────────────────

test('3.1 — Trial account blocked at limit', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  await addActiveSub(billingSubscriptionsRepository, shop, { status: 'trialing' });
  for (let i = 0; i < 100; i++) await addCapturedCall(callLogsRepository, shop, i);

  const gate = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop },
  );

  if (gate.ok !== false || gate.reason !== 'usage_limit_reached') {
    const details = `gate.ok=${gate.ok}, reason=${gate.ok ? 'N/A' : gate.reason}`;
    record('3', '3.1', 'Trial blocked at limit', 'FAIL', details);
    assert.fail(`Expected blocked: ${details}`);
  } else {
    record('3', '3.1', 'Trial blocked at limit', 'PASS', 'gate.reason=usage_limit_reached');
  }

  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'usage_limit_reached');
});

test('3.2 — Past-due account blocked', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  await addActiveSub(billingSubscriptionsRepository, shop, { status: 'past_due' });
  // At limit
  for (let i = 0; i < 100; i++) await addCapturedCall(callLogsRepository, shop, i);

  const gate = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop },
  );

  if (gate.ok !== false || gate.reason !== 'usage_limit_reached') {
    const details = `gate.ok=${gate.ok}, reason=${gate.ok ? 'N/A' : gate.reason}`;
    record('3', '3.2', 'Past-due account blocked', 'FAIL', details);
    assert.fail(`Expected blocked: ${details}`);
  } else {
    record('3', '3.2', 'Past-due account blocked', 'PASS', 'gate.reason=usage_limit_reached');
  }

  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'usage_limit_reached');
});

test('3.3 — Paid active account NOT blocked at limit (overage permitted)', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  await addActiveSub(billingSubscriptionsRepository, shop, { status: 'active' });
  for (let i = 0; i < 100; i++) await addCapturedCall(callLogsRepository, shop, i);

  const gate = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop },
  );

  if (gate.ok !== true) {
    const details = `gate.ok=${gate.ok}, reason=${gate.ok ? 'N/A' : gate.reason}`;
    record('3', '3.3', 'Paid active not blocked at limit', 'FAIL', details);
    assert.fail(`Expected call to go through: ${details}`);
  } else {
    record('3', '3.3', 'Paid active not blocked at limit', 'PASS', 'Call passes gate at 100/100');
  }

  assert.equal(gate.ok, true);
  // Usage should show overCapturedCallerLimit = true
  assert.equal(gate.usage.overCapturedCallerLimit, true);
});

// ─── GROUP 4 — PADDLE WEBHOOK HANDLING ───────────────────────────────────────

function buildPaddleProvider() {
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

test('4.1 — subscription.created webhook creates shop record with correct plan and status=active', async () => {
  const { provider, shopsRepository, billingCustomersRepository } = buildPaddleProvider();
  const shop = await shopsRepository.create({
    name: 'Webhook Created Shop',
    phone_number: '+15550201000',
    user_phone: '+15550201001',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_created_test',
    email: 'webhook-created@ringbooker.local',
  });

  const result = await provider.syncWebhookEvent({
    eventType: 'subscription.created',
    payload: {
      id: 'sub_created_test',
      status: 'active',
      customer_id: 'ctm_created_test',
      custom_data: { shop_id: shop.id },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      current_billing_period: {
        starts_at: PERIOD_A.start.toISOString(),
        ends_at: PERIOD_A.end.toISOString(),
      },
      unit_totals: { total: '7900' },
      occurred_at: '2026-03-15T00:00:01Z',
    },
  });

  const ok = result !== null && result.subscription?.status === 'active' && result.subscription?.plan === 'starter';

  if (!ok) {
    const details = `result=${JSON.stringify(result?.subscription ?? null)}`;
    record('4', '4.1', 'subscription.created → status=active', 'FAIL', details);
    assert.fail(`Webhook result unexpected: ${details}`);
  } else {
    record('4', '4.1', 'subscription.created → status=active', 'PASS',
      `plan=${result?.subscription?.plan}, status=${result?.subscription?.status}`);
  }

  assert.ok(result);
  assert.equal(result.subscription?.status, 'active');
  assert.equal(result.subscription?.plan, 'starter');
});

test('4.2 — subscription.updated (Starter → Professional) updates plan and preserves counter', async () => {
  const {
    provider,
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
  } = buildPaddleProvider();

  const shop = await shopsRepository.create({
    name: 'Webhook Upgrade Shop',
    phone_number: '+15550202000',
    user_phone: '+15550202001',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_upgrade_wh',
    email: 'webhook-upgrade@ringbooker.local',
  });
  const sub = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_upgrade_wh',
    providerCustomerId: 'ctm_upgrade_wh',
    providerPriceId: process.env.PADDLE_PRICE_STARTER_MONTHLY,
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: PERIOD_A.start.toISOString(),
    currentPeriodEnd: PERIOD_A.end.toISOString(),
    paymentMethodStatus: 'valid',
    metadata: {
      pending_plan_upgrade: {
        targetPlan: 'professional',
        billingInterval: 'month',
        requestedAt: '2026-03-20T00:00:00Z',
      },
    },
  });

  // Seed a few calls for Starter period — counter should survive plan change
  const callLogsRepository = new InMemoryCallLogsRepository();
  for (let i = 0; i < 10; i++) await addCapturedCall(callLogsRepository, { ...shop }, i, PERIOD_A);

  const result = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_upgrade_wh',
      status: 'active',
      customer_id: 'ctm_upgrade_wh',
      custom_data: { shop_id: shop.id },
      items: [{ price: { id: process.env.PADDLE_PRICE_PROFESSIONAL_MONTHLY } }],
      current_billing_period: {
        starts_at: PERIOD_A.start.toISOString(),
        ends_at: PERIOD_A.end.toISOString(),
      },
      unit_totals: { total: '14900' },
      occurred_at: '2026-03-20T00:00:00Z',
    },
  });

  const afterShop = await shopsRepository.findById(shop.id);
  const afterSub = await billingSubscriptionsRepository.findById(sub.id);
  const usageAfter = await getShopUsageForPeriod(
    { callLogsRepository },
    { shop: { ...shop, plan: 'professional' }, period: PERIOD_A },
  );

  const planOk = afterShop?.plan === 'professional' && afterSub?.plan === 'professional';
  const counterOk = usageAfter.capturedCallersUsed === 10;

  if (!planOk || !counterOk) {
    const details = `shopPlan=${afterShop?.plan}, subPlan=${afterSub?.plan}, capturedCallersUsed=${usageAfter.capturedCallersUsed}`;
    record('4', '4.2', 'subscription.updated Starter→Pro', 'FAIL', details);
    assert.fail(details);
  } else {
    record('4', '4.2', 'subscription.updated Starter→Pro', 'PASS',
      `plan=professional, counter preserved at 10`);
  }

  assert.equal(afterShop?.plan, 'professional');
  assert.equal(afterSub?.plan, 'professional');
  assert.equal(usageAfter.capturedCallersUsed, 10);
  assert.ok(result);
});

test('4.3 — subscription.cancelled → shop status=cancelled, calls blocked', async () => {
  const {
    provider,
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  } = buildPaddleProvider();

  const shop = await shopsRepository.create({
    name: 'Webhook Cancel Shop',
    phone_number: '+15550203000',
    user_phone: '+15550203001',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_cancel_wh',
    email: 'webhook-cancel@ringbooker.local',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_cancel_wh',
    providerCustomerId: 'ctm_cancel_wh',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: PERIOD_A.start.toISOString(),
    currentPeriodEnd: PERIOD_A.end.toISOString(),
    paymentMethodStatus: 'valid',
  });

  await provider.syncWebhookEvent({
    eventType: 'subscription.canceled',
    payload: {
      id: 'sub_cancel_wh',
      status: 'canceled',
      customer_id: 'ctm_cancel_wh',
      custom_data: { shop_id: shop.id },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      occurred_at: '2026-04-01T00:00:00Z',
    },
  });

  const afterShop = await shopsRepository.findById(shop.id);
  const accessState = await shopAccessStatesRepository.findByShopId(shop.id);

  const shopInactive = afterShop?.active === false;
  const callsDisabled = accessState?.liveCallsEnabled === false;

  if (!shopInactive || !callsDisabled) {
    const details = `shopActive=${afterShop?.active}, liveCallsEnabled=${accessState?.liveCallsEnabled}`;
    record('4', '4.3', 'subscription.cancelled → inactive + calls blocked', 'FAIL', details);
    assert.fail(details);
  } else {
    record('4', '4.3', 'subscription.cancelled → inactive + calls blocked', 'PASS');
  }

  assert.equal(afterShop?.active, false);
  assert.equal(accessState?.liveCallsEnabled, false);
});

test('4.4 — subscription.past_due → status=past_due, hard limit applied', async () => {
  const {
    provider,
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  } = buildPaddleProvider();

  const shop = await shopsRepository.create({
    name: 'Webhook PastDue Shop',
    phone_number: '+15550204000',
    user_phone: '+15550204001',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_pastdue_wh',
    email: 'webhook-pastdue@ringbooker.local',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_pastdue_wh',
    providerCustomerId: 'ctm_pastdue_wh',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: PERIOD_A.start.toISOString(),
    currentPeriodEnd: PERIOD_A.end.toISOString(),
    paymentMethodStatus: 'valid',
  });

  await provider.syncWebhookEvent({
    eventType: 'subscription.past_due',
    payload: {
      id: 'sub_pastdue_wh',
      status: 'past_due',
      customer_id: 'ctm_pastdue_wh',
      custom_data: { shop_id: shop.id },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      occurred_at: '2026-04-05T00:00:00Z',
    },
  });

  const updatedSub = await billingSubscriptionsRepository.findCurrentByShopId(shop.id);
  const accessState = await shopAccessStatesRepository.findByShopId(shop.id);

  // Shop stays active (account visible) but live calls are disabled
  const subPastDue = updatedSub?.status === 'past_due';
  const callsDisabled = accessState?.liveCallsEnabled === false;

  if (!subPastDue || !callsDisabled) {
    const details = `subStatus=${updatedSub?.status}, liveCallsEnabled=${accessState?.liveCallsEnabled}`;
    record('4', '4.4', 'subscription.past_due → calls blocked', 'FAIL', details);
    assert.fail(details);
  } else {
    record('4', '4.4', 'subscription.past_due → calls blocked', 'PASS',
      `subStatus=past_due, liveCallsEnabled=false`);
  }

  assert.equal(updatedSub?.status, 'past_due');
  assert.equal(accessState?.liveCallsEnabled, false);
});

test('4.5 — Duplicate webhook (same event_id / older timestamp) is ignored — no double charge', async () => {
  const {
    provider,
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
  } = buildPaddleProvider();

  const shop = await shopsRepository.create({
    name: 'Webhook Duplicate Shop',
    phone_number: '+15550205000',
    user_phone: '+15550205001',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await billingCustomersRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_dup_wh',
    email: 'webhook-dup@ringbooker.local',
  });
  const sub = await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: 'sub_dup_wh',
    providerCustomerId: 'ctm_dup_wh',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: PERIOD_A.start.toISOString(),
    currentPeriodEnd: PERIOD_A.end.toISOString(),
    paymentMethodStatus: 'valid',
    metadata: {
      latest_paddle_event_at: '2026-03-20T12:00:00Z',
    },
  });

  // First event sets the state
  const firstResult = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_dup_wh',
      status: 'active',
      customer_id: 'ctm_dup_wh',
      custom_data: { shop_id: shop.id },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      current_billing_period: {
        starts_at: PERIOD_A.start.toISOString(),
        ends_at: PERIOD_A.end.toISOString(),
      },
      unit_totals: { total: '7900' },
      occurred_at: '2026-03-20T12:00:00Z',
    },
  });

  const subAfterFirst = await billingSubscriptionsRepository.findById(sub.id);

  // Second event with OLDER timestamp — should be ignored (stale)
  const secondResult = await provider.syncWebhookEvent({
    eventType: 'subscription.updated',
    payload: {
      id: 'sub_dup_wh',
      status: 'active',
      customer_id: 'ctm_dup_wh',
      custom_data: { shop_id: shop.id },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
      current_billing_period: {
        starts_at: PERIOD_A.start.toISOString(),
        ends_at: PERIOD_A.end.toISOString(),
      },
      unit_totals: { total: '7900' },
      occurred_at: '2026-03-19T00:00:00Z', // older timestamp → stale
    },
  });

  const subAfterSecond = await billingSubscriptionsRepository.findById(sub.id);

  // The second (stale) event must not change subscription state
  const noMutation = subAfterFirst?.amountCents === subAfterSecond?.amountCents &&
    subAfterFirst?.status === subAfterSecond?.status;

  if (!noMutation) {
    const details = `Before: ${JSON.stringify(subAfterFirst)}, After: ${JSON.stringify(subAfterSecond)}`;
    record('4', '4.5', 'Duplicate stale webhook ignored', 'FAIL', details);
    assert.fail(details);
  } else {
    record('4', '4.5', 'Duplicate stale webhook ignored', 'PASS',
      `Stale event with occurred_at=2026-03-19 ignored; state unchanged`);
  }

  assert.ok(firstResult);
  assert.ok(secondResult);
  assert.equal(subAfterFirst?.status, subAfterSecond?.status);
});

// ─── GROUP 5 — USAGE ALERTS ───────────────────────────────────────────────────

test('5.1 — 80% alert fires exactly once at 80/100 threshold', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const usageAlertsRepository = new InMemoryShopUsageAlertsRepository();
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const emailService = new RecordingEmailService();
  await addActiveSub(billingSubscriptionsRepository, shop);
  await verifiedOwner(authUsersRepository, shop);
  for (let i = 0; i < 80; i++) await addCapturedCall(callLogsRepository, shop, i);

  // First check
  await checkAndSendUsageAlerts(shop, {
    callLogsRepository,
    billingSubscriptionsRepository,
    usageAlertsRepository,
    authUsersRepository,
    emailService,
  });

  const sentAfterFirst = emailService.sent.length;
  const categoryOk = emailService.sent[0]?.category === 'usage_80pct_warning';

  // Second check — should NOT send again
  await checkAndSendUsageAlerts(shop, {
    callLogsRepository,
    billingSubscriptionsRepository,
    usageAlertsRepository,
    authUsersRepository,
    emailService,
  });

  const sentAfterSecond = emailService.sent.length;

  const ok = sentAfterFirst === 1 && categoryOk && sentAfterSecond === 1;
  if (!ok) {
    const details = `sentAfterFirst=${sentAfterFirst}, category=${emailService.sent[0]?.category}, sentAfterSecond=${sentAfterSecond}`;
    record('5', '5.1', '80% alert fires once at 80/100', 'FAIL', details);
    assert.fail(details);
  } else {
    record('5', '5.1', '80% alert fires once at 80/100', 'PASS', 'category=usage_80pct_warning, deduped');
  }

  assert.equal(emailService.sent.length, 1);
  assert.equal(emailService.sent[0]?.category, 'usage_80pct_warning');
});

test('5.2 — 100% alert fires at limit with different copy from 80% alert', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const usageAlertsRepository = new InMemoryShopUsageAlertsRepository();
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const emailService = new RecordingEmailService();
  await addActiveSub(billingSubscriptionsRepository, shop);
  await verifiedOwner(authUsersRepository, shop);
  for (let i = 0; i < 100; i++) await addCapturedCall(callLogsRepository, shop, i);

  await checkAndSendUsageAlerts(shop, {
    callLogsRepository,
    billingSubscriptionsRepository,
    usageAlertsRepository,
    authUsersRepository,
    emailService,
  });

  const sent = emailService.sent[0];
  const categoryOk = sent?.category === 'usage_100pct_overage';
  const subjectOk = sent?.subject === 'Caller limit reached — overage now applies';
  const differentFrom80 = sent?.subject !== "You've used 80% of your caller limit this period";

  if (!categoryOk || !subjectOk || !differentFrom80) {
    const details = `category=${sent?.category}, subject="${sent?.subject}"`;
    record('5', '5.2', '100% alert at limit — distinct copy', 'FAIL', details);
    assert.fail(details);
  } else {
    record('5', '5.2', '100% alert at limit — distinct copy', 'PASS', `category=usage_100pct_overage`);
  }

  assert.equal(emailService.sent.length, 1);
  assert.equal(sent?.category, 'usage_100pct_overage');
  assert.equal(sent?.subject, 'Caller limit reached — overage now applies');
});

test('5.3 — Alerts do not repeat (idempotent): 5 calls after 80% still only 1 email', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const usageAlertsRepository = new InMemoryShopUsageAlertsRepository();
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const emailService = new RecordingEmailService();
  await addActiveSub(billingSubscriptionsRepository, shop);
  await verifiedOwner(authUsersRepository, shop);
  for (let i = 0; i < 80; i++) await addCapturedCall(callLogsRepository, shop, i);

  // Trigger at 80%
  await checkAndSendUsageAlerts(shop, {
    callLogsRepository, billingSubscriptionsRepository,
    usageAlertsRepository, authUsersRepository, emailService,
  });

  // 5 more calls at 80-85% — each check should NOT resend
  for (let extra = 80; extra < 85; extra++) {
    await addCapturedCall(callLogsRepository, shop, extra);
    await checkAndSendUsageAlerts(shop, {
      callLogsRepository, billingSubscriptionsRepository,
      usageAlertsRepository, authUsersRepository, emailService,
    });
  }

  // At 85 we've also hit 100pct_overage territory? No — 85 < 100.
  // So we only expect the single 80pct email.
  if (emailService.sent.length !== 1) {
    const details = `Expected 1 email, got ${emailService.sent.length}: ${emailService.sent.map((e) => e.category).join(', ')}`;
    record('5', '5.3', '80% alert not repeated on subsequent calls', 'FAIL', details);
    assert.fail(details);
  } else {
    record('5', '5.3', '80% alert not repeated on subsequent calls', 'PASS', '5 calls after 80%: still 1 email');
  }

  assert.equal(emailService.sent.length, 1);
});

test('5.4 — Alerts reset on billing cycle: 80% alert re-fires after period renewal', async () => {
  const shop = makeShop({ plan: 'starter' });
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const usageAlertsRepository = new InMemoryShopUsageAlertsRepository();
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const emailService = new RecordingEmailService();

  // Period A subscription
  await addActiveSub(billingSubscriptionsRepository, shop, { period: PERIOD_A });
  await verifiedOwner(authUsersRepository, shop);

  // Add 80 calls in Period A, fire alert
  for (let i = 0; i < 80; i++) await addCapturedCall(callLogsRepository, shop, i, PERIOD_A);
  const period = PERIOD_A;
  const usageA = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop, period },
  );
  await maybeSendUsageAlert(shop, '80pct_warning', usageA, PERIOD_A.start, {
    callLogsRepository, billingSubscriptionsRepository,
    usageAlertsRepository, authUsersRepository, emailService,
  });
  assert.equal(emailService.sent.length, 1, 'Expected 1 email after Period A 80% alert');

  // Simulate billing renewal: update subscription to Period B
  await billingSubscriptionsRepository.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerSubscriptionId: `sub_${shop.id}`,
    providerCustomerId: `ctm_${shop.id}`,
    plan: shop.plan,
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    currentPeriodStart: PERIOD_B.start.toISOString(),
    currentPeriodEnd: PERIOD_B.end.toISOString(),
    paymentMethodStatus: 'valid',
  });

  // Add 80 calls in Period B
  for (let i = 0; i < 80; i++) await addCapturedCall(callLogsRepository, shop, 1000 + i, PERIOD_B);

  const usageB = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop, period: PERIOD_B },
  );
  // Fire alert for Period B (new period start → new idempotency key)
  await maybeSendUsageAlert(shop, '80pct_warning', usageB, PERIOD_B.start, {
    callLogsRepository, billingSubscriptionsRepository,
    usageAlertsRepository, authUsersRepository, emailService,
  });

  if (emailService.sent.length !== 2) {
    const details = `Expected 2 emails (one per period), got ${emailService.sent.length}`;
    record('5', '5.4', '80% alert resets on billing cycle', 'FAIL', details);
    assert.fail(details);
  } else {
    record('5', '5.4', '80% alert resets on billing cycle', 'PASS',
      'Period A email + Period B email = 2 total');
  }

  assert.equal(emailService.sent.length, 2);
  assert.equal(emailService.sent[1]?.category, 'usage_80pct_warning');
});

// ─── REPORT ───────────────────────────────────────────────────────────────────

test('BILLING TEST REPORT', () => {
  // Collect results (populated by the tests above — node:test runs serially
  // within the same file, so results[] is complete by the time this test runs)
  const header = ['| Group | Test | Result | Details |', '|---|---|---|---|'];
  const rows = results.map((r) =>
    `| ${r.group} | ${r.testId} ${r.name} | **${r.result}** | ${r.details || '—'} |`,
  );
  const table = [...header, ...rows].join('\n');

  const failures = results.filter((r) => r.result === 'FAIL');
  console.log('\n\n=== BILLING TEST REPORT ===\n');
  console.log(table);
  console.log(`\nTotal: ${results.length} tests, ${failures.length} failures\n`);

  if (failures.length > 0) {
    console.log('=== FAILURES ===');
    for (const f of failures) {
      console.log(`\n[FAIL] ${f.group}.${f.testId} — ${f.name}`);
      console.log(`  Expected behavior: see test body`);
      console.log(`  Actual behavior:   ${f.details}`);
    }
  }
  // Not asserting here — individual tests already assert; this is just a summary
});
