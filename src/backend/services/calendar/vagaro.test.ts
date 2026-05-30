import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { VagaroProvider } from '@/src/backend/services/calendar/vagaro';
import { encrypt } from '@/src/backend/services/crypto/encrypt';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-vagaro',
    name: 'Vagaro Salon',
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
    vagaro_mode: 'live_sync',
    vagaro_connection_status: 'connected',
    vagaro_client_id: 'new-client-id',
    vagaro_client_secret_encrypted: encrypt('new-client-secret'),
    vagaro_region: 'usa03',
    vagaro_business_id: 'new-business-id',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('VagaroProvider reads new credential fields instead of unrelated legacy calendar credentials', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    if (url.includes('/api/v2/merchants/generate-access-token')) {
      return jsonResponse({ accessToken: 'vagaro-token', expiresIn: 3600 });
    }
    if (url.includes('/api/v2/appointments/availability')) {
      return jsonResponse({ availability: [] });
    }
    return jsonResponse({}, 404);
  }) as typeof fetch;

  try {
    const provider = new VagaroProvider(
      buildShop({
        google_cal_credentials_encrypted: JSON.stringify({
          provider: 'square_appointments',
          accessToken: 'square-token',
          locationId: 'square-location',
        }),
      }),
    );

    await provider.checkAvailability({
      date: '2099-01-02',
      time: '10:00',
      durationMin: 45,
      timezone: 'America/Los_Angeles',
    });

    assert.equal(calls[0]?.url, 'https://api.vagaro.com/usa03/api/v2/merchants/generate-access-token');
    assert.deepEqual(calls[0]?.body, {
      clientId: 'new-client-id',
      clientSecretKey: 'new-client-secret',
      scope: 'read access',
    });
    assert.equal(calls[1]?.url, 'https://api.vagaro.com/usa03/api/v2/appointments/availability');
    assert.equal((calls[1]?.body as { businessId?: string } | undefined)?.businessId, 'new-business-id');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('VagaroProvider.checkAvailability calls availability endpoint and returns exact match', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/api/v2/merchants/generate-access-token')) {
      return jsonResponse({ accessToken: 'vagaro-token', expiresIn: 3600 });
    }
    if (url.includes('/api/v2/appointments/availability')) {
      return jsonResponse({
        availability: [{ startTime: '2099-01-02T10:00:00-08:00', serviceProviderName: 'Jane' }],
      });
    }
    return jsonResponse({}, 404);
  }) as typeof fetch;

  try {
    const provider = new VagaroProvider(buildShop());
    const result = await provider.checkAvailability({
      date: '2099-01-02',
      time: '10:00',
      durationMin: 45,
      timezone: 'America/Los_Angeles',
    });

    assert.equal(result.available, true);
    assert.equal(calls.some((url) => url === 'https://api.vagaro.com/usa03/api/v2/appointments/availability'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('VagaroProvider does not support direct createBooking', async () => {
  const provider = new VagaroProvider(buildShop());

  await assert.rejects(
    () =>
      provider.createBooking({
        shopId: 'shop-vagaro',
        customerPhone: '+15551234567',
        customerName: 'Alex',
        service: 'Haircut',
        datetimeIso: '2099-01-02T10:00:00-08:00',
        timezone: 'America/Los_Angeles',
        durationMin: 45,
        source: 'inbound_call',
        idempotencyKey: 'vagaro-create-1',
      }),
    /Vagaro public API does not support this operation/,
  );
});
