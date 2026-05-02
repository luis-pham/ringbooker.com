import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { resolveShopByInboundDid, normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';

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

test('normalizeInboundE164 handles PSTN and SIP-style strings', () => {
  assert.equal(normalizeInboundE164('+1 (415) 555-0199'), '+14155550199');
  assert.equal(normalizeInboundE164('sip:+442071838750@example.com'), '+442071838750');
  assert.equal(normalizeInboundE164(''), null);
});

test('resolveShopByInboundDid prefers telnyx_number over phone_number', async () => {
  const repo = new InMemoryShopsRepository();
  await repo.updateUserSettings('demo-shop', {
    telnyx_number: '+15551110001',
    phone_number: '+15552220002',
  });

  const byTelnyx = await resolveShopByInboundDid({ shopsRepository: repo }, '+15551110001');
  assert.equal(byTelnyx?.id, 'demo-shop');

  const byPhone = await resolveShopByInboundDid({ shopsRepository: repo }, '+15552220002');
  assert.equal(byPhone?.id, 'demo-shop');
});

test('resolveShopByInboundDid uses phone_number when telnyx_number is unset', async () => {
  const repo = new InMemoryShopsRepository();
  await repo.updateUserSettings('demo-shop', {
    telnyx_number: null,
    phone_number: '+15553330003',
  });

  const shop = await resolveShopByInboundDid({ shopsRepository: repo }, '+15553330003');
  assert.equal(shop?.id, 'demo-shop');
});

test('resolveShopByInboundDid returns telnyx match when another shop shares only phone_number', async () => {
  const repo = new InMemoryShopsRepository();
  await repo.updateUserSettings('demo-shop', {
    telnyx_number: '+15559999001',
    phone_number: '+15559999002',
  });
  await repo.create({
    name: 'Other',
    phone_number: '+15559999001',
    user_phone: '+15559999001',
    timezone: 'America/Los_Angeles',
    active: true,
  });

  const resolved = await resolveShopByInboundDid({ shopsRepository: repo }, '+15559999001');
  assert.equal(resolved?.id, 'demo-shop');
});

test('resolveShopByInboundDid with mock: telnyx branch wins without calling findByDestinationPhone', async () => {
  const shop = baseShop({
    id: 'telnyx-shop',
    telnyx_number: '+15550009999',
    phone_number: '+15550008888',
  });
  let destinationCalls = 0;
  const repo: Pick<import('@/src/backend/ports/repositories').ShopsRepository, 'findByTelnyxNumber' | 'findByDestinationPhone'> = {
    async findByTelnyxNumber(e164: string) {
      assert.equal(e164, '+15550009999');
      return shop;
    },
    async findByDestinationPhone() {
      destinationCalls += 1;
      return null;
    },
  };

  const got = await resolveShopByInboundDid({ shopsRepository: repo as import('@/src/backend/ports/repositories').ShopsRepository }, '+15550009999');
  assert.equal(got?.id, 'telnyx-shop');
  assert.equal(destinationCalls, 0);
});
