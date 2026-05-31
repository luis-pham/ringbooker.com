import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { getCalendarProvider, getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';
import { VagaroProvider } from '@/src/backend/services/calendar/vagaro';
import { encrypt } from '@/src/backend/services/crypto/encrypt';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-factory',
    name: 'Factory Salon',
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
    ...overrides,
  };
}

test('calendar provider resolver returns Vagaro provider for live sync shop', () => {
  const shop = buildShop({
    vagaro_mode: 'live_sync',
    vagaro_connection_status: 'connected',
    vagaro_business_id: 'biz123',
    vagaro_region: 'usa03',
    vagaro_client_id: 'client-123',
    vagaro_client_secret_encrypted: encrypt('secret-123'),
    selected_integration: 'vagaro',
  });

  const provider = getCalendarProvider(shop);
  assert.ok(provider instanceof VagaroProvider);

  const metadata = getShopCalendarProviderMetadata(shop);
  assert.equal(metadata.id, 'vagaro');
  assert.equal(metadata.capabilities.checkAvailability, true);
  assert.equal(metadata.capabilities.createBooking, false);
  assert.equal(metadata.capabilities.hasBookingLink, true);
});

test('calendar provider resolver does not return Vagaro provider for link-only Vagaro shop', () => {
  const shop = buildShop({
    vagaro_mode: 'link_only',
    vagaro_connection_status: 'connected',
    vagaro_business_id: 'biz123',
    vagaro_region: 'usa03',
    vagaro_client_id: 'client-123',
    vagaro_client_secret_encrypted: encrypt('secret-123'),
    booking_url: 'https://vagaro.com/factory-salon',
    booking_method: 'app',
    selected_integration: 'vagaro',
  });

  const provider = getCalendarProvider(shop);
  assert.notEqual(provider.constructor.name, 'VagaroProvider');

  const metadata = getShopCalendarProviderMetadata(shop);
  assert.notEqual(metadata.id, 'vagaro');
});
