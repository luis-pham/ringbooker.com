import test from 'node:test';
import assert from 'node:assert/strict';

import type { BookingInput, Shop } from '@/src/backend/domain/types';
import { SquareAppointmentsProvider } from '@/src/backend/services/booking-providers/square';

function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-square-test',
    name: 'Square Test Salon',
    vertical: 'hair_salon',
    phone_number: '+15550000000',
    user_phone: '+15550000001',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Haircut', duration_min: 45, price: 50 }],
    hours: {},
    cancel_policy: '24 hours',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
    google_cal_credentials_encrypted: JSON.stringify({
      provider: 'square_appointments',
      accessToken: 'square-access-token',
      refreshToken: 'square-refresh-token',
      locationId: 'LOC_TEST',
    }),
    ...overrides,
  };
}

function bookingInput(overrides: Partial<BookingInput> = {}): BookingInput {
  return {
    shopId: 'shop-square-test',
    customerPhone: '+15551234567',
    customerName: 'Alex',
    service: 'Haircut',
    datetimeIso: '2099-01-02T18:00:00.000Z',
    timezone: 'America/Los_Angeles',
    durationMin: 45,
    source: 'inbound_call',
    idempotencyKey: 'booking:test',
    ...overrides,
  };
}

test('Square createBooking uses matched service externalServiceId before credential fallback', async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, body });
    if (url.includes('/v2/customers/search')) {
      return new Response(JSON.stringify({ customers: [{ id: 'customer-1' }] }), { status: 200 });
    }
    if (url.endsWith('/v2/bookings')) {
      return new Response(JSON.stringify({ booking: { id: 'booking-1', status: 'ACCEPTED' } }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  try {
    const provider = new SquareAppointmentsProvider(
      buildShop({
        service_catalog: {
          categories: [{ id: 'cat-cuts', shopId: 'shop-square-test', name: 'Cuts', sortOrder: 0, active: true }],
          services: [
            {
              id: 'svc-haircut',
              shopId: 'shop-square-test',
              categoryId: 'cat-cuts',
              name: 'Haircut',
              durationMinutes: 45,
              priceAmount: 50,
              priceCurrency: 'USD',
              priceType: 'fixed',
              bookable: true,
              active: true,
              sortOrder: 0,
              aliases: [],
              variants: [],
              externalProvider: 'square',
              externalServiceId: 'SV_HAIRCUT',
              externalMetadata: { variation_version: 12 },
            },
          ],
        },
      }),
    );

    await provider.createBooking(bookingInput({ matchedServiceId: 'svc-haircut', teamMemberId: 'TM_DIRECT', skipAvailabilitySearch: true }));
    const bookingRequest = requests.find((request) => request.url.endsWith('/v2/bookings'));
    const segment = (bookingRequest?.body as {
      booking?: { appointment_segments?: Array<{ service_variation_id?: string; service_variation_version?: number; team_member_id?: string }> };
    })?.booking?.appointment_segments?.[0];

    assert.equal(segment?.service_variation_id, 'SV_HAIRCUT');
    assert.equal(segment?.service_variation_version, 12);
    assert.equal(segment?.team_member_id, 'TM_DIRECT');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Square createBooking auto-selects an available team member when caller says anyone is okay', async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, body });
    if (url.includes('/v2/customers/search')) {
      return new Response(JSON.stringify({ customers: [{ id: 'customer-1' }] }), { status: 200 });
    }
    if (url.includes('/v2/bookings/availability/search')) {
      return new Response(
        JSON.stringify({
          availabilities: [
            {
              start_at: '2099-01-02T18:00:00.000Z',
              appointment_segments: [{ team_member_id: 'TM_AVAILABLE', service_variation_id: 'SV_HAIRCUT' }],
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith('/v2/bookings')) {
      return new Response(JSON.stringify({ booking: { id: 'booking-1', status: 'ACCEPTED' } }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  try {
    const provider = new SquareAppointmentsProvider(
      buildShop({
        service_catalog: {
          categories: [{ id: 'cat-cuts', shopId: 'shop-square-test', name: 'Cuts', sortOrder: 0, active: true }],
          services: [
            {
              id: 'svc-haircut',
              shopId: 'shop-square-test',
              categoryId: 'cat-cuts',
              name: 'Haircut',
              durationMinutes: 45,
              priceAmount: 50,
              priceCurrency: 'USD',
              priceType: 'fixed',
              bookable: true,
              active: true,
              sortOrder: 0,
              aliases: [],
              variants: [],
              externalProvider: 'square',
              externalServiceId: 'SV_HAIRCUT',
              externalMetadata: { variation_version: 12 },
            },
          ],
        },
      }),
    );

    await provider.createBooking(bookingInput({ matchedServiceId: 'svc-haircut', teamMemberId: '   ' }));
    const availabilityRequest = requests.find((request) => request.url.includes('/v2/bookings/availability/search'));
    const availabilitySegment = (availabilityRequest?.body as {
      query?: { filter?: { segment_filters?: Array<{ team_member_id_filter?: unknown }> } };
    })?.query?.filter?.segment_filters?.[0];
    const bookingRequest = requests.find((request) => request.url.endsWith('/v2/bookings'));
    const segment = (bookingRequest?.body as {
      booking?: { appointment_segments?: Array<{ team_member_id?: string }> };
    })?.booking?.appointment_segments?.[0];

    assert.equal(availabilitySegment?.team_member_id_filter, undefined);
    assert.equal(segment?.team_member_id, 'TM_AVAILABLE');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Square checkAvailability returns fallback staff when requested stylist is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/v2/bookings/availability/search')) {
      return new Response(
        JSON.stringify({
          availabilities: [
            {
              start_at: '2099-01-02T18:00:00.000Z',
              appointment_segments: [{ team_member_id: 'TM_MARCUS', service_variation_id: 'SV_HAIRCUT' }],
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/v2/team-members/search')) {
      return new Response(
        JSON.stringify({
          team_members: [
            { id: 'TM_JESSICA', display_name: 'Jessica Lee', given_name: 'Jessica', family_name: 'Lee' },
            { id: 'TM_MARCUS', display_name: 'Marcus Rivera', given_name: 'Marcus', family_name: 'Rivera' },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  try {
    const provider = new SquareAppointmentsProvider(
      buildShop({
        service_catalog: {
          categories: [{ id: 'cat-cuts', shopId: 'shop-square-test', name: 'Cuts', sortOrder: 0, active: true }],
          services: [
            {
              id: 'svc-haircut',
              shopId: 'shop-square-test',
              categoryId: 'cat-cuts',
              name: 'Haircut',
              durationMinutes: 45,
              priceAmount: 50,
              priceCurrency: 'USD',
              priceType: 'fixed',
              bookable: true,
              active: true,
              sortOrder: 0,
              aliases: [],
              variants: [],
              externalProvider: 'square',
              externalServiceId: 'SV_HAIRCUT',
              externalMetadata: {},
            },
          ],
        },
      }),
    );

    const result = await provider.checkAvailability({
      date: '2099-01-02',
      time: '10:00',
      durationMin: 45,
      timezone: 'America/Los_Angeles',
      matchedServiceId: 'svc-haircut',
      techName: 'Jessica Lee',
      teamMemberId: 'TM_JESSICA',
    });

    assert.equal(result.available, true);
    assert.equal(result.requestedStaffUnavailable, true);
    assert.equal(result.requestedStaffName, 'Jessica Lee');
    assert.equal(result.fallbackStaffName, 'Marcus Rivera');
    assert.equal(result.suggestions?.[0]?.techName, 'Marcus Rivera');
    assert.equal(result.staffResolution?.resolvedTeamMemberId, 'TM_MARCUS');
    assert.equal(result.staffResolution?.requestedTeamMemberId, 'TM_JESSICA');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Square checkAvailability uses matched service externalServiceId', async () => {
  let availabilityBody: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/v2/bookings/availability/search')) {
      availabilityBody = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(JSON.stringify({ availabilities: [{ start_at: '2099-01-02T18:00:00.000Z' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 404 });
  }) as typeof fetch;

  try {
    const provider = new SquareAppointmentsProvider(
      buildShop({
        service_catalog: {
          categories: [{ id: 'cat-cuts', shopId: 'shop-square-test', name: 'Cuts', sortOrder: 0, active: true }],
          services: [
            {
              id: 'svc-haircut',
              shopId: 'shop-square-test',
              categoryId: 'cat-cuts',
              name: 'Haircut',
              durationMinutes: 45,
              priceAmount: 50,
              priceCurrency: 'USD',
              priceType: 'fixed',
              bookable: true,
              active: true,
              sortOrder: 0,
              aliases: [],
              variants: [],
              externalProvider: 'square',
              externalServiceId: 'SV_HAIRCUT',
              externalMetadata: {},
            },
          ],
        },
      }),
    );

    const result = await provider.checkAvailability({
      date: '2099-01-02',
      time: '10:00',
      durationMin: 45,
      timezone: 'America/Los_Angeles',
      matchedServiceId: 'svc-haircut',
    });
    const segment = (availabilityBody as {
      query?: { filter?: { segment_filters?: Array<{ service_variation_id?: string }> } };
    })?.query?.filter?.segment_filters?.[0];

    assert.equal(result.available, true);
    assert.equal(segment?.service_variation_id, 'SV_HAIRCUT');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
