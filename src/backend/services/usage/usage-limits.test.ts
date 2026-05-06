import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryShopActiveCallSessionsRepository } from '@/src/backend/adapters/memory/shop-active-call-sessions-repository';
import { getPlanUsageLimits } from '@/src/backend/domain/plan-usage-limits';
import type { Shop } from '@/src/backend/domain/types';
import { isCapturedCaller } from '@/src/backend/services/usage/captured-caller';
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

test('getPlanUsageLimits returns Starter and Professional limits', () => {
  assert.deepEqual(getPlanUsageLimits('starter'), {
    capturedCallersMonthlyLimit: 100,
    softVoiceMinutesMonthlyLimit: 200,
    maxConcurrentLiveCalls: 1,
    maxCallDurationSeconds: 480,
    softWarningAfterSeconds: 300,
    isCustom: false,
  });
  assert.equal(getPlanUsageLimits('professional').capturedCallersMonthlyLimit, 300);
  assert.equal(getPlanUsageLimits('professional').maxConcurrentLiveCalls, 2);
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
  assert.equal(limits.softVoiceMinutesMonthlyLimit, 2400);
  assert.equal(limits.maxConcurrentLiveCalls, 8);
  assert.equal(limits.maxCallDurationSeconds, 1500);
});

test('isCapturedCaller includes useful production calls and excludes demo/test/missed calls', () => {
  assert.equal(isCapturedCaller({ provider: 'telnyx_call_control', summaryServiceRequest: 'gel manicure' }), true);
  assert.equal(isCapturedCaller({ provider: 'telnyx_call_control', summaryNextAction: 'callback_scheduled' }), true);
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

test('captured caller usage reports Professional limit at 300', async () => {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const s = shop('professional');
  const now = new Date('2026-05-06T12:00:00.000Z');
  for (let i = 0; i < 300; i += 1) {
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
  assert.equal(usage.capturedCallersUsed, 300);
  assert.equal(usage.overCapturedCallerLimit, true);
  assert.equal(usage.capturedCallersLimit, 300);
});
