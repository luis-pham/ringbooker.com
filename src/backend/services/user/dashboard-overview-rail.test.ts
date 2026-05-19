import test from 'node:test';
import assert from 'node:assert/strict';

import type { Shop } from '@/src/backend/domain/types';
import { buildDashboardOverviewRail, getBusinessKnowledgeStatus } from './dashboard-overview-rail';

function baseShop(patch: Partial<Shop> = {}): Shop {
  return {
    id: 'shop_dashboard_test',
    name: 'Dashboard Test Salon',
    vertical: 'nail_salon',
    phone_number: '+15551234567',
    user_phone: '+15551234567',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Gel Manicure', duration_min: 45, price: 45 }],
    hours: {
      mon: { open: '09:00', close: '17:00' },
      tue: { open: '09:00', close: '17:00' },
      wed: { open: '09:00', close: '17:00' },
      thu: { open: '09:00', close: '17:00' },
      fri: { open: '09:00', close: '17:00' },
      sat: { closed: true },
      sun: { closed: true },
    },
    cancel_policy: 'Please call 24 hours ahead for changes.',
    promotions: null,
    booking_url: null,
    website_url: 'https://dashboard-test.example',
    languages: ['en'],
    current_onboarding_step: 4,
    setup_method: null,
    forwarding_type: null,
    forwarding_carrier: null,
    forwarding_country: null,
    forwarding_number_status: 'none',
    forwarding_number_provisioning_started_at: null,
    forwarding_number_provider_order_id: null,
    forwarding_number_last_error: null,
    telnyx_number: null,
    ai_voice: null,
    ai_welcome_message: null,
    ai_custom_instructions: null,
    allow_transfers: false,
    allow_callbacks: true,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'starter',
    active: true,
    google_cal_id: null,
    google_cal_credentials_encrypted: null,
    staff: [],
    faqs: [{ question: 'Do you take walk-ins?', answer: 'Walk-ins are welcome when available.' }],
    not_offered_services: [],
    ...patch,
  };
}

test('business knowledge status detects incomplete and complete knowledge', () => {
  const incomplete = getBusinessKnowledgeStatus(baseShop({
    services: [],
    service_catalog: { categories: [], services: [] },
    hours: {},
    faqs: [],
  }));
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.missingCore.sort(), ['hours', 'services']);
  assert.deepEqual(incomplete.missingRecommended, ['faq']);

  const complete = getBusinessKnowledgeStatus(baseShop());
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.missingCore, []);
  assert.deepEqual(complete.missingRecommended, []);
});

test('dashboard setup rail keeps go-live checklist focused on activation steps', () => {
  const rail = buildDashboardOverviewRail({
    shop: baseShop({ services: [], service_catalog: { categories: [], services: [] }, faqs: [] }),
    onboardingRequired: false,
    goLive: {
      liveCallsEnabled: false,
      paymentMethodValid: false,
      hasForwardingNumber: false,
      forwardingSetupVerified: false,
    },
    usage: null,
    recentCalls: [],
    totalCallCount: 0,
  });

  assert.equal(rail.variant, 'setup');
  assert.deepEqual(rail.checklist.map((item) => item.title), [
    'Forward missed calls to RingBooker',
    'Verify forwarding',
    'Add your card',
    'Switch it on',
  ]);
  assert.equal(rail.checklist.some((item) => item.id === 'business_knowledge'), false);
});

test('dashboard setup rail omits Business Knowledge from activation checklist when complete', () => {
  const rail = buildDashboardOverviewRail({
    shop: baseShop(),
    onboardingRequired: false,
    goLive: {
      liveCallsEnabled: false,
      paymentMethodValid: true,
      hasForwardingNumber: true,
      forwardingSetupVerified: true,
    },
    usage: null,
    recentCalls: [],
    totalCallCount: 0,
  });

  assert.equal(rail.variant, 'setup');
  assert.equal(rail.checklist.some((item) => item.id === 'business_knowledge'), false);
});

test('live dashboard shows non-blocking AI knowledge health warning when knowledge is incomplete', () => {
  const rail = buildDashboardOverviewRail({
    shop: baseShop({ faqs: [] }),
    onboardingRequired: false,
    goLive: {
      liveCallsEnabled: true,
      paymentMethodValid: true,
      hasForwardingNumber: true,
      forwardingSetupVerified: true,
    },
    usage: null,
    recentCalls: [],
    totalCallCount: 0,
  });

  assert.equal(rail.variant, 'live');
  const knowledge = rail.health.find((item) => item.id === 'business_knowledge');
  assert.ok(knowledge);
  assert.equal(knowledge.label, 'AI knowledge');
  assert.equal(knowledge.state, 'neutral');
  assert.equal(knowledge.href, '/user/knowledge');
});
