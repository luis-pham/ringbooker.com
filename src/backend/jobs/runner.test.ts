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
import { createJobHandlers } from '@/src/backend/jobs/runner';

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
