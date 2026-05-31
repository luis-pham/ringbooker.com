import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { encodeMindbodyCredentials, MindbodyProvider, parseMindbodyCredentials } from '@/src/backend/services/booking-providers/mindbody';
import { getCalendarProvider, getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';

function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-mindbody',
    name: 'Mindbody Salon',
    phone_number: '+14155550100',
    user_phone: '+14155550101',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '24-hour cancellation policy applies.',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: false,
    selected_integration: 'mindbody',
    google_cal_credentials_encrypted: encodeMindbodyCredentials({
      provider: 'mindbody',
      siteId: '12345',
      apiKey: 'mb-api-key',
      sourceName: 'RingBookerTest',
    }),
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('mindbody credentials parse from stored JSON', () => {
  const encoded = encodeMindbodyCredentials({ provider: 'mindbody', siteId: '123', apiKey: 'key', sourceName: 'RingBooker' });
  const parsed = parseMindbodyCredentials(encoded);
  assert.equal(parsed?.provider, 'mindbody');
  assert.equal(parsed?.siteId, '123');
  assert.equal(parsed?.apiKey, 'key');
});

test('calendar provider resolver returns Mindbody provider when shop hint is mindbody', () => {
  const provider = getCalendarProvider(buildShop());
  assert.equal(provider.constructor.name, 'MindbodyProvider');
  const metadata = getShopCalendarProviderMetadata(buildShop());
  assert.equal(metadata.id, 'mindbody');
  assert.equal(metadata.implemented, true);
  assert.equal(metadata.capabilities.createBooking, false);
});

test('mindbody fetches services and staff with required headers', async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url.endsWith('/sale/services')) return jsonResponse({ Services: [{ Id: 17, Name: 'Haircut' }] });
    if (url.endsWith('/staff/staff')) return jsonResponse({ StaffMembers: [{ Id: 5, FirstName: 'Jane', LastName: 'Doe' }] });
    return jsonResponse({}, 404);
  };

  const provider = new MindbodyProvider(buildShop(), { baseUrl: 'https://mindbody.test/public/v6', fetchImpl });
  const options = await provider.getConnectionOptions();

  assert.equal(options.services[0]?.Name, 'Haircut');
  assert.equal(options.staff[0]?.FirstName, 'Jane');
  assert.equal(calls[0]?.headers.get('API-Key'), 'mb-api-key');
  assert.equal(calls[0]?.headers.get('SiteId'), '12345');
  assert.equal(calls[0]?.headers.get('User-Agent'), 'RingBookerTest');
});

test('mindbody auth failure surfaces API error', async () => {
  const fetchImpl: typeof fetch = async () => jsonResponse({ Errors: [{ Code: '14010001', Message: 'Missing API key' }] }, 401);
  const provider = new MindbodyProvider(buildShop(), { baseUrl: 'https://mindbody.test/public/v6', fetchImpl });

  await assert.rejects(() => provider.getServices(), /mindbody_request_failed:401/);
});

test('mindbody availability returns exact match and suggestions', async () => {
  const fetchImpl: typeof fetch = async () =>
    jsonResponse({
      Availabilities: [
        { StartDateTime: '2026-06-01T16:00:00Z', Staff: { Id: 5, FirstName: 'Jane', LastName: 'Doe' } },
        { StartDateTime: '2026-06-01T17:00:00Z', Staff: { Id: 6, FirstName: 'Sam' } },
      ],
    });
  const provider = new MindbodyProvider(buildShop(), { baseUrl: 'https://mindbody.test/public/v6', fetchImpl });

  const exact = await provider.checkAvailability({ date: '2026-06-01', time: '09:00', durationMin: 60, timezone: 'America/Los_Angeles' });
  assert.equal(exact.available, true);

  const unavailable = await provider.checkAvailability({ date: '2026-06-01', time: '11:00', durationMin: 60, timezone: 'America/Los_Angeles' });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.suggestions?.[0]?.techName, 'Jane Doe');
});

test('mindbody availability API error does not mark slot available', async () => {
  const fetchImpl: typeof fetch = async () => jsonResponse({ Error: { Code: '500', Message: 'Temporary error' } }, 500);
  const provider = new MindbodyProvider(buildShop(), { baseUrl: 'https://mindbody.test/public/v6', fetchImpl });

  const result = await provider.checkAvailability({ date: '2026-06-01', time: '09:00', durationMin: 60, timezone: 'America/Los_Angeles' });
  assert.equal(result.available, false);
});

test('mindbody create booking falls back to request-only result unless writes are enabled', async () => {
  const provider = new MindbodyProvider(buildShop(), { baseUrl: 'https://mindbody.test/public/v6', fetchImpl: async () => jsonResponse({}) });
  const result = await provider.createBooking({
    shopId: 'shop-mindbody',
    customerPhone: '+14155550199',
    customerName: 'Client',
    service: 'Haircut',
    datetimeIso: '2026-06-01T09:00:00-07:00',
    timezone: 'America/Los_Angeles',
    durationMin: 60,
    source: 'manual',
    idempotencyKey: 'idem-1',
  });

  assert.equal(result.confirmed, false);
  assert.equal(result.bookingId, 'mindbody-request-idem-1');
});
