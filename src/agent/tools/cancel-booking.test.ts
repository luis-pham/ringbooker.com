import test from 'node:test';
import assert from 'node:assert/strict';

import { cancelBookingTool } from '@/src/agent/tools/cancel-booking';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';
import type { CalendarProviderId } from '@/src/backend/services/calendar/provider-catalog';

function createShop(providerId: CalendarProviderId, overrides?: Partial<Shop>): Shop {
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
    google_cal_credentials_encrypted: providerId === 'manual' ? null : JSON.stringify({ provider: providerId }),
    ...overrides,
  };
}

function createContext(params: {
  providerId: CalendarProviderId;
  cancelBooking?: AgentToolContext['calendarProvider']['cancelBooking'];
}) {
  const enqueuedJobs: unknown[] = [];
  const cancelBooking = params.cancelBooking ?? (async () => {});
  const ctx: AgentToolContext = {
    shop: createShop(params.providerId),
    callerPhone: '+15550000000',
    requestId: 'req-cancel-booking-test',
    roomName: 'room-cancel-booking-test',
    calendarProvider: {
      cancelBooking,
    } as AgentToolContext['calendarProvider'],
    jobsRepository: {
      enqueue: async (job: unknown) => {
        enqueuedJobs.push(job);
      },
    } as AgentToolContext['jobsRepository'],
    bookingsRepository: {} as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
  };
  return { ctx, enqueuedJobs };
}

test('square cancels successfully', async () => {
  let cancelCalled = false;
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'square_appointments',
    cancelBooking: async () => {
      cancelCalled = true;
    },
  });

  const result = await cancelBookingTool(ctx, {
    bookingId: 'booking-123',
  });

  assert.equal(cancelCalled, true);
  assert.equal(enqueuedJobs.length, 0);
  assert.equal('success' in result && result.success, true);
  assert.equal('cancelled' in result && result.cancelled, true);
  assert.match('message' in result ? result.message : '', /cancelled/i);
});

test('square API fails and notifies shop', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'square_appointments',
    cancelBooking: async () => {
      throw new Error('square_down');
    },
  });

  const result = await cancelBookingTool(ctx, {
    bookingId: 'booking-123',
  });

  assert.equal('success' in result && result.success, false);
  assert.equal('cancelled' in result && result.cancelled, false);
  assert.match('message' in result ? result.message : '', /confirm with you shortly/i);
  assert.equal(enqueuedJobs.length, 1);
  assert.equal((enqueuedJobs[0] as { type: string }).type, 'cancellation_request_alert');
});

test('square without bookingId notifies shop', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'square_appointments',
  });

  const result = await cancelBookingTool(ctx, {});

  assert.equal('success' in result && result.success, false);
  assert.equal('cancelled' in result && result.cancelled, false);
  assert.equal(enqueuedJobs.length, 1);
  assert.equal((enqueuedJobs[0] as { type: string }).type, 'cancellation_request_alert');
});

test('glossgenius returns email instructions', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'glossgenius',
  });

  const result = await cancelBookingTool(ctx, {});

  assert.equal('canSelfCancel' in result && result.canSelfCancel, true);
  assert.match('message' in result ? result.message : '', /confirmation email/i);
  assert.equal(enqueuedJobs.length, 1);
});

test('fresha returns email instructions', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'fresha',
  });

  const result = await cancelBookingTool(ctx, {});

  assert.equal('canSelfCancel' in result && result.canSelfCancel, true);
  assert.match('message' in result ? result.message : '', /confirmation email/i);
  assert.equal(enqueuedJobs.length, 1);
});

test('booksy returns app instructions', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'booksy',
  });

  const result = await cancelBookingTool(ctx, {});

  assert.equal('canSelfCancel' in result && result.canSelfCancel, true);
  assert.match('message' in result ? result.message : '', /Booksy/);
  assert.equal(enqueuedJobs.length, 1);
});

test('vagaro returns app instructions', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'vagaro',
  });

  const result = await cancelBookingTool(ctx, {});

  assert.equal('canSelfCancel' in result && result.canSelfCancel, true);
  assert.match('message' in result ? result.message : '', /Vagaro/);
  assert.equal(enqueuedJobs.length, 1);
});

test('manual captures intent only', async () => {
  const { ctx, enqueuedJobs } = createContext({
    providerId: 'manual',
  });

  const result = await cancelBookingTool(ctx, {});

  assert.equal('canSelfCancel' in result && result.canSelfCancel, false);
  assert.match('message' in result ? result.message : '', /confirm the cancellation/i);
  assert.equal(enqueuedJobs.length, 1);
  assert.equal((enqueuedJobs[0] as { type: string }).type, 'cancellation_request_alert');
});
