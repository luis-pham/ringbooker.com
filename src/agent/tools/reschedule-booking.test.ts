import test from 'node:test';
import assert from 'node:assert/strict';

import { rescheduleBookingTool } from '@/src/agent/tools/reschedule-booking';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';
import type { CalendarProviderId } from '@/src/backend/services/calendar/provider-catalog';

function createShop(providerId: CalendarProviderId): Shop {
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
  };
}

function createContext(params: {
  providerId: CalendarProviderId;
  rescheduleBooking?: AgentToolContext['calendarProvider']['rescheduleBooking'];
  updateDatetime?: AgentToolContext['bookingsRepository']['updateDatetime'];
}) {
  const enqueuedJobs: unknown[] = [];
  const updateDatetimeCalls: Array<{ bookingId: string; newDatetimeUtc: Date }> = [];
  const rescheduleBooking =
    params.rescheduleBooking ??
    (async () => ({
      bookingId: 'booking-123',
      calendarEventId: 'calendar-event-123',
      confirmed: true,
    }));

  const ctx: AgentToolContext = {
    shop: createShop(params.providerId),
    callerPhone: '+15550000000',
    requestId: 'req-reschedule-booking-test',
    roomName: 'room-reschedule-booking-test',
    calendarProvider: {
      rescheduleBooking,
    } as AgentToolContext['calendarProvider'],
    jobsRepository: {
      enqueue: async (job: unknown) => {
        enqueuedJobs.push(job);
      },
    } as AgentToolContext['jobsRepository'],
    bookingsRepository: {
      updateDatetime: async (bookingId: string, newDatetimeUtc: Date) => {
        updateDatetimeCalls.push({ bookingId, newDatetimeUtc });
        if (params.updateDatetime) await params.updateDatetime(bookingId, newDatetimeUtc);
      },
    } as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
  };

  return { ctx, enqueuedJobs, updateDatetimeCalls };
}

test('Square reschedule updates local DB', async () => {
  const harness = createContext({ providerId: 'square_appointments' });

  const result = await rescheduleBookingTool(harness.ctx, {
    bookingId: 'booking-123',
    newDate: '2099-01-02',
    newTime: '10:00',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal(harness.updateDatetimeCalls.length, 1);
  assert.equal(harness.updateDatetimeCalls[0]?.bookingId, 'booking-123');
  assert.ok(harness.updateDatetimeCalls[0]?.newDatetimeUtc instanceof Date);
});

test('local DB failure does not break reschedule', async () => {
  const harness = createContext({
    providerId: 'square_appointments',
    updateDatetime: async () => {
      throw new Error('db_down');
    },
  });

  const result = await rescheduleBookingTool(harness.ctx, {
    bookingId: 'booking-123',
    newDate: '2099-01-02',
    newTime: '10:00',
  });

  assert.equal('success' in result && result.success, true);
});

test('GlossGenius returns email instructions', async () => {
  const harness = createContext({ providerId: 'glossgenius' });

  const result = await rescheduleBookingTool(harness.ctx, {
    bookingId: 'booking-123',
    currentDateTime: '2099-01-01 09:00',
    newDate: '2099-01-02',
    newTime: '10:00',
  });

  assert.equal('canSelfReschedule' in result && result.canSelfReschedule, true);
  assert.match('message' in result ? result.message : '', /confirmation email/i);
  assert.equal(enqueuedType(harness.enqueuedJobs[0]), 'cancellation_request_alert');
});

test('Booksy returns app instructions', async () => {
  const harness = createContext({ providerId: 'booksy' });

  const result = await rescheduleBookingTool(harness.ctx, {
    bookingId: 'booking-123',
    currentDateTime: '2099-01-01 09:00',
    newDate: '2099-01-02',
    newTime: '10:00',
  });

  assert.equal('canSelfReschedule' in result && result.canSelfReschedule, true);
  assert.match('message' in result ? result.message : '', /Booksy/);
  assert.equal(enqueuedType(harness.enqueuedJobs[0]), 'cancellation_request_alert');
});

test('Vagaro returns app instructions', async () => {
  const harness = createContext({ providerId: 'vagaro' });

  const result = await rescheduleBookingTool(harness.ctx, {
    bookingId: 'booking-123',
    currentDateTime: '2099-01-01 09:00',
    newDate: '2099-01-02',
    newTime: '10:00',
  });

  assert.equal('canSelfReschedule' in result && result.canSelfReschedule, true);
  assert.match('message' in result ? result.message : '', /Vagaro/);
  assert.equal(enqueuedType(harness.enqueuedJobs[0]), 'cancellation_request_alert');
});

test('Manual captures intent only', async () => {
  const harness = createContext({ providerId: 'manual' });

  const result = await rescheduleBookingTool(harness.ctx, {
    bookingId: 'booking-123',
    currentDateTime: '2099-01-01 09:00',
    newDate: '2099-01-02',
    newTime: '10:00',
  });

  assert.equal('canSelfReschedule' in result && result.canSelfReschedule, false);
  assert.match('message' in result ? result.message : '', /confirm the new time/i);
  assert.equal(enqueuedType(harness.enqueuedJobs[0]), 'cancellation_request_alert');
});

function enqueuedType(job: unknown): string | undefined {
  return (job as { type?: string } | undefined)?.type;
}
