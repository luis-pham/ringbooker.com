import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop, ShopPlan } from '@/src/backend/domain/types';
import {
  DEFAULT_RUNTIME_AI_VOICE,
  DEFAULT_RUNTIME_GREETING,
  resolveEffectiveRuntimeConfig,
} from '@/src/backend/domain/resolve-effective-runtime-config';

function createDowngradedShop(plan: ShopPlan): Shop {
  return {
    id: `runtime-config-${plan}`,
    name: 'Runtime Config Salon',
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
    active: true,
    plan,
    ai_welcome_message: 'Custom paid greeting',
    ai_voice: 'Verse',
    ai_custom_instructions: 'Use enterprise-only escalation wording.',
    staff: [
      {
        name: 'Mia',
        role: 'Stylist',
        specialties: ['Color'],
        notes: 'Enterprise-era provider note',
        active: true,
      },
    ],
  };
}

test('Starter runtime config strips paid fields from a previously upgraded shop', () => {
  const config = resolveEffectiveRuntimeConfig(createDowngradedShop('starter'));

  assert.equal(config.aiWelcomeMessage, DEFAULT_RUNTIME_GREETING);
  assert.equal(config.aiVoice, DEFAULT_RUNTIME_AI_VOICE);
  assert.equal(config.aiCustomInstructions, null);
  assert.deepEqual(config.staff, []);
});

test('Professional runtime config allows Pro fields and strips Enterprise instructions', () => {
  const config = resolveEffectiveRuntimeConfig(createDowngradedShop('professional'));

  assert.equal(config.aiWelcomeMessage, 'Custom paid greeting');
  assert.equal(config.aiVoice, 'Verse');
  assert.equal(config.aiCustomInstructions, null);
  assert.equal(config.staff?.[0]?.name, 'Mia');
});

test('Enterprise runtime config allows all paid runtime fields', () => {
  const config = resolveEffectiveRuntimeConfig(createDowngradedShop('enterprise'));

  assert.equal(config.aiWelcomeMessage, 'Custom paid greeting');
  assert.equal(config.aiVoice, 'Verse');
  assert.equal(config.aiCustomInstructions, 'Use enterprise-only escalation wording.');
  assert.equal(config.staff?.[0]?.name, 'Mia');
});
