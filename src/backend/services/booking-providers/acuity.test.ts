import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { AcuityProvider, encodeAcuityCredentials, parseAcuityCredentials } from '@/src/backend/services/booking-providers/acuity';
import { getCalendarProvider, getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';

function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-acuity',
    name: 'Acuity Salon',
    phone_number: '+12145550100',
    user_phone: '+12145550101',
    timezone: 'America/Chicago',
    services: [{ name: 'Haircut', duration_min: 45, price: 55 }],
    hours: {},
    cancel_policy: '',
    booking_url: null,
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
    integration_credentials_encrypted: encodeAcuityCredentials({
      provider: 'acuity',
      userId: 'user-1',
      apiKey: 'key-1',
      appointmentTypeId: '100',
      calendarId: '200',
      defaultCalendarId: '200',
      serviceMappings: { haircut: '100' },
      staffMappings: { alex: '200' },
      timezone: 'America/Chicago',
    }),
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

test('acuity credentials parse from stored JSON', () => {
  const encoded = encodeAcuityCredentials({ provider: 'acuity', userId: '123', apiKey: 'secret', appointmentTypeId: '11' });
  const parsed = parseAcuityCredentials(encoded);
  assert.equal(parsed?.provider, 'acuity');
  assert.equal(parsed?.userId, '123');
  assert.equal(parsed?.apiKey, 'secret');
  assert.equal(parsed?.appointmentTypeId, '11');
});

test('calendar provider resolver returns Acuity provider when shop hint is acuity', () => {
  const shop = buildShop();
  const metadata = getShopCalendarProviderMetadata(shop);
  assert.equal(metadata.id, 'acuity');
  const provider = getCalendarProvider(shop);
  assert.ok(provider instanceof AcuityProvider);
});

test('acuity fetches appointment types and calendars with basic auth', async () => {
  const requests: Array<{ url: string; auth: string | null }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') });
    if (String(input).endsWith('/appointment-types')) {
      return jsonResponse([{ id: 100, name: 'Haircut', duration: 45 }]);
    }
    if (String(input).endsWith('/calendars')) {
      return jsonResponse([{ id: 200, name: 'Main calendar' }]);
    }
    return jsonResponse({}, 404);
  }) as typeof fetch;

  const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
  const options = await provider.getConnectionOptions();

  assert.equal(options.appointmentTypes[0]?.name, 'Haircut');
  assert.equal(options.calendars[0]?.name, 'Main calendar');
  assert.equal(options.directAppointmentCreation, 'not_enabled');
  assert.ok(requests.every((request) => request.auth?.startsWith('Basic ')));
});

test('acuity auth failure surfaces API error', async () => {
  const fetchImpl = (async () => jsonResponse({ message: 'Unauthorized' }, 401)) as typeof fetch;
  const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
  await assert.rejects(() => provider.getAppointmentTypes(), /acuity_request_failed:401/);
});

test('acuity availability returns exact match and suggestions', async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/availability/check-times')) {
      return jsonResponse([{ valid: false, reason: 'not_available' }]);
    }
    if (url.includes('/availability/times')) {
      return jsonResponse([
        { time: '2099-01-02T10:30:00-06:00', calendarID: 200 },
        { time: '2099-01-02T11:00:00-06:00', calendarID: 200 },
      ]);
    }
    return jsonResponse({}, 404);
  }) as typeof fetch;

  const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
  const result = await provider.checkAvailability({
    date: '2099-01-02',
    time: '10:00',
    durationMin: 45,
    timezone: 'America/Chicago',
  });

  assert.equal(result.available, false);
  assert.equal(result.suggestions?.[0]?.time, '10:30');
  assert.equal(calls.some((url) => url.includes('appointmentTypeID=100')), true);
});

test('acuity availability success returns available true', async () => {
  const fetchImpl = (async () => jsonResponse([{ valid: true }])) as typeof fetch;
  const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
  const result = await provider.checkAvailability({
    date: '2099-01-02',
    time: '10:00',
    durationMin: 45,
    timezone: 'America/Chicago',
  });
  assert.equal(result.available, true);
});

test('acuity availability API error does not mark slot available', async () => {
  const fetchImpl = (async () => jsonResponse({ message: 'Invalid appointment type' }, 400)) as typeof fetch;
  const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
  const result = await provider.checkAvailability({
    date: '2099-01-02',
    time: '10:00',
    durationMin: 45,
    timezone: 'America/Chicago',
  });
  assert.equal(result.available, false);
});

test('acuity create booking falls back when direct booking flag is disabled', async () => {
  const previous = process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  try {
    const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl: (async () => jsonResponse({})) as typeof fetch });
    const result = await provider.createBooking({
      shopId: 'shop-acuity',
      customerPhone: '+15551234567',
      customerName: 'Alex Lee',
      service: 'Haircut',
      datetimeIso: '2099-01-02T10:00:00-06:00',
      timezone: 'America/Chicago',
      durationMin: 45,
      source: 'inbound_call',
      idempotencyKey: 'idem-1',
    });
    assert.equal(result.bookingId, 'acuity-request-idem-1');
    assert.equal(result.confirmed, false);
    assert.equal(result.providerStatus, 'provider_disabled');
  } finally {
    if (previous === undefined) delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
    else process.env.ACUITY_DIRECT_BOOKING_ENABLED = previous;
  }
});

test('acuity create booking confirms only after appointment id is returned', async () => {
  const previous = process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  process.env.ACUITY_DIRECT_BOOKING_ENABLED = 'true';
  const bodies: unknown[] = [];
  try {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/availability/check-times')) {
        return jsonResponse([{ valid: true }]);
      }
      bodies.push(JSON.parse(String(init?.body)));
      return jsonResponse({ id: 98765 });
    }) as typeof fetch;
    const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
    const result = await provider.createBooking({
      shopId: 'shop-acuity',
      customerPhone: '+15551234567',
      customerName: 'Alex Lee',
      service: 'Haircut',
      datetimeIso: '2099-01-02T10:00:00-06:00',
      timezone: 'America/Chicago',
      durationMin: 45,
      source: 'inbound_call',
      idempotencyKey: 'idem-2',
    });
    assert.equal(result.confirmed, true);
    assert.equal(result.calendarEventId, '98765');
    assert.equal(result.providerStatus, 'provider_confirmed');
    assert.equal((bodies[0] as { appointmentTypeID?: number }).appointmentTypeID, 100);
  } finally {
    if (previous === undefined) delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
    else process.env.ACUITY_DIRECT_BOOKING_ENABLED = previous;
  }
});

test('acuity create booking API error falls back to request-only result', async () => {
  const previous = process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  process.env.ACUITY_DIRECT_BOOKING_ENABLED = 'true';
  try {
    const fetchImpl = (async () => jsonResponse({ message: 'Required field missing' }, 400)) as typeof fetch;
    const provider = new AcuityProvider(buildShop(), { baseUrl: 'https://acuity.test/api/v1', fetchImpl });
    const result = await provider.createBooking({
      shopId: 'shop-acuity',
      customerPhone: '+15551234567',
      customerName: 'Alex Lee',
      service: 'Haircut',
      datetimeIso: '2099-01-02T10:00:00-06:00',
      timezone: 'America/Chicago',
      durationMin: 45,
      source: 'inbound_call',
      idempotencyKey: 'idem-3',
    });
    assert.equal(result.bookingId, 'acuity-request-idem-3');
    assert.equal(result.confirmed, false);
    assert.equal(result.providerStatus, 'provider_failed');
    assert.match(result.providerErrorReason ?? '', /Required field missing/);
  } finally {
    if (previous === undefined) delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
    else process.env.ACUITY_DIRECT_BOOKING_ENABLED = previous;
  }
});

test('acuity create booking falls back when service mapping is missing', async () => {
  const previous = process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  process.env.ACUITY_DIRECT_BOOKING_ENABLED = 'true';
  try {
    const provider = new AcuityProvider(
      buildShop({
        integration_credentials_encrypted: encodeAcuityCredentials({
          provider: 'acuity',
          userId: 'user-1',
          apiKey: 'key-1',
          defaultCalendarId: '200',
        }),
      }),
      { baseUrl: 'https://acuity.test/api/v1', fetchImpl: (async () => jsonResponse({})) as typeof fetch },
    );
    const result = await provider.createBooking({
      shopId: 'shop-acuity',
      customerPhone: '+15551234567',
      customerName: 'Alex Lee',
      service: 'Haircut',
      datetimeIso: '2099-01-02T10:00:00-06:00',
      timezone: 'America/Chicago',
      durationMin: 45,
      source: 'inbound_call',
      idempotencyKey: 'idem-mapping',
    });
    assert.equal(result.confirmed, false);
    assert.equal(result.providerStatus, 'missing_mapping');
    assert.equal(result.providerErrorReason, 'missing_service_mapping');
  } finally {
    if (previous === undefined) delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
    else process.env.ACUITY_DIRECT_BOOKING_ENABLED = previous;
  }
});

test('acuity create booking falls back when required caller email is missing', async () => {
  const previous = process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  process.env.ACUITY_DIRECT_BOOKING_ENABLED = 'true';
  try {
    const provider = new AcuityProvider(
      buildShop({
        integration_credentials_encrypted: encodeAcuityCredentials({
          provider: 'acuity',
          userId: 'user-1',
          apiKey: 'key-1',
          serviceMappings: { haircut: '100' },
          defaultCalendarId: '200',
          requiresCallerEmail: true,
        }),
      }),
      { baseUrl: 'https://acuity.test/api/v1', fetchImpl: (async () => jsonResponse({})) as typeof fetch },
    );
    const result = await provider.createBooking({
      shopId: 'shop-acuity',
      customerPhone: '+15551234567',
      customerName: 'Alex Lee',
      service: 'Haircut',
      datetimeIso: '2099-01-02T10:00:00-06:00',
      timezone: 'America/Chicago',
      durationMin: 45,
      source: 'inbound_call',
      idempotencyKey: 'idem-email',
    });
    assert.equal(result.confirmed, false);
    assert.equal(result.providerStatus, 'request_only');
    assert.equal(result.providerErrorReason, 'missing_required_email');
  } finally {
    if (previous === undefined) delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
    else process.env.ACUITY_DIRECT_BOOKING_ENABLED = previous;
  }
});

test('acuity create booking falls back when availability is unavailable', async () => {
  const previous = process.env.ACUITY_DIRECT_BOOKING_ENABLED;
  process.env.ACUITY_DIRECT_BOOKING_ENABLED = 'true';
  try {
    const provider = new AcuityProvider(buildShop(), {
      baseUrl: 'https://acuity.test/api/v1',
      fetchImpl: (async () => jsonResponse([{ valid: false, reason: 'not_available' }])) as typeof fetch,
    });
    const result = await provider.createBooking({
      shopId: 'shop-acuity',
      customerPhone: '+15551234567',
      customerName: 'Alex Lee',
      service: 'Haircut',
      datetimeIso: '2099-01-02T10:00:00-06:00',
      timezone: 'America/Chicago',
      durationMin: 45,
      source: 'inbound_call',
      idempotencyKey: 'idem-unavailable',
    });
    assert.equal(result.confirmed, false);
    assert.equal(result.providerStatus, 'provider_unavailable');
    assert.equal(result.providerErrorReason, 'not_available');
  } finally {
    if (previous === undefined) delete process.env.ACUITY_DIRECT_BOOKING_ENABLED;
    else process.env.ACUITY_DIRECT_BOOKING_ENABLED = previous;
  }
});
