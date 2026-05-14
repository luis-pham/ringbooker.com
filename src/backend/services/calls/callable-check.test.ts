import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { isShopCallable } from '@/src/backend/services/calls/callable-check';

function baseShop(overrides: Partial<Shop>): Shop {
  return {
    id: 'shop-1',
    name: 'Test',
    vertical: 'nail_salon',
    brand_slug: null,
    phone_number: '+15550001001',
    user_phone: '+15550001999',
    backup_phone: null,
    user_name: null,
    address: null,
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Cut', duration_min: 30, price: 40 }],
    hours: { mon: { open: '09:00', close: '17:00' } },
    cancel_policy: '24h',
    promotions: null,
    booking_url: null,
    website_url: null,
    languages: ['en'],
    current_onboarding_step: null,
    setup_method: null,
    forwarding_type: null,
    forwarding_carrier: null,
    forwarding_country: null,
    telnyx_number: null,
    ai_voice: null,
    ai_welcome_message: null,
    ai_custom_instructions: null,
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
    google_cal_id: null,
    google_cal_credentials_encrypted: null,
    ...overrides,
  };
}

test('isShopCallable rejects inactive shop', () => {
  const r = isShopCallable(baseShop({ active: false }));
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'shop_inactive');
});

test('isShopCallable rejects empty services and no AI script', () => {
  const r = isShopCallable(
    baseShop({
      services: [],
      ai_welcome_message: null,
      ai_custom_instructions: null,
    }),
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'insufficient_config');
});

test('isShopCallable allows services-only for professional', () => {
  const r = isShopCallable(baseShop({ plan: 'professional', services: [{ name: 'X', duration_min: 10, price: 5 }] }));
  assert.equal(r.ok, true);
});

test('isShopCallable allows starter with services only (no script needed)', () => {
  const r = isShopCallable(
    baseShop({
      plan: 'starter',
      services: [{ name: 'X', duration_min: 10, price: 5 }],
      ai_welcome_message: null,
      ai_custom_instructions: null,
    }),
  );
  assert.equal(r.ok, true);
});

test('isShopCallable allows starter when AI script present even without services', () => {
  const r = isShopCallable(
    baseShop({
      plan: 'starter',
      services: [],
      ai_welcome_message: 'Hello!',
    }),
  );
  assert.equal(r.ok, true);
});

test('isShopCallable allows shop with service_catalog and empty services list', () => {
  const r = isShopCallable(
    baseShop({
      services: [],
      ai_welcome_message: null,
      ai_custom_instructions: null,
      service_catalog: {
        categories: [],
        services: [{ id: 'svc-1', shopId: 'shop-1', name: 'Manicure', active: true, categoryId: null, durationMinutes: 30, priceAmount: 40, priceCurrency: 'USD', priceType: 'fixed', sortOrder: 0, description: null, bookingNotes: null, variants: [], bookable: true, aliases: [] }],
      },
    }),
  );
  assert.equal(r.ok, true);
});

test('isShopCallable rejects inactive service_catalog entries', () => {
  const r = isShopCallable(
    baseShop({
      services: [],
      ai_welcome_message: null,
      ai_custom_instructions: null,
      service_catalog: {
        categories: [],
        services: [{ id: 'svc-1', shopId: 'shop-1', name: 'Manicure', active: false, categoryId: null, durationMinutes: 30, priceAmount: 40, priceCurrency: 'USD', priceType: 'fixed', sortOrder: 0, description: null, bookingNotes: null, variants: [], bookable: true, aliases: [] }],
      },
    }),
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'insufficient_config');
});
