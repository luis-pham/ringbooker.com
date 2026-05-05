import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryOutboundMessagesRepository } from '@/src/backend/adapters/memory/outbound-messages-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryTestCallAttemptsRepository } from '@/src/backend/adapters/memory/test-call-attempts-repository';
import type { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { createJobHandlers } from '@/src/backend/jobs/runner';
import { JobExecutionError } from '@/src/backend/jobs/worker';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

function createRuntime() {
  const sentSms: unknown[] = [];
  const runtime = {
    agentTransportMode: 'mock',
    commProvider: 'noop',
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    outboundMessagesRepository: new InMemoryOutboundMessagesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    testCallAttemptsRepository: new InMemoryTestCallAttemptsRepository(),
    smsService: {
      sendSms: async (params: unknown) => {
        sentSms.push(params);
        return { providerMessageId: `msg-${sentSms.length}` };
      },
    },
    telephonyService: {},
    realtimeAgentRuntime: {},
  } as unknown as ReturnType<typeof getBackendRuntime>;

  return { runtime, sentSms };
}

test('runner skips appointment reminder SMS for Starter even if job exists', async () => {
  const { runtime, sentSms } = createRuntime();
  await runtime.shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter', active: true });
  await runtime.shopsRepository.updateDynamicConfig('demo-shop', { send_reminder_sms: true });
  const booking = await runtime.bookingsRepository.create({
    id: 'booking-starter-reminder',
    shopId: 'demo-shop',
    customerPhone: '+15551234567',
    service: 'Haircut',
    datetimeUtc: '2099-01-02T18:00:00.000Z',
    timezone: 'America/Los_Angeles',
    status: 'confirmed',
  });

  const handlers = createJobHandlers(runtime);
  await handlers.appointment_reminder_24h!({
    jobId: 'job-reminder-starter',
    shopId: 'demo-shop',
    payload: { bookingId: booking.id },
    attemptCount: 1,
  });

  assert.equal(sentSms.length, 0);
  const updated = await runtime.bookingsRepository.findById(booking.id);
  assert.equal(updated?.reminder24hSent, true);
});

test('runner skips review request SMS for Starter even if job exists', async () => {
  const { runtime, sentSms } = createRuntime();
  await runtime.shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter', active: true });
  await runtime.shopsRepository.updateDynamicConfig('demo-shop', { send_review_request_sms: true });
  const booking = await runtime.bookingsRepository.create({
    id: 'booking-starter-review',
    shopId: 'demo-shop',
    customerPhone: '+15551234567',
    service: 'Haircut',
    datetimeUtc: '2099-01-02T18:00:00.000Z',
    timezone: 'America/Los_Angeles',
    status: 'confirmed',
  });

  const handlers = createJobHandlers(runtime);
  await handlers.review_request_sms!({
    jobId: 'job-review-starter',
    shopId: 'demo-shop',
    payload: { bookingId: booking.id },
    attemptCount: 1,
  });

  assert.equal(sentSms.length, 0);
  const updated = await runtime.bookingsRepository.findById(booking.id);
  assert.equal(updated?.reviewRequestSent, true);
});

test('runner skips missed-call follow-up SMS when billing access is blocked', async () => {
  const { runtime, sentSms } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'No Subscription Salon',
    phone_number: '+15550000001',
    user_phone: '+15550000002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });

  const handlers = createJobHandlers(runtime);
  await handlers.missed_call_followup_sms!({
    jobId: 'job-missed-billing-blocked',
    shopId: shop.id,
    payload: { customerPhone: '+15551234567' },
    attemptCount: 1,
  });

  assert.equal(sentSms.length, 0);
});

test('callback_outbound_call uses shared outbound caller id (not shop.phone_number)', async () => {
  const outboundCalls: Array<{ from?: string; to?: string }> = [];
  const { runtime } = createRuntime();
  Object.assign(runtime, {
    telephonyService: {
      createOutboundCall: async (params: { from: string; to: string }) => {
        outboundCalls.push(params);
        return { providerCallId: undefined as undefined };
      },
    },
  });

  const shop = await runtime.shopsRepository.create({
    name: 'Callback Shop',
    phone_number: '+17145559999',
    user_phone: '+17145559998',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });

  const callback = await runtime.callbacksRepository.create({
    shopId: shop.id,
    customerPhone: '+15551234567',
    customerName: 'Alex',
    reason: 'Test callback',
  });

  const handlers = createJobHandlers(runtime);
  await handlers.callback_outbound_call!({
    jobId: 'job-callback-outbound',
    shopId: shop.id,
    payload: { callbackId: callback.id },
    attemptCount: 1,
  });

  assert.equal(outboundCalls.length, 1);
  assert.equal(outboundCalls[0]?.to, '+15551234567');
  assert.equal(outboundCalls[0]?.from, process.env.RINGBOOKER_OUTBOUND_CALLER_ID);
  assert.notEqual(outboundCalls[0]?.from, shop.phone_number);

  const updated = await runtime.callbacksRepository.findById(callback.id);
  assert.equal(updated?.status, 'completed');
});

test('callback_outbound_call skips telephony when outbound caller id is not configured', async () => {
  const outboundCalls: unknown[] = [];
  const prevRing = process.env.RINGBOOKER_OUTBOUND_CALLER_ID;
  const prevTelnyx = process.env.TELNYX_OUTBOUND_CALLER_ID;
  delete process.env.RINGBOOKER_OUTBOUND_CALLER_ID;
  delete process.env.TELNYX_OUTBOUND_CALLER_ID;
  resetEnvCacheForTests();

  try {
    const { runtime } = createRuntime();
    Object.assign(runtime, {
      telephonyService: {
        createOutboundCall: async (params: unknown) => {
          outboundCalls.push(params);
          return { providerCallId: undefined as undefined };
        },
      },
    });

    const shop = await runtime.shopsRepository.create({
      name: 'No CID Shop',
      phone_number: '+17145558888',
      user_phone: '+17145558887',
      timezone: 'America/Los_Angeles',
      plan: 'professional',
      active: true,
    });

    const callback = await runtime.callbacksRepository.create({
      shopId: shop.id,
      customerPhone: '+15559876543',
      reason: 'Test',
    });

    const handlers = createJobHandlers(runtime);
    await assert.rejects(
      () =>
        handlers.callback_outbound_call!({
          jobId: 'job-no-cid',
          shopId: shop.id,
          payload: { callbackId: callback.id },
          attemptCount: 1,
        }),
      (err: unknown) => err instanceof JobExecutionError && err.message === 'outbound_caller_id_not_configured',
    );

    assert.equal(outboundCalls.length, 0);
    const updated = await runtime.callbacksRepository.findById(callback.id);
    assert.equal(updated?.status, 'failed');
  } finally {
    if (prevRing !== undefined) process.env.RINGBOOKER_OUTBOUND_CALLER_ID = prevRing;
    else delete process.env.RINGBOOKER_OUTBOUND_CALLER_ID;
    if (prevTelnyx !== undefined) process.env.TELNYX_OUTBOUND_CALLER_ID = prevTelnyx;
    else delete process.env.TELNYX_OUTBOUND_CALLER_ID;
    resetEnvCacheForTests();
    applyRequiredTestEnv();
  }
});
