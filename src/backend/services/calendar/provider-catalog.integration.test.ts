import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { getCalendarProvider, getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';

function buildShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-test',
    name: 'Shop Test',
    phone_number: '+14155550100',
    user_phone: '+14155550101',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '2-hour cancellation policy applies.',
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

test('calendar provider resolver returns google provider when shop has google calendar id', () => {
  const shop = buildShop({
    google_cal_id: 'calendar-1@group.calendar.google.com',
  });
  const provider = getCalendarProvider(shop);
  assert.equal(provider.constructor.name, 'GoogleCalendarProvider');
  const metadata = getShopCalendarProviderMetadata(shop);
  assert.equal(metadata.id, 'google_calendar');
  assert.equal(metadata.implemented, true);
});

test('calendar provider resolver returns square provider when selected integration is square_appointments', () => {
  const shop = buildShop({
    selected_integration: 'square_appointments',
    google_cal_credentials_encrypted: JSON.stringify({
      provider: 'square_appointments',
      access_token: 'sq0atp_test',
      refresh_token: 'sq0rtp_test',
      location_id: 'L123',
      service_variation_id: 'SV123',
    }),
  });
  const provider = getCalendarProvider(shop);
  assert.equal(provider.constructor.name, 'SquareAppointmentsProvider');
  const metadata = getShopCalendarProviderMetadata(shop);
  assert.equal(metadata.id, 'square_appointments');
  assert.equal(metadata.status, 'active');
  assert.equal(metadata.implemented, true);
});

test('calendar provider resolver ignores stale square credentials when selected integration is null', () => {
  const shop = buildShop({
    selected_integration: null,
    google_cal_credentials_encrypted: JSON.stringify({
      provider: 'square_appointments',
      access_token: 'sq0atp_test',
      refresh_token: 'sq0rtp_test',
      location_id: 'L123',
    }),
  });
  const provider = getCalendarProvider(shop);
  assert.equal(provider.constructor.name, 'ManualCalendarProvider');
  const metadata = getShopCalendarProviderMetadata(shop);
  assert.equal(metadata.id, 'manual');
});
