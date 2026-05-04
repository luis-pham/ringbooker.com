import test from 'node:test';
import assert from 'node:assert/strict';

import type { Customer, Shop } from '@/src/backend/domain/types';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';

function createShop(plan: Shop['plan']): Shop {
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
