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
  sms_consent: false,
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

test('Production prompt renders allowed conversational style separately from the audio voice code', () => {
  const professionalShop = createShop('professional');
  professionalShop.ai_voice = 'Puck';
  const professionalPrompt = buildSystemPrompt({
    shop: professionalShop,
    customer: null,
    mode: 'inbound',
  });

  assert.match(professionalPrompt, /VOICE STYLE: Puck/);
  assert.match(professionalPrompt, /CONVERSATIONAL STYLE: Fast and concise\./);

  const downgradedStarter = createShop('starter');
  downgradedStarter.ai_voice = 'Charon';
  const starterPrompt = buildSystemPrompt({
    shop: downgradedStarter,
    customer: null,
    mode: 'inbound',
  });

  assert.match(starterPrompt, /VOICE STYLE: Aoede/);
  assert.match(starterPrompt, /CONVERSATIONAL STYLE: Warm and polished\./);
  assert.doesNotMatch(starterPrompt, /Confident and premium/);
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

test('Production shop with stored nail vertical gets nail UX pack without a demo vertical override', () => {
  const shop = createShop('professional', ['en']);
  shop.vertical = 'nail_salon';
  shop.services = [{ name: 'Gel Manicure', duration_min: 45, price: 40 }];

  const prompt = buildSystemPrompt({
    shop,
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /Caller psychology: quick, transactional, price-checking, walk-in oriented/i);
  assert.doesNotMatch(prompt, /stylist loyalty/i);
});

test('Production prompt renders service catalog grouped by service group', () => {
  const shop = createShop('professional');
  shop.services = [{ name: 'Legacy Service', duration_min: 30, price: 20 }];
  shop.not_offered_services = ['Acrylic nails'];
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
        variants: [
          { id: '55555555-5555-4555-8555-555555555555', label: '30 min', durationText: '30 min', durationMinutes: 30, priceAmount: 65, priceCurrency: 'USD', priceType: 'from', sortOrder: 0 },
          { id: '66666666-6666-4666-8666-666666666666', label: '60 min', durationText: '60 min', durationMinutes: 60, priceAmount: 95, priceCurrency: 'USD', priceType: 'from', sortOrder: 1 },
        ],
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

  assert.match(prompt, /SERVICES \/ PRICING:\nManicure:\n- Gel Manicure \| Options: 30 min/);
  assert.match(prompt, /60 min starts at \$95/);
  assert.match(prompt, /SERVICE OPTION RULE: When a service has options/);
  assert.match(prompt, /Customers may call this: gel mani, shellac/);
  assert.match(prompt, /Pedicure:\n- Deluxe Pedicure \| price varies \| 60 min \| capture request only; do not imply direct booking/);
  assert.match(prompt, /NOT OFFERED SERVICES: Acrylic nails/);
  assert.match(prompt, /unknown service that is neither in SERVICES \/ PRICING nor NOT OFFERED SERVICES, do not deny/i);
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

test('Manual provider prompt tells AI to capture request without claiming availability', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional'),
    customer: null,
    mode: 'inbound',
  });

  assert.match(prompt, /BOOKING REQUEST INSTRUCTION: Silently call validate_appointment_time when time is given/);
  assert.match(prompt, /Capture service, name, and preferred date\/time before noting a request/);
  assert.doesNotMatch(prompt, /capture service, name, and phone before noting a request/i);
  assert.match(prompt, /No booking window: accept approved future times/);
});

test('Production prompt treats caller ID as default phone source and accepts valid future dates without an explicit booking window', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional'),
    customer: null,
    mode: 'inbound',
    callerPhone: '+15551233802',
  });

  assert.match(prompt, /BOOKING REQUEST REQUIRED DETAILS: Before ending a booking-request flow/);
  assert.match(prompt, /service, preferred date and time, and caller name/);
  assert.match(prompt, /Phone is satisfied by caller ID/);
  assert.match(prompt, /Only collect phone if ctx\.callerPhone is null, empty, or caller explicitly requests a different number/);
  assert.match(prompt, /CALLER PHONE STATUS: Caller ID is available ending 3802/);
  assert.match(prompt, /Use ctx\.callerPhone as the callback number/);
  assert.doesNotMatch(prompt, /caller name, and caller phone number/);
  assert.match(prompt, /validate_appointment_time result is the only source of truth/);
  assert.match(prompt, /accept a future date approved by validate_appointment_time for capture/);
});

test('Production prompt explicitly allows phone collection when caller ID is unavailable', () => {
  const prompt = buildSystemPrompt({
    shop: createShop('professional'),
    customer: null,
    mode: 'inbound',
    callerPhone: null,
  });

  assert.match(prompt, /CALLER PHONE STATUS: Caller ID is unavailable/);
  assert.match(prompt, /ask once for the best callback number/);
});

test('Square and Mindbody prompts do not include manual booking request instruction', () => {
  const squareShop = createShop('professional');
  squareShop.google_cal_credentials_encrypted = JSON.stringify({
    provider: 'square_appointments',
    accessToken: 'square-access-token',
    refreshToken: 'square-refresh-token',
    locationId: 'location-id',
    serviceVariationId: 'service-variation-id',
  });

  const mindbodyShop = createShop('professional');
  mindbodyShop.integration_credentials_encrypted = JSON.stringify({
    provider: 'mindbody',
    siteId: '12345',
    apiKey: 'mb-api-key',
  });

  const squarePrompt = buildSystemPrompt({
    shop: squareShop,
    customer: null,
    mode: 'inbound',
  });
  const mindbodyPrompt = buildSystemPrompt({
    shop: mindbodyShop,
    customer: null,
    mode: 'inbound',
  });

  assert.doesNotMatch(squarePrompt, /BOOKING REQUEST INSTRUCTION/);
  assert.doesNotMatch(mindbodyPrompt, /BOOKING REQUEST INSTRUCTION/);
});

test('Production prompt renders a genuinely free ($0) catalog service as free, not "price varies"', () => {
  const shop = createShop('professional');
  shop.service_catalog = {
    categories: [
      { id: '77777777-7777-4777-8777-777777777777', shopId: shop.id, name: 'Color', sortOrder: 0, active: true },
    ],
    services: [
      {
        id: '88888888-8888-4888-8888-888888888888',
        shopId: shop.id,
        categoryId: '77777777-7777-4777-8777-777777777777',
        name: 'Color Consultation',
        durationMinutes: 20,
        priceAmount: 0,
        priceCurrency: 'USD',
        priceType: 'fixed',
        bookable: true,
        active: true,
        sortOrder: 0,
        aliases: [],
        bookingNotes: null,
      },
      {
        id: '99999999-9999-4999-8999-999999999999',
        shopId: shop.id,
        categoryId: '77777777-7777-4777-8777-777777777777',
        name: "Women's Haircut",
        durationMinutes: 60,
        priceAmount: 65,
        priceCurrency: 'USD',
        priceType: 'fixed',
        bookable: true,
        active: true,
        sortOrder: 1,
        aliases: [],
        bookingNotes: null,
      },
    ],
  };

  const prompt = buildSystemPrompt({ shop, customer: null, mode: 'inbound' });

  assert.match(prompt, /Color Consultation \| free \| 20 min/);
  assert.doesNotMatch(prompt, /Color Consultation[^\n]*varies/);
  assert.match(prompt, /Women's Haircut \| \$65 \| 60 min/);
});

test('Production prompt: a legacy (non-catalog) shop with a $0 service also renders free, not "varies"', () => {
  const shop = createShop('professional');
  shop.services = [{ name: 'Free Consultation', duration_min: 15, price: 0 }];

  const prompt = buildSystemPrompt({ shop, customer: null, mode: 'inbound' });

  assert.match(prompt, /Free Consultation \| free \| 15 min/);
});

test('Production prompt is unaffected by the demo-only BOOKING TIME CHECK instruction (production still calls real tools)', () => {
  const prompt = buildSystemPrompt({ shop: createShop('professional'), customer: null, mode: 'inbound' });

  assert.doesNotMatch(prompt, /BOOKING TIME CHECK/);
  // Production keeps its own real-tool-calling rule from the universal guardrails, unchanged.
  assert.match(prompt, /silently call validate_appointment_time before confirming, rejecting, or proceeding/);
});

test('Production prompt instructs the model to resolve relative time expressions against CURRENT LOCAL TIME', () => {
  // Added after a live demo audit found the model fabricating a clock time for "in 15 minutes"
  // with no traceable source. validate_appointment_time only accepts an already-resolved
  // absolute date/time (YYYY-MM-DD / HH:MM), so this resolution step has to happen correctly
  // in the model's own reasoning before the tool is ever called -- production needs this
  // instruction just as much as demo, even though production always has real CURRENT LOCAL TIME.
  const prompt = buildSystemPrompt({ shop: createShop('professional'), customer: null, mode: 'inbound' });

  assert.match(prompt, /RELATIVE TIME RESOLUTION/);
  assert.match(prompt, /compute the actual target date and time by adding the stated offset to CURRENT LOCAL TIME/);
  assert.match(prompt, /roll the target over to the next calendar day before treating it as valid/);
  assert.match(prompt, /ask the caller to state a specific day and time instead/);
});
