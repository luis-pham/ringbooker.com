import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import {
  hasReachedOnboardingTestStep,
  isShopSetupWizardComplete,
  shopHasConfiguredServices,
} from '@/src/backend/domain/shop-onboarding';

function minimalShop(over: Partial<Shop> = {}): Shop {
  return {
    id: 's1',
    name: 'Salon',
    vertical: 'nail_salon',
    phone_number: '+15550001111',
    user_phone: '+15550002222',
    user_name: 'Owner',
    timezone: 'America/New_York',
    services: [{ name: 'Manicure', duration_min: 30, price: 20 }],
    hours: { mon: { open: '09:00', close: '17:00' } },
    cancel_policy: '24h',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan: 'starter',
    active: true,
    current_onboarding_step: 4,
    ...over,
  };
}

test('wizard complete requires profile, services, and step 4', () => {
  assert.equal(isShopSetupWizardComplete(minimalShop()), true);
  assert.equal(isShopSetupWizardComplete(minimalShop({ current_onboarding_step: 3 })), false);
  assert.equal(isShopSetupWizardComplete(minimalShop({ services: [] })), false);
  assert.equal(shopHasConfiguredServices(minimalShop({ services: [{ name: '  ', duration_min: 30, price: 0 }] })), false);
  assert.equal(hasReachedOnboardingTestStep(minimalShop({ current_onboarding_step: 4 })), true);
});
