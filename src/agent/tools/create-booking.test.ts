import test from 'node:test';
import assert from 'node:assert/strict';

import { createBookingTool } from '@/src/agent/tools/create-booking';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { BookingRecord } from '@/src/backend/ports/repositories';
import type { BookingInput, BookingResult, Shop } from '@/src/backend/domain/types';
import { SquareAppointmentsProvider } from '@/src/backend/services/calendar/square-appointments';

function createShop(provider: 'square_appointments' | 'manual' = 'square_appointments'): Shop {
  return {
    id: 'shop-test',
    name: 'Test Salon',
    phone_number: '+17145550000',
    user_phone: '+17145550001',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Haircut', duration_min: 45, price: 45 }],
    hours: {},
    cancel_policy: '24 hours',
    booking_url: null,
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'starter',
    active: true,
    google_cal_credentials_encrypted:
      provider === 'square_appointments'
        ? JSON.stringify({
            provider: 'square_appointments',
            accessToken: 'square-access-token',
            refreshToken: 'square-refresh-token',
            locationId: 'location-id',
            serviceVariationId: 'service-variation-id',
          })
        : null,
  };
}

function createContext(params?: {
  provider?: 'square_appointments' | 'manual';
  findTeamMemberByName?: (name: string) => Promise<string | null>;
  checkAvailability?: AgentToolContext['calendarProvider']['checkAvailability'];
  createBooking?: (input: BookingInput) => Promise<BookingResult>;
  enqueue?: (job: unknown) => Promise<void>;
}) {
  const createdInputs: BookingInput[] = [];
  const availabilityInputs: unknown[] = [];
  const enqueuedJobs: unknown[] = [];
  let findTeamMemberCalls = 0;
  const bookings = new Map<string, BookingRecord>();
  const createBooking = params?.createBooking ?? (async (input: BookingInput) => ({ bookingId: 'calendar-booking-123', confirmed: true }));

  const ctx: AgentToolContext = {
    shop: createShop(params?.provider ?? 'square_appointments'),
    callerPhone: '+15551234567',
    requestId: 'req-create-booking-test',
    roomName: 'room-create-booking-test',
    calendarProvider: {
      findTeamMemberByName: params?.findTeamMemberByName
        ? async (name: string) => {
            findTeamMemberCalls += 1;
            return params.findTeamMemberByName!(name);
          }
        : undefined,
      checkAvailability: async (input) => {
        availabilityInputs.push(input);
        if (params?.checkAvailability) return params.checkAvailability(input);
        return { available: true };
      },
      createBooking: async (input: BookingInput) => {
        createdInputs.push(input);
        return createBooking(input);
      },
    } as AgentToolContext['calendarProvider'],
    jobsRepository: {
      enqueue: async (job: unknown) => {
        enqueuedJobs.push(job);
        if (params?.enqueue) await params.enqueue(job);
      },
    } as unknown as AgentToolContext['jobsRepository'],
    bookingsRepository: {
      create: async (params: Parameters<AgentToolContext['bookingsRepository']['create']>[0]) => {
        const booking: BookingRecord = {
          id: 'local-booking-123',
          shopId: params.shopId,
          customerPhone: params.customerPhone,
          customerName: params.customerName ?? null,
          service: params.service,
          datetimeUtc: params.datetimeUtc,
          timezone: params.timezone,
          status: params.status,
          reminder24hSent: false,
          reminder2hSent: false,
          reviewRequestSent: false,
        };
        bookings.set(booking.id, booking);
        return booking;
      },
      updateDatetime: async () => {},
    } as unknown as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
  };

  return {
    ctx,
    createdInputs,
    availabilityInputs,
    enqueuedJobs,
    get findTeamMemberCalls() {
      return findTeamMemberCalls;
    },
  };
}

test('books with correct team member when found', async () => {
  const harness = createContext({
    findTeamMemberByName: async (name) => {
      assert.equal(name, 'Sarah');
      return 'team-member-id-123';
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    techName: 'Sarah',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('bookedWithTech' in result ? result.bookedWithTech : undefined, 'Sarah');
  assert.equal(harness.createdInputs[0]?.teamMemberId, 'team-member-id-123');
  assert.equal((harness.availabilityInputs[0] as { teamMemberId?: string })?.teamMemberId, 'team-member-id-123');
});

test('falls back when tech not found', async () => {
  const harness = createContext({
    findTeamMemberByName: async () => null,
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    techName: 'UnknownPerson',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal(harness.createdInputs.length, 1);
  assert.equal(harness.createdInputs[0]?.teamMemberId, undefined);
});

test('returns helpful message when tech unavailable', async () => {
  const harness = createContext({
    findTeamMemberByName: async () => 'team-member-id-123',
    checkAvailability: async () => ({ available: false }),
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    techName: 'Sarah',
  });

  assert.equal('techNotAvailable' in result && result.techNotAvailable, true);
  assert.match('message' in result && typeof result.message === 'string' ? result.message : '', /Sarah/);
  assert.equal(harness.createdInputs.length, 0);
});

test('non-square provider ignores techName lookup', async () => {
  const harness = createContext({
    provider: 'manual',
    findTeamMemberByName: async () => {
      throw new Error('should_not_be_called');
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    techName: 'Sarah',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal(harness.findTeamMemberCalls, 0);
  assert.equal(harness.createdInputs.length, 1);
});

test('square getTeamMembers returns empty on error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/v2/team-members')) {
      return new Response(JSON.stringify({ errors: [{ code: 'SERVER_ERROR' }] }), { status: 500 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  try {
    const provider = new SquareAppointmentsProvider(createShop('square_appointments'));
    const members = await provider.getTeamMembers();
    assert.deepEqual(members, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SMS confirmation enqueued after successful booking', async () => {
  const harness = createContext();

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.equal('success' in result && result.success, true);
  const confirmationJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'booking_confirmation_sms');
  assert.ok(confirmationJob);
  assert.equal((confirmationJob as { payload: { shopName?: string } }).payload.shopName, 'Test Salon');
  assert.equal((confirmationJob as { payload: { toPhone?: string } }).payload.toPhone, '+15551234567');
});

test('SMS confirmation enqueue failure does not break booking', async () => {
  const harness = createContext({
    enqueue: async (job) => {
      if ((job as { type?: string }).type === 'booking_confirmation_sms') {
        throw new Error('queue_down');
      }
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.equal('success' in result && result.success, true);
});
