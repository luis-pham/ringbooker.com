import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { evaluateKnowledgeGate } from '@/src/backend/domain/go-live-gate';

function createShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-gate-test',
    name: 'Gate Test Salon',
    phone_number: '+15550000001',
    user_phone: '+15550000002',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Haircut', duration_min: 45, price: 45 }],
    hours: { mon: { open: '09:00', close: '17:00' } },
    cancel_policy: '24 hours',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
    ...overrides,
  };
}

function timezoneItem(shop: Shop) {
  const item = evaluateKnowledgeGate(shop).find((entry) => entry.key === 'timezone');
  assert.ok(item, 'expected a timezone gate item');
  return item!;
}

test('freshly-signed-up shop (timezone never confirmed) fails the timezone gate', () => {
  const shop = createShop({ timezone_confirmed_at: null });
  assert.equal(timezoneItem(shop).passed, false);
});

test('shop with a confirmed timezone passes the gate', () => {
  const shop = createShop({ timezone_confirmed_at: new Date().toISOString() });
  assert.equal(timezoneItem(shop).passed, true);
});

test('timezone gate blocks even when every other gate item is satisfied', () => {
  // Reproduces the exact audit finding: shop.timezone is NOT NULL and always holds at least the
  // signup-time default, so a presence-only check could never fail even with a wrong timezone.
  // Name, hours, and services are all valid here -- only the missing confirmation should block.
  const shop = createShop({
    name: 'Fully Set Up Salon',
    hours: { mon: { open: '09:00', close: '17:00' }, tue: { open: '09:00', close: '17:00' } },
    services: [{ name: 'Manicure', duration_min: 30, price: 25 }],
    cancel_policy: '24 hours',
    timezone: 'America/Los_Angeles', // unmodified signup-time default
    timezone_confirmed_at: null,
  });

  const items = evaluateKnowledgeGate(shop);
  assert.equal(items.find((entry) => entry.key === 'businessName')?.passed, true);
  assert.equal(items.find((entry) => entry.key === 'hours')?.passed, true);
  assert.equal(items.find((entry) => entry.key === 'services')?.passed, true);
  assert.equal(items.find((entry) => entry.key === 'timezone')?.passed, false);
});
