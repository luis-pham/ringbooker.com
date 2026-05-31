import test from 'node:test';
import assert from 'node:assert/strict';

import { createBookingTool } from '@/src/agent/tools/create-booking';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { BookingRecord } from '@/src/backend/ports/repositories';
import type { BookingInput, BookingResult, Shop } from '@/src/backend/domain/types';
import { SquareAppointmentsProvider } from '@/src/backend/services/booking-providers/square';

function createShop(provider: 'square_appointments' | 'manual' | 'mindbody' | 'acuity' = 'square_appointments'): Shop {
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
    selected_integration: provider === 'manual' ? null : provider,
    google_cal_credentials_encrypted:
      provider === 'square_appointments'
        ? JSON.stringify({
            provider: 'square_appointments',
            access_token: 'square-access-token',
            refresh_token: 'square-refresh-token',
            location_id: 'location-id',
            service_variation_id: 'service-variation-id',
          })
        : null,
    integration_credentials_encrypted:
      provider === 'mindbody'
        ? JSON.stringify({
            provider: 'mindbody',
            siteId: '12345',
            apiKey: 'mb-api-key',
          })
        : provider === 'acuity'
          ? JSON.stringify({
              provider: 'acuity',
              userId: 'acuity-user',
              apiKey: 'acuity-key',
              appointmentTypeId: '100',
            })
        : null,
  };
}

function createContext(params?: {
  provider?: 'square_appointments' | 'manual' | 'mindbody' | 'acuity';
  shop?: Partial<Shop>;
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
    shop: { ...createShop(params?.provider ?? 'square_appointments'), ...params?.shop },
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
          provider: params.provider ?? null,
          providerStatus: params.providerStatus ?? null,
          providerErrorReason: params.providerErrorReason ?? null,
          callLogId: params.callLogId ?? null,
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
    customersRepository: {
      isSmsConsented: async () => true,
      isSmsOptedOut: async () => false,
      setSmsConsent: async () => {},
      setSmsOptOut: async () => {},
      setPlatformSmsOptOut: async () => {},
      upsert: async (customer: never) => customer,
    } as AgentToolContext['customersRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
  };

  return {
    ctx,
    createdInputs,
    availabilityInputs,
    enqueuedJobs,
    bookings,
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

test('manual provider with booking URL rejects direct create_booking', async () => {
  const harness = createContext({
    provider: 'manual',
    shop: { booking_url: 'https://glossgenius.com/test' },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.deepEqual(result, {
    error: 'This shop uses a booking link. Use the send_booking_link tool instead of creating a booking directly.',
    code: 'BOOKING_LINK_PROVIDER',
    retryable: false,
  });
  assert.equal(harness.createdInputs.length, 0);
  assert.equal(harness.bookings.size, 0);
});

test('Vagaro live sync with booking URL rejects direct create_booking before provider call', async () => {
  const harness = createContext({
    provider: 'manual',
    shop: {
      booking_url: 'https://vagaro.com/test-salon',
      booking_method: 'app',
      selected_integration: 'vagaro',
      vagaro_mode: 'live_sync',
      vagaro_connection_status: 'connected',
      vagaro_business_id: 'vagaro-business-id',
      vagaro_region: 'usa03',
      vagaro_client_id: 'vagaro-client-id',
      vagaro_client_secret_encrypted: 'encrypted-secret',
    },
    createBooking: async () => {
      throw new Error('vagaro_create_booking_should_not_be_called');
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.deepEqual(result, {
    error: 'This salon uses an external booking system. Use send_booking_link to text the caller a booking link instead of creating a booking directly.',
    code: 'BOOKING_LINK_PROVIDER',
    retryable: false,
  });
  assert.equal(harness.createdInputs.length, 0);
  assert.equal(harness.bookings.size, 0);
});

test('rejects booking outside configured business hours before provider call', async () => {
  const harness = createContext({
    shop: {
      hours: {
        monday: { open: '09:00', close: '17:00' },
      },
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-05',
    time: '05:00',
    service: 'Haircut',
  });

  assert.deepEqual(result, {
    error:
      'The requested appointment time is outside the shop business hours. Do not say it is booked, confirmed, scheduled, or available. Ask for a time during business hours or offer to record the request for the shop to confirm.',
    code: 'OUTSIDE_BUSINESS_HOURS',
    retryable: false,
  });
  assert.equal(harness.createdInputs.length, 0);
  assert.equal(harness.bookings.size, 0);
});

test('uses canonical service from service catalog when creating booking', async () => {
  const harness = createContext({
    shop: {
      service_catalog: {
        categories: [
          {
            id: 'cat-hair',
            shopId: 'shop-test',
            name: 'Hair',
            sortOrder: 0,
            active: true,
          },
        ],
        services: [
          {
            id: 'svc-balayage',
            shopId: 'shop-test',
            categoryId: 'cat-hair',
            name: 'Balayage Color',
            durationText: '120 min',
            durationMinutes: 120,
            priceAmount: 180,
            priceCurrency: 'USD',
            priceType: 'from',
            bookable: true,
            active: true,
            sortOrder: 0,
            aliases: ['balayage'],
            variants: [],
          },
        ],
      },
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-05',
    time: '10:00',
    service: 'balayage',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal(harness.createdInputs[0]?.service, 'Balayage Color');
  assert.equal(harness.createdInputs[0]?.durationMin, 120);
  assert.equal(harness.createdInputs[0]?.matchedServiceId, 'svc-balayage');
  assert.equal(harness.createdInputs[0]?.matchedServiceConfidence, 0.96);
});

test('rejects unknown service before provider call', async () => {
  const harness = createContext({
    shop: {
      service_catalog: {
        categories: [
          {
            id: 'cat-hair',
            shopId: 'shop-test',
            name: 'Hair',
            sortOrder: 0,
            active: true,
          },
        ],
        services: [
          {
            id: 'svc-haircut',
            shopId: 'shop-test',
            categoryId: 'cat-hair',
            name: 'Haircut',
            durationText: '45 min',
            durationMinutes: 45,
            priceAmount: 45,
            priceCurrency: 'USD',
            priceType: 'fixed',
            bookable: true,
            active: true,
            sortOrder: 0,
            aliases: [],
            variants: [],
          },
        ],
      },
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-05',
    time: '10:00',
    service: 'Oil change',
  });

  assert.equal('error' in result, true);
  assert.equal('code' in result ? result.code : undefined, 'UNKNOWN_SERVICE');
  assert.equal(harness.createdInputs.length, 0);
  assert.equal(harness.bookings.size, 0);
});

test('manual provider without booking URL still creates pending request', async () => {
  const harness = createContext({
    provider: 'manual',
    createBooking: async (input) => ({ bookingId: `manual-${input.idempotencyKey}`, confirmed: false }),
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('confirmed' in result ? result.confirmed : true, false);
  const saved = harness.bookings.get('local-booking-123');
  assert.equal(saved?.status, 'pending');
  assert.equal(saved?.callLogId, harness.ctx.requestId);
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

test('Square provider failure creates pending request and does not claim confirmation', async () => {
  const harness = createContext({
    provider: 'square_appointments',
    shop: {
      sms_owner_opted_in: true,
      user_phone: '+17145550001',
    },
    createBooking: async () => {
      throw new Error('square_create_booking_failed:temporary_down');
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    customerName: 'Alex',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('confirmed' in result ? result.confirmed : undefined, false);

  const saved = harness.bookings.get('local-booking-123');
  assert.equal(saved?.status, 'pending');
  assert.equal(saved?.provider, 'square_appointments');
  assert.equal(saved?.providerStatus, 'provider_failed');
  assert.match(saved?.providerErrorReason ?? '', /square_create_booking_failed/);

  const confirmationJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'booking_confirmation_sms') as
    | { payload?: { confirmed?: boolean } }
    | undefined;
  assert.equal(confirmationJob?.payload?.confirmed, false);
  assert.ok(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'new_booking_request_owner_alert'));
});

test('Mindbody request-only booking creates pending request and owner alert without confirmed claim', async () => {
  const harness = createContext({
    provider: 'mindbody',
    shop: {
      sms_owner_opted_in: true,
      user_phone: '+17145550001',
    },
    createBooking: async () => ({ bookingId: 'mindbody-request-123', confirmed: false }),
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    customerName: 'Alex',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('confirmed' in result ? result.confirmed : undefined, false);
  assert.doesNotMatch('message' in result ? result.message ?? '' : '', /confirmed|booked/i);

  const saved = harness.bookings.get('local-booking-123');
  assert.equal(saved?.status, 'pending');

  const confirmationJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'booking_confirmation_sms') as
    | { payload?: { confirmed?: boolean } }
    | undefined;
  assert.equal(confirmationJob?.payload?.confirmed, false);

  const ownerAlertJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'new_booking_request_owner_alert');
  assert.ok(ownerAlertJob);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'appointment_reminder_24h'), false);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'appointment_reminder_2h'), false);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'review_request_sms'), false);
});

test('Acuity fallback booking creates pending request and owner alert without confirmed claim', async () => {
  const harness = createContext({
    provider: 'acuity',
    shop: {
      sms_owner_opted_in: true,
      user_phone: '+17145550001',
    },
    createBooking: async () => ({
      bookingId: 'acuity-request-123',
      confirmed: false,
      providerStatus: 'provider_failed',
      providerErrorReason: 'acuity_request_failed:400:Required field missing',
    }),
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    customerName: 'Alex',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('confirmed' in result ? result.confirmed : undefined, false);
  assert.doesNotMatch('message' in result ? result.message ?? '' : '', /confirmed|booked/i);

  const saved = harness.bookings.get('local-booking-123');
  assert.equal(saved?.status, 'pending');
  assert.equal(saved?.provider, 'acuity');
  assert.equal(saved?.providerStatus, 'provider_failed');
  assert.match(saved?.providerErrorReason ?? '', /acuity_request_failed/);

  const confirmationJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'booking_confirmation_sms') as
    | { payload?: { confirmed?: boolean } }
    | undefined;
  assert.equal(confirmationJob?.payload?.confirmed, false);
  assert.ok(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'new_booking_request_owner_alert'));
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'appointment_reminder_24h'), false);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'appointment_reminder_2h'), false);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'review_request_sms'), false);
});

test('Acuity missing mapping fallback saves missing_mapping and request SMS flag', async () => {
  const harness = createContext({
    provider: 'acuity',
    createBooking: async () => ({
      bookingId: 'acuity-request-missing-map',
      confirmed: false,
      providerStatus: 'missing_mapping',
      providerErrorReason: 'missing_service_mapping',
    }),
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    customerName: 'Alex',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('confirmed' in result ? result.confirmed : undefined, false);
  const saved = harness.bookings.get('local-booking-123');
  assert.equal(saved?.status, 'pending');
  assert.equal(saved?.providerStatus, 'missing_mapping');

  const confirmationJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'booking_confirmation_sms') as
    | { payload?: { confirmed?: boolean } }
    | undefined;
  assert.equal(confirmationJob?.payload?.confirmed, false);
  assert.ok(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'new_booking_request_owner_alert'));
});

test('Acuity confirmed booking can send confirmed SMS only when provider confirms', async () => {
  const harness = createContext({
    provider: 'acuity',
    createBooking: async () => ({ bookingId: 'acuity-98765', calendarEventId: '98765', confirmed: true, providerStatus: 'provider_confirmed' }),
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
    customerName: 'Alex',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal('confirmed' in result ? result.confirmed : undefined, true);
  const saved = harness.bookings.get('local-booking-123');
  assert.equal(saved?.status, 'confirmed');
  assert.equal(saved?.provider, 'acuity');
  assert.equal(saved?.providerStatus, 'provider_confirmed');

  const confirmationJob = harness.enqueuedJobs.find((job) => (job as { type?: string }).type === 'booking_confirmation_sms') as
    | { payload?: { confirmed?: boolean } }
    | undefined;
  assert.equal(confirmationJob?.payload?.confirmed, true);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'new_booking_request_owner_alert'), false);
});

test('Starter does not enqueue reminder jobs even when reminder flag is true', async () => {
  const harness = createContext({
    shop: {
      plan: 'starter',
      send_reminder_sms: true,
      send_review_request_sms: false,
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'appointment_reminder_24h'), false);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'appointment_reminder_2h'), false);
});

test('Starter does not enqueue review request SMS even when review flag is true', async () => {
  const harness = createContext({
    shop: {
      plan: 'starter',
      send_reminder_sms: false,
      send_review_request_sms: true,
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.equal('success' in result && result.success, true);
  assert.equal(harness.enqueuedJobs.some((job) => (job as { type?: string }).type === 'review_request_sms'), false);
});

test('Professional enqueues reminder and review SMS jobs when flags are true', async () => {
  const harness = createContext({
    shop: {
      plan: 'professional',
      send_reminder_sms: true,
      send_review_request_sms: true,
    },
  });

  const result = await createBookingTool(harness.ctx, {
    date: '2099-01-02',
    time: '10:00',
    service: 'Haircut',
  });

  assert.equal('success' in result && result.success, true);
  const jobTypes = harness.enqueuedJobs.map((job) => (job as { type?: string }).type);
  assert.ok(jobTypes.includes('appointment_reminder_24h'));
  assert.ok(jobTypes.includes('appointment_reminder_2h'));
  assert.ok(jobTypes.includes('review_request_sms'));
});
