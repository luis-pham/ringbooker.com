import test from 'node:test';
import assert from 'node:assert/strict';

import type { Customer, Shop } from '@/src/backend/domain/types';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';

function createShop(plan: Shop['plan'], languages?: string[]): Shop {
  return {
    id: 'shop-prompt-test',
    name: 'Prompt Test Salon',
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
    plan,
    active: true,
    ...(languages ? { languages } : {}),
  };
}

const returningCustomer: Customer = {
  phone: '+15551234567',
  shop_id: 'shop-prompt-test',
  full_name: 'Jamie Returning',
  last_service: 'Balayage',
  preferred_tech: 'Sarah',
  visit_count: 4,
  notes: 'Prefers quiet appointments',
  sms_opt_out: false,
};

test('Starter prompt does not inject returning caller notes or preferences', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('starter'),
    customer: returningCustomer,
    mode: 'inbound',
  });

  assert.doesNotMatch(prompt, /RETURNING CUSTOMER/);
  assert.doesNotMatch(prompt, /Jamie Returning/);
  assert.doesNotMatch(prompt, /Sarah/);
  assert.match(prompt, /New customer/);
});

test('Professional prompt injects returning caller context', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional'),
    customer: returningCustomer,
    mode: 'inbound',
  });

  assert.match(prompt, /RETURNING CUSTOMER/);
  assert.match(prompt, /Jamie Returning/);
  assert.match(prompt, /Sarah/);
});

test('Production prompt injects configured staff and FAQ answers', () => {
  const shop = createShop('professional');
  shop.staff = [
    { name: 'Mia', role: 'Color specialist', specialties: ['Balayage', 'Color correction'], active: true },
  ];
  shop.faqs = [
    { question: 'Do you accept walk-ins?', answer: 'Walk-ins are welcome when staff are available.' },
  ];

  const prompt = buildSystemPrompt({
    shop,
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /PROVIDERS \/ STAFF: Mia/);
  assert.match(prompt, /APPROVED FAQ ANSWERS/);
  assert.match(prompt, /Do you accept walk-ins/);
});

test('Starter with languages does not receive bilingual workflow or LANGUAGE OPTIONS runtime line', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('starter', ['en', 'vi']),
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /LANGUAGE DIRECTIVE:.*STARTER PLAN/s);
  assert.doesNotMatch(prompt, /\nLANGUAGE OPTIONS:/);
  assert.doesNotMatch(prompt, /BILINGUAL WORKFLOW/);
});

test('Professional with configured languages receives bilingual workflow and LANGUAGE OPTIONS', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional', ['en', 'vi']),
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /\nLANGUAGE OPTIONS: English, Vietnamese/);
  assert.match(prompt, /LANGUAGE DIRECTIVE:.*BILINGUAL WORKFLOW/s);
});

test('Enterprise with configured languages receives enterprise multilingual routing hook', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('enterprise', ['en', 'vi']),
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /\nLANGUAGE OPTIONS: English, Vietnamese/);
  assert.match(prompt, /CUSTOM MULTILINGUAL ROUTING \(ENTERPRISE\)/);
});

test('Professional English-only shop does not enable bilingual workflow block', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional', ['en']),
    customer: null,
    mode: 'inbound',
  });

  assert.doesNotMatch(prompt, /BILINGUAL WORKFLOW/);
  assert.doesNotMatch(prompt, /\nLANGUAGE OPTIONS:/);
  assert.match(prompt, /LANGUAGE DIRECTIVE:.*LANGUAGE POLICY \(PAID PLAN\)/s);
});

test('Starter nail salon production prompt removes vertical Vietnamese workflow and core auto-switch', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('starter', ['en', 'vi']),
    customer: null,
    mode: 'inbound',
    vertical: 'nail-salon',
  });

  assert.doesNotMatch(prompt, /respond naturally in Vietnamese/i);
  assert.doesNotMatch(prompt, /bilingual English\/Vietnamese/i);
  assert.match(prompt, /LANGUAGE POLICY \(STARTER PLAN\)/);
  assert.doesNotMatch(prompt, /Detect and match the caller[\u2019']s language automatically/);
});

test('Professional nail salon with en/vi keeps bilingual vertical and runtime bilingual workflow', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional', ['en', 'vi']),
    customer: null,
    mode: 'inbound',
    vertical: 'nail-salon',
  });

  assert.match(prompt, /respond naturally in Vietnamese/i);
  assert.match(prompt, /BILINGUAL WORKFLOW/);
});

test('Production prompt renders service catalog grouped by service group', () => {
  const shop = createShop('professional');
  shop.services = [{ name: 'Legacy Service', duration_min: 30, price: 20 }];
  shop.service_catalog = {
    categories: [
      { id: '11111111-1111-4111-8111-111111111111', shopId: shop.id, name: 'Manicure', sortOrder: 0, active: true },
      { id: '22222222-2222-4222-8222-222222222222', shopId: shop.id, name: 'Pedicure', sortOrder: 1, active: true },
    ],
    services: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        shopId: shop.id,
        categoryId: '11111111-1111-4111-8111-111111111111',
        name: 'Gel Manicure',
        durationMinutes: 45,
        priceAmount: 45,
        priceCurrency: 'USD',
        priceType: 'from',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: ['gel mani', 'shellac'],
        bookingNotes: 'Popular service',
        externalProvider: 'square',
        externalServiceId: 'svc_secret',
        externalLocationId: 'loc_secret',
        externalMetadata: { raw: 'secret_payload' },
      },
      {
        id: '44444444-4444-4444-8444-444444444444',
        shopId: shop.id,
        categoryId: '22222222-2222-4222-8222-222222222222',
        name: 'Deluxe Pedicure',
        durationMinutes: 60,
        priceAmount: null,
        priceCurrency: 'USD',
        priceType: 'varies',
        bookable: false,
        active: true,
        sortOrder: 0,
        aliases: [],
        bookingNotes: null,
      },
    ],
  };

  const prompt = buildSystemPrompt({
    shop,
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /SERVICES \/ PRICING:\nManicure:\n- Gel Manicure \| starts at \$45 \| 45 min \| Popular service/);
  assert.match(prompt, /Customers may call this: gel mani, shellac/);
  assert.match(prompt, /Pedicure:\n- Deluxe Pedicure \| price varies \| 60 min \| capture request only; do not imply direct booking/);
  assert.doesNotMatch(prompt, /Legacy Service/);
  assert.doesNotMatch(prompt, /svc_secret|loc_secret|secret_payload|square/);
});

test('Production prompt falls back to legacy flat services when no service catalog exists', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional'),
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /General Services:\n- Haircut \| \$45 \| 45 min/);
});
