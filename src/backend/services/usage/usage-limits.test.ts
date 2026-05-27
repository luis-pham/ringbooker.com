import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryShopActiveCallSessionsRepository } from '@/src/backend/adapters/memory/shop-active-call-sessions-repository';
import { getPlanUsageLimits } from '@/src/backend/domain/plan-usage-limits';
import type { Shop } from '@/src/backend/domain/types';
import { isCapturedCaller } from '@/src/backend/services/usage/captured-caller';
import { checkLiveCallUsageGate } from '@/src/backend/services/usage/live-call-usage-gate';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';

function shop(plan: Shop['plan']): Shop {
  return {
    id: `shop-${plan}`,
    name: `${plan} shop`,
    phone_number: '+15550000000',
    user_phone: '+15550000001',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan,
    active: true,
  };
}

async function addCapturedCall(
  callLogsRepository: InMemoryCallLogsRepository,
  params: { shopId: string; providerCallId: string; requestId: string; startedAt: Date },
) {
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: params.providerCallId,
    shopId: params.shopId,
    callerPhone: '+15550000002',
    startedAt: params.startedAt,
    requestId: params.requestId,
  });
  await callLogsRepository.updateStructuredSummary(params.shopId, params.requestId, {
    summaryServiceRequest: 'gel manicure',
  });
}

async function addBillingSubscription(
  billingSubscriptionsRepository: InMemoryBillingSubscriptionsRepository,
  params: {
    shopId: string;
    plan: Shop['plan'];
    currentPeriodStart: string;
    currentPeriodEnd: string;
    status?: 'active' | 'trialing' | 'past_due' | 'unpaid';
    paymentMethodStatus?: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
  },
) {
  await billingSubscriptionsRepository.upsert({
    shopId: params.shopId,
    provider: 'paddle',
    providerSubscriptionId: `sub_${params.shopId}`,
    providerCustomerId: `ctm_${params.shopId}`,
    plan: params.plan,
    status: params.status ?? 'active',
    interval: 'month',
    currency: 'USD',
    amount: params.plan === 'starter' ? 79 : 149,
    currentPeriodStart: params.currentPeriodStart,
    currentPeriodEnd: params.currentPeriodEnd,
    paymentMethodStatus: params.paymentMethodStatus ?? (params.status === 'past_due' || params.status === 'unpaid' ? 'failed' : 'valid'),
  });
}

test('getPlanUsageLimits returns Starter and Professional limits', () => {
  assert.deepEqual(getPlanUsageLimits('starter'), {
    capturedCallersMonthlyLimit: 100,
    softVoiceMinutesMonthlyLimit: null,
    maxConcurrentLiveCalls: 1,
    maxCallDurationSeconds: 360,
    softWarningAfterSeconds: 300,
    isCustom: false,
  });
  assert.equal(getPlanUsageLimits('professional').capturedCallersMonthlyLimit, 200);
  assert.equal(getPlanUsageLimits('professional').softVoiceMinutesMonthlyLimit, null);
  assert.equal(getPlanUsageLimits('professional').maxConcurrentLiveCalls, 2);
  assert.equal(getPlanUsageLimits('professional').maxCallDurationSeconds, 480);
});

test('getPlanUsageLimits applies enterprise commercial overrides', () => {
  const limits = getPlanUsageLimits('enterprise', {
    shopId: 'shop-enterprise',
    contractStatus: 'active',
    billingMethod: 'manual_invoice',
    includedCapturedCallers: 1200,
    includedMinutes: 2400,
    maxConcurrentLiveCalls: 8,
    maxCallDurationSeconds: 1500,
  });
  assert.equal(limits.isCustom, true);
  assert.equal(limits.capturedCallersMonthlyLimit, 1200);
  assert.equal(limits.softVoiceMinutesMonthlyLimit, null);
  assert.equal(limits.maxConcurrentLiveCalls, 8);
  assert.equal(limits.maxCallDurationSeconds, 1500);
});

test('isCapturedCaller includes useful production calls and excludes demo/test/missed calls', () => {
  assert.equal(isCapturedCaller({ provider: 'telnyx_call_control', summaryServiceRequest: 'gel manicure' }), true);
  assert.equal(isCapturedCaller({ provider: 'telnyx_call_control', summaryNextAction: 'callback_scheduled' }), true);
  assert.equal(isCapturedCaller({
    provider: 'telnyx_call_control',
    callerPhone: '+15550000002',
    transcriptText: '[2026-05-27T02:14:43.917Z] ASSISTANT: Thanks for calling. How can I help?\nSYSTEM: [POST_CALL_SUMMARY] status=completed',
  }), false);
  assert.equal(isCapturedCaller({
    provider: 'telnyx_call_control',
    callerPhone: '+15550000002',
    transcriptText: 'CALLER: I would like to ask about a haircut appointment tomorrow.',
  }), true);
  assert.equal(isCapturedCaller({ provider: 'marketing_demo_web', summaryServiceRequest: 'gel manicure' }), false);
  assert.equal(isCapturedCaller({ provider: 'telnyx_call_control', outcome: 'missed', summaryServiceRequest: 'gel manicure' }), false);
});

test('getShopUsageForPeriod counts captured callers and voice seconds for current month', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const activeRepo = new InMemoryShopActiveCallSessionsRepository();
  const s = shop('starter');
  const startedAt = new Date('2026-05-06T10:00:00.000Z');

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'call-1',
    shopId: s.id,
    callerPhone: '+15550000002',
    startedAt,
    requestId: 'req-1',
  });
  await callLogsRepository.updateStructuredSummary(s.id, 'req-1', {
    summaryServiceRequest: 'haircut',
    summaryNextAction: 'booking_link_sent',
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'call-1',
    endedAt: new Date('2026-05-06T10:03:00.000Z'),
    outcome: 'info_only',
  });

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, shopActiveCallSessionsRepository: activeRepo },
    { shop: s, now: new Date('2026-05-06T12:00:00.000Z') },
  );

  assert.equal(usage.capturedCallersUsed, 1);
  assert.equal(usage.capturedCallersLimit, 100);
  assert.equal(usage.voiceSecondsUsed, 180);
  assert.equal(usage.voiceMinutesUsed, 3);
  assert.equal(usage.voiceMinutesSoftLimit, null);
  assert.equal(usage.nearVoiceMinuteLimit, false);
  assert.equal(usage.overVoiceMinuteSoftLimit, false);
});

test('usage period follows the shop-local month boundary', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const s = shop('starter');
  const now = new Date('2026-05-01T06:30:00.000Z'); // Apr 30, 2026 11:30 PM in Los Angeles.

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'la-april-call',
    shopId: s.id,
    callerPhone: '+15550000002',
    startedAt: new Date('2026-05-01T06:45:00.000Z'),
    requestId: 'la-april-req',
  });
  await callLogsRepository.updateStructuredSummary(s.id, 'la-april-req', { summaryServiceRequest: 'haircut' });

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'la-may-call',
    shopId: s.id,
    callerPhone: '+15550000003',
    startedAt: new Date('2026-05-01T07:15:00.000Z'),
    requestId: 'la-may-req',
  });
  await callLogsRepository.updateStructuredSummary(s.id, 'la-may-req', { summaryServiceRequest: 'color' });

  const usage = await getShopUsageForPeriod({ callLogsRepository }, { shop: s, now });

  assert.equal(usage.periodStart, '2026-04-01T07:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-05-01T07:00:00.000Z');
  assert.equal(usage.capturedCallersUsed, 1);
});

test('usage period uses each shop timezone rather than UTC month', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const s = { ...shop('starter'), timezone: 'America/New_York' };

  const usage = await getShopUsageForPeriod(
    { callLogsRepository },
    { shop: s, now: new Date('2026-05-01T03:30:00.000Z') },
  );

  assert.equal(usage.periodStart, '2026-04-01T04:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-05-01T04:00:00.000Z');
});

test('usage period is safe across daylight saving time changes', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const usage = await getShopUsageForPeriod(
    { callLogsRepository },
    { shop: shop('starter'), now: new Date('2026-03-15T12:00:00.000Z') },
  );

  assert.equal(usage.periodStart, '2026-03-01T08:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-04-01T07:00:00.000Z');
});

test('paid shop usage period uses active billing subscription dates', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'billing-period-shop' };

  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'before-billing-period',
    requestId: 'before-billing-period-req',
    startedAt: new Date('2026-03-14T23:59:00.000Z'),
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'inside-billing-period',
    requestId: 'inside-billing-period-req',
    startedAt: new Date('2026-03-15T00:01:00.000Z'),
  });

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-03-20T12:00:00.000Z') },
  );

  assert.equal(usage.periodStart, '2026-03-15T00:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-04-15T00:00:00.000Z');
  assert.equal(usage.capturedCallersUsed, 1);
});

test('trial shop without billing subscription falls back to shop-local calendar month', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'trial-no-subscription-shop' };

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-05-06T12:00:00.000Z') },
  );

  assert.equal(usage.periodStart, '2026-05-01T07:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-06-01T07:00:00.000Z');
});

test('explicit usage period overrides billing subscription dates', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'explicit-period-shop' };

  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'billing-period-only-call',
    requestId: 'billing-period-only-req',
    startedAt: new Date('2026-03-20T12:00:00.000Z'),
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'explicit-period-call',
    requestId: 'explicit-period-req',
    startedAt: new Date('2026-05-05T12:00:00.000Z'),
  });

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    {
      shop: s,
      now: new Date('2026-03-20T12:00:00.000Z'),
      period: { start: new Date('2026-05-01T00:00:00.000Z'), end: new Date('2026-06-01T00:00:00.000Z') },
    },
  );

  assert.equal(usage.periodStart, '2026-05-01T00:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-06-01T00:00:00.000Z');
  assert.equal(usage.capturedCallersUsed, 1);
});

test('live call usage gate uses billing period instead of calendar month', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const activeRepo = new InMemoryShopActiveCallSessionsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'gate-billing-period-shop' };

  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
  });
  for (let i = 0; i < 100; i += 1) {
    await addCapturedCall(callLogsRepository, {
      shopId: s.id,
      providerCallId: `pre-period-call-${i}`,
      requestId: `pre-period-req-${i}`,
      startedAt: new Date('2026-03-10T12:00:00.000Z'),
    });
  }
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'current-period-call',
    requestId: 'current-period-req',
    startedAt: new Date('2026-03-16T12:00:00.000Z'),
  });

  const result = await checkLiveCallUsageGate(
    { callLogsRepository, shopActiveCallSessionsRepository: activeRepo, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-03-20T12:00:00.000Z') },
  );

  assert.equal(result.ok, true);
  assert.equal(result.usage.capturedCallersUsed, 1);
});

test('captured caller count resets at billing period boundary', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'billing-boundary-shop' };

  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    currentPeriodStart: '2026-04-15T00:00:00.000Z',
    currentPeriodEnd: '2026-05-15T00:00:00.000Z',
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'previous-period-call',
    requestId: 'previous-period-req',
    startedAt: new Date('2026-04-14T23:59:59.000Z'),
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'new-period-call',
    requestId: 'new-period-req',
    startedAt: new Date('2026-04-15T00:00:01.000Z'),
  });

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-04-15T12:00:00.000Z') },
  );

  assert.equal(usage.capturedCallersUsed, 1);
});

test('call on the last day of billing period is counted in that period', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'billing-last-day-shop' };

  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'last-day-call',
    requestId: 'last-day-req',
    startedAt: new Date('2026-04-14T23:59:59.000Z'),
  });
  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'next-period-call',
    requestId: 'next-period-req',
    startedAt: new Date('2026-04-15T00:00:01.000Z'),
  });

  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-04-14T12:00:00.000Z') },
  );

  assert.equal(usage.periodStart, '2026-03-15T00:00:00.000Z');
  assert.equal(usage.periodEnd, '2026-04-15T00:00:00.000Z');
  assert.equal(usage.capturedCallersUsed, 1);
});

test('voice minutes are unlimited and do not block live call gate', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const activeRepo = new InMemoryShopActiveCallSessionsRepository();
  const s = { ...shop('starter'), id: 'voice-unlimited-shop' };
  const startedAt = new Date('2026-05-06T00:00:00.000Z');

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'long-voice-call',
    shopId: s.id,
    callerPhone: '+15550000002',
    startedAt,
    requestId: 'long-voice-req',
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'long-voice-call',
    endedAt: new Date(startedAt.getTime() + 250 * 60 * 1000),
    outcome: 'info_only',
  });

  const result = await checkLiveCallUsageGate(
    { callLogsRepository, shopActiveCallSessionsRepository: activeRepo },
    { shop: s, now: new Date('2026-05-06T12:00:00.000Z') },
  );

  assert.equal(result.ok, true);
  assert.equal(result.usage.voiceMinutesUsed, 250);
  assert.equal(result.usage.voiceMinutesSoftLimit, null);
  assert.equal(result.usage.overVoiceMinuteSoftLimit, false);
});

test('active call session repository enforces Starter and Professional concurrency', async () => {
  const repo = new InMemoryShopActiveCallSessionsRepository();
  const now = new Date('2026-05-06T10:00:00.000Z');
  const expiresAt = new Date(now.getTime() + 480_000);

  assert.equal((await repo.acquireSlot({ shopId: 'starter-shop', provider: 'telnyx', callSessionId: 'starter-a', limit: 1, startedAt: now, expiresAt })).acquired, true);
  assert.equal((await repo.acquireSlot({ shopId: 'starter-shop', provider: 'telnyx', callSessionId: 'starter-b', limit: 1, startedAt: now, expiresAt })).acquired, false);

  assert.equal((await repo.acquireSlot({ shopId: 'pro-shop', provider: 'telnyx', callSessionId: 'pro-a', limit: 2, startedAt: now, expiresAt })).acquired, true);
  assert.equal((await repo.acquireSlot({ shopId: 'pro-shop', provider: 'telnyx', callSessionId: 'pro-b', limit: 2, startedAt: now, expiresAt })).acquired, true);
  assert.equal((await repo.acquireSlot({ shopId: 'pro-shop', provider: 'telnyx', callSessionId: 'pro-c', limit: 2, startedAt: now, expiresAt })).acquired, false);

  await repo.releaseByCallSession({ provider: 'telnyx', callSessionId: 'pro-a', releasedAt: now });
  assert.equal(await repo.countActiveByShop({ shopId: 'pro-shop', now }), 1);
});

test('active paid shop over captured caller limit is allowed so overage can accrue', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'active-overage-shop' };
  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  });
  for (let i = 0; i < 100; i += 1) {
    await addCapturedCall(callLogsRepository, {
      shopId: s.id,
      providerCallId: `active-overage-call-${i}`,
      requestId: `active-overage-req-${i}`,
      startedAt: new Date('2026-05-06T12:00:00.000Z'),
    });
  }

  const result = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-05-06T13:00:00.000Z') },
  );
  assert.equal(result.ok, true);
  assert.equal(result.usage.overCapturedCallerLimit, true);

  await addCapturedCall(callLogsRepository, {
    shopId: s.id,
    providerCallId: 'active-overage-call-continued',
    requestId: 'active-overage-req-continued',
    startedAt: new Date('2026-05-06T13:00:00.000Z'),
  });
  const usage = await getShopUsageForPeriod(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-05-06T14:00:00.000Z') },
  );
  assert.equal(usage.capturedCallersUsed, 101);
});

test('trial shop over captured caller limit is blocked', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'trial-limit-shop' };
  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    status: 'trialing',
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  });
  for (let i = 0; i < 100; i += 1) {
    await addCapturedCall(callLogsRepository, {
      shopId: s.id,
      providerCallId: `trial-limit-call-${i}`,
      requestId: `trial-limit-req-${i}`,
      startedAt: new Date('2026-05-06T12:00:00.000Z'),
    });
  }

  const result = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-05-06T13:00:00.000Z') },
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'usage_limit_reached');
});

test('past_due shop over captured caller limit is blocked', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const s = { ...shop('starter'), id: 'past-due-limit-shop' };
  await addBillingSubscription(billingSubscriptionsRepository, {
    shopId: s.id,
    plan: s.plan,
    status: 'past_due',
    paymentMethodStatus: 'failed',
    currentPeriodStart: '2026-05-01T00:00:00.000Z',
    currentPeriodEnd: '2026-06-01T00:00:00.000Z',
  });
  for (let i = 0; i < 100; i += 1) {
    await addCapturedCall(callLogsRepository, {
      shopId: s.id,
      providerCallId: `past-due-limit-call-${i}`,
      requestId: `past-due-limit-req-${i}`,
      startedAt: new Date('2026-05-06T12:00:00.000Z'),
    });
  }

  const result = await checkLiveCallUsageGate(
    { callLogsRepository, billingSubscriptionsRepository },
    { shop: s, now: new Date('2026-05-06T13:00:00.000Z') },
  );

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'usage_limit_reached');
});

test('captured caller usage reports Starter near and over limit states', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const s = shop('starter');
  const now = new Date('2026-05-06T12:00:00.000Z');
  for (let i = 0; i < 100; i += 1) {
    const requestId = `starter-req-${i}`;
    await callLogsRepository.createOrUpdateInboundCall({
      provider: 'telnyx_call_control',
      providerCallId: `starter-call-${i}`,
      shopId: s.id,
      callerPhone: '+15550000002',
      startedAt: now,
      requestId,
    });
    await callLogsRepository.updateStructuredSummary(s.id, requestId, { summaryServiceRequest: 'gel manicure' });
  }
  const usage = await getShopUsageForPeriod({ callLogsRepository }, { shop: s, now });
  assert.equal(usage.capturedCallersUsed, 100);
  assert.equal(usage.overCapturedCallerLimit, true);
  assert.equal(usage.capturedCallersRemaining, 0);
});

test('captured caller usage reports Professional limit at 200', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const s = shop('professional');
  const now = new Date('2026-05-06T12:00:00.000Z');
  for (let i = 0; i < 200; i += 1) {
    const requestId = `pro-req-${i}`;
    await callLogsRepository.createOrUpdateInboundCall({
      provider: 'telnyx_call_control',
      providerCallId: `pro-call-${i}`,
      shopId: s.id,
      callerPhone: '+15550000002',
      startedAt: now,
      requestId,
    });
    await callLogsRepository.updateStructuredSummary(s.id, requestId, { summaryNextAction: 'booking_created' });
  }
  const usage = await getShopUsageForPeriod({ callLogsRepository }, { shop: s, now });
  assert.equal(usage.capturedCallersUsed, 200);
  assert.equal(usage.overCapturedCallerLimit, true);
  assert.equal(usage.capturedCallersLimit, 200);
});
