import test from 'node:test';
import assert from 'node:assert/strict';

import { sendBookingLinkTool } from '@/src/agent/tools/send-booking-link';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';

function createShop(overrides?: Partial<Shop>): Shop {
  return {
    id: 'shop-test',
    name: 'Test Salon',
    phone_number: '+17145550000',
    user_phone: '+17145550001',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '24 hours',
    booking_url: null,
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan: 'starter',
    active: true,
    ...overrides,
  };
}

function createContext(params?: { shop?: Shop; enqueueImpl?: (job: unknown) => Promise<void> }) {
  const enqueuedJobs: unknown[] = [];
  const enqueue = async (job: unknown) => {
    enqueuedJobs.push(job);
    if (params?.enqueueImpl) {
      await params.enqueueImpl(job);
    }
  };

  const ctx: AgentToolContext = {
    shop: params?.shop ?? createShop(),
    callerPhone: '+15550000000',
    requestId: 'req-send-booking-link-test',
    roomName: 'room-send-booking-link-test',
    calendarProvider: {} as AgentToolContext['calendarProvider'],
    jobsRepository: { enqueue } as AgentToolContext['jobsRepository'],
    bookingsRepository: {} as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
  };

  return { ctx, enqueuedJobs };
}

test('returns error when no booking URL configured', async () => {
  const { ctx, enqueuedJobs } = createContext({
    shop: createShop({ booking_url: null }),
  });

  const result = await sendBookingLinkTool(ctx, {
    callerPhone: '+15551234567',
  });

  assert.deepEqual(result, {
    success: false,
    message: 'No booking link configured for this business. Ask the caller to contact the business directly.',
  });
  assert.equal(enqueuedJobs.length, 0);
});

test('enqueues job when booking URL exists', async () => {
  const { ctx, enqueuedJobs } = createContext({
    shop: createShop({
      name: 'Test Salon',
      booking_url: 'https://glossgenius.com/test',
    }),
  });

  const result = await sendBookingLinkTool(ctx, {
    callerPhone: '+15551234567',
    callerName: 'Jane',
    serviceInterest: 'haircut',
  });

  if (!('success' in result)) {
    assert.fail('Expected success response, got tool error');
  }
  assert.equal(result.success, true);
  assert.equal(enqueuedJobs.length, 1);

  const job = enqueuedJobs[0] as {
    type: string;
    payload: { toPhone: string; bookingUrl: string; message: string };
  };
  assert.equal(job.type, 'booking_link_sms');
  assert.equal(job.payload.toPhone, '+15551234567');
  assert.equal(job.payload.bookingUrl, 'https://glossgenius.com/test');
  assert.match(job.payload.message, /Jane/);
  assert.match(job.payload.message, /haircut/);
  assert.match(job.payload.message, /https:\/\/glossgenius\.com\/test/);
});

test('sends SMS without callerName or serviceInterest', async () => {
  const { ctx, enqueuedJobs } = createContext({
    shop: createShop({
      booking_url: 'https://glossgenius.com/test',
    }),
  });

  const result = await sendBookingLinkTool(ctx, {
    callerPhone: '+15551234567',
  });

  if (!('success' in result)) {
    assert.fail('Expected success response, got tool error');
  }
  assert.equal(result.success, true);
  assert.equal(enqueuedJobs.length, 1);

  const job = enqueuedJobs[0] as { payload: { message: string } };
  assert.match(job.payload.message, /there/);
  assert.match(job.payload.message, /appointment/);
});
