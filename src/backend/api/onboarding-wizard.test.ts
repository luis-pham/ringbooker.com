import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  applyVerticalLanguageSelection,
  validateOnboardingProfileReview,
  validateOnboardingStep1,
  validateOnboardingStep1Quick,
  confidenceLabel,
  importReviewBadgeState,
  importRecommendedActionMessage,
  importProgressDelayMessage,
  importProgressStepIndex,
  importResultMessage,
  isHttpWebsiteUrl,
  IMPORT_PROGRESS_STEPS,
  secondaryImportSuggestionCount,
  serviceReviewBadgeState,
  serviceSourceLabel,
} from '@/components/user/user-onboarding-live';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

function createOnboardingTestApp() {
  const shopsRepository = new InMemoryShopsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  return { app, shopsRepository };
}

let onboardingLoginCounter = 0;

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  onboardingLoginCounter += 1;
  const response = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': `127.10.0.${onboardingLoginCounter}`,
    },
    body: JSON.stringify({
      email: 'user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

test('Legacy step 1 validation requires business name and phone (vertical optional)', () => {
  assert.deepEqual(validateOnboardingStep1({ businessName: '', vertical: '', businessPhone: '' }), [
    'Business name is required.',
    'Business phone number is required.',
  ]);
});

test('Find step quick validation allows continuing without business phone', () => {
  assert.deepEqual(validateOnboardingStep1Quick({ businessPhone: '' }), []);
  assert.deepEqual(validateOnboardingStep1Quick({ businessPhone: '+15551234567' }), []);
});

test('website URL validation accepts http and https links', () => {
  assert.equal(isHttpWebsiteUrl('https://example.com'), true);
  assert.equal(isHttpWebsiteUrl('http://example.com'), true);
  assert.equal(isHttpWebsiteUrl('example.com'), true);
  assert.equal(isHttpWebsiteUrl('mailto:test@example.com'), false);
});

test('Profile review validation requires business name', () => {
  assert.deepEqual(validateOnboardingProfileReview({ businessName: '' }), ['Business name is required.']);
});

test('Vietnamese auto-selected for nail salon', () => {
  assert.deepEqual(applyVerticalLanguageSelection('nail_salon', ['en']).sort(), ['en', 'vi']);
});

test('onboarding import confidence labels map to review states', () => {
  assert.equal(confidenceLabel(0.94), 'AI verified');
  assert.equal(confidenceLabel(0.62), 'Needs review');
  assert.equal(confidenceLabel(undefined), 'Missing');
});

test('onboarding import review badge state maps rendered labels and sources', () => {
  assert.deepEqual(importReviewBadgeState({ value: 'Demo Salon', confidence: 0.94, source: 'Google Places' }), { label: 'AI verified', source: 'Google' });
  assert.deepEqual(importReviewBadgeState({ value: 'Demo Salon', confidence: 0.62, source: 'Website' }), { label: 'Needs review', source: 'Website' });
  assert.deepEqual(importReviewBadgeState({ value: null, confidence: 0, source: null }), { label: 'Missing', source: '' });
  assert.deepEqual(importReviewBadgeState({ value: 'https://demo.test', confidence: 0.95, source: 'User' }), { label: 'AI verified', source: 'User' });
  assert.deepEqual(importReviewBadgeState({ value: 'Balayage', confidence: 0.91, source: 'AI' }), { label: 'AI verified', source: 'Website analysis' });
});

test('onboarding imported service metadata maps to review badges and source labels', () => {
  assert.deepEqual(serviceReviewBadgeState({ needsReview: true, confidence: 0.92, source: 'Website', sourceHint: 'repeated_card' }), {
    label: 'Needs review',
    source: 'Website',
  });
  assert.deepEqual(serviceReviewBadgeState({ needsReview: false, confidence: 0.94, source: 'Website', sourceHint: 'jsonld' }), {
    label: 'AI verified',
    source: 'Website',
  });
  assert.deepEqual(serviceReviewBadgeState({ needsReview: false, confidence: 0.66, source: 'AI', sourceHint: 'llm_block_normalizer' }), {
    label: 'Needs review',
    source: 'Website analysis',
  });
  assert.deepEqual(serviceReviewBadgeState({ needsReview: false, confidence: 0.8, source: 'text_fallback', sourceHint: 'text_fallback' }), {
    label: 'Review',
    source: 'Imported',
  });
  assert.equal(serviceReviewBadgeState({}), null);
  assert.equal(serviceSourceLabel('block_detector', 'repeated_card'), 'Website');
  assert.equal(serviceSourceLabel('llm', 'llm_block_normalizer'), 'Website analysis');
  assert.equal(serviceSourceLabel(null, null), 'Imported');
});

test('imported website text renders escaped in React text nodes', () => {
  // Closest non-browser coverage for the onboarding review path: imported warnings/services are rendered as JSX text.
  const malicious = '<script>window.__xss = true</script><img src=x onerror=alert(1)>';
  const html = renderToStaticMarkup(React.createElement('div', null, [
    React.createElement('p', { key: 'warning' }, malicious),
    React.createElement('span', { key: 'service' }, `Service: ${malicious}`),
  ]));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});

test('imported service text renders escaped in React text nodes', () => {
  const maliciousEvidence = 'Evidence: <script>alert("x")</script><b>Balayage</b>';
  const html = renderToStaticMarkup(React.createElement('span', null, maliciousEvidence));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<b>Balayage</b>'), false);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;Balayage&lt;\/b&gt;/);
});

test('onboarding services UI keeps row content focused on name price duration and edit', () => {
  const onboardingLive = readFileSync('components/user/user-onboarding-live.tsx', 'utf8');
  assert.match(onboardingLive, /Review imported services before saving/);
  assert.match(onboardingLive, /Some imported services may need review/);
  assert.match(onboardingLive, /Check names, prices, and durations before saving/);
  assert.match(onboardingLive, /You can remove anything that does not belong/);
  assert.match(onboardingLive, /const showAlsoOffers = manualSetup \|\| importedServiceCount < 5 \|\| !hasNamedGroups/);
  assert.match(onboardingLive, /Review your services/);
  assert.match(onboardingLive, /click any row to edit/);
  assert.match(onboardingLive, /tap any to edit/);
  assert.match(onboardingLive, /Pick the categories you offer/);
  assert.match(onboardingLive, /onb-service-name/);
  assert.match(onboardingLive, /onb-service-price/);
  assert.match(onboardingLive, /onb-service-duration/);
  assert.match(onboardingLive, /onb-service-edit-link/);
  assert.match(onboardingLive, /service-remove-btn/);
  assert.match(onboardingLive, /className="svc-row"/);
  assert.match(onboardingLive, /className="svc-body"/);
  assert.match(onboardingLive, /className="svc-meta"/);
  assert.match(onboardingLive, /className="svc-remove"/);
  assert.match(onboardingLive, /event\.stopPropagation\(\)/);
  assert.match(onboardingLive, /removeServiceRow/);
  assert.match(onboardingLive, /onb-service-sheet-overlay/);
  assert.match(onboardingLive, /onb-service-edit-row/);
  assert.doesNotMatch(onboardingLive, /service-review-badge|service-review-source|service-evidence/);
  assert.doesNotMatch(onboardingLive, /selectedPages|rawHtml|rawGoogle|rawLlm/);
});

test('onboarding import recommended action maps to review copy', () => {
  assert.equal(importRecommendedActionMessage('ready_for_review'), 'We found enough details to get started. Please review before saving.');
  assert.equal(importRecommendedActionMessage('needs_manual_review'), 'Some details need your review before saving.');
  assert.equal(importRecommendedActionMessage('partial_import'), 'We found some details, but you may need to add missing information manually.');
  assert.equal(importRecommendedActionMessage('manual_setup_recommended'), 'We couldn’t find enough details. You can set this up manually.');
  assert.equal(importRecommendedActionMessage('service_details_incomplete'), 'We found your business details, but services may need review.');
});

test('onboarding website import progress copy uses phased states without percentages', () => {
  assert.deepEqual([...IMPORT_PROGRESS_STEPS], [
    'Reading your website',
    'Finding your services page',
    'Extracting services and hours',
    'Building your profile',
  ]);
  assert.equal(importProgressStepIndex(0), 0);
  assert.equal(importProgressStepIndex(1900), 1);
  assert.equal(importProgressStepIndex(4200), 2);
  assert.equal(importProgressStepIndex(7000), 3);
  assert.equal(importProgressDelayMessage(8500), 'Still working... Some websites take longer to read.');
  assert.equal(importProgressDelayMessage(20000), 'We’re still importing your website. Please wait a little longer.');
  assert.equal(importProgressDelayMessage(120000), 'This is taking longer than expected. You can continue manually and edit everything later.');
  assert.equal(importResultMessage({ status: 'success', sourceUrl: 'https://demo.test', businessProfile: {} }), 'Ready to review');
  assert.equal(importResultMessage({ status: 'partial', sourceUrl: 'https://demo.test', businessProfile: {} }), 'Some details need review');
  assert.equal(importResultMessage(null, true), 'We couldn’t import this automatically. You can still set this up manually.');
  assert.equal(secondaryImportSuggestionCount({ status: 'success', sourceUrl: 'https://demo.test', businessProfile: {}, staffSuggestions: [{}], faqSuggestions: [{}, {}] }), 3);
  assert.equal(IMPORT_PROGRESS_STEPS.some((label) => /%/.test(label)), false);
});

test('onboarding copy keeps website import review-only and isolates legacy read-website', () => {
  const onboardingLive = readFileSync('components/user/user-onboarding-live.tsx', 'utf8');
  const app = readFileSync('src/backend/api/app.ts', 'utf8');
  assert.match(onboardingLive, /Paste your website or Google Maps link — we'll fill in the details/);
  assert.match(onboardingLive, /Enter a valid website URL or Google Maps link/);
  assert.doesNotMatch(onboardingLive, /We'll save this link today/);
  assert.match(onboardingLive, /No website\? Fill in manually/);
  assert.match(onboardingLive, /Set up manually instead/);
  assert.match(onboardingLive, /You’ll review and edit everything before saving/);
  assert.doesNotMatch(onboardingLive, /selectedPages|rawHtml/);
  assert.doesNotMatch(onboardingLive, /I&apos;ll enter details manually/);
  assert.doesNotMatch(onboardingLive, /refine prices, aliases, booking notes, and capture-request rules later in Business Knowledge/);
  assert.match(onboardingLive, /staff, policies, FAQs, promotions, or booking setup hints you can review later in Business Knowledge/);
  assert.ok(onboardingLive.includes('/api/backend/user/onboarding/import-website'));
  assert.equal(onboardingLive.includes('/api/backend/user/read-website'), false);
  assert.match(app, /Legacy mutating website import endpoint/);
  assert.match(app, /suggestions-only flow that waits for user confirmation/);
});

test('Step 1 minimal save can continue without phone and does not persist import fields', async () => {
  const { app, shopsRepository } = createOnboardingTestApp();
  const cookie = await loginUser(app);
  const before = await shopsRepository.findById('demo-shop');
  assert.ok(before);

  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      current_onboarding_step: 2,
    }),
  });

  assert.equal(response.status, 200);
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.current_onboarding_step, 2);
  assert.equal(shop?.phone_number, before.phone_number);
  assert.equal(shop?.user_phone, before.user_phone);
  assert.equal(shop?.vertical, before.vertical);
  assert.equal(shop?.website_url, before.website_url);
});



test('Confirmed profile review saves selected profile fields and website URL', async () => {
  const { app, shopsRepository } = createOnboardingTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Confirmed Salon',
      user_name: 'Confirmed Salon',
      vertical: 'hair_salon',
      phone_number: '+15551234567',
      user_phone: '+15551234567',
      timezone: 'America/Los_Angeles',
      languages: ['en'],
      website_url: 'https://confirmedsalon.example',
      current_onboarding_step: 3,
    }),
  });

  assert.equal(response.status, 200);
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.name, 'Confirmed Salon');
  assert.equal(shop?.vertical, 'hair_salon');
  assert.equal(shop?.website_url, 'https://confirmedsalon.example');
  assert.equal(shop?.current_onboarding_step, 3);
});

test('Confirmed profile review saves user-edited values over imported suggestions', async () => {
  const { app, shopsRepository } = createOnboardingTestApp();
  const cookie = await loginUser(app);

  const before = await shopsRepository.findById('demo-shop');
  assert.ok(before);

  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Owner Edited Salon',
      user_name: 'Owner Edited Salon',
      vertical: 'nail_salon',
      phone_number: '469-426-4308',
      user_phone: '4694264308',
      timezone: 'America/New_York',
      languages: ['en'],
      address: 'Owner Edited Address, New York, NY',
      website_url: 'https://owner-edited.example',
      current_onboarding_step: 3,
    }),
  });

  assert.equal(response.status, 200);
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.name, 'Owner Edited Salon');
  assert.equal(shop?.phone_number, '+14694264308');
  assert.equal(shop?.user_phone, '+14694264308');
  assert.equal(shop?.vertical, 'nail_salon');
  assert.equal(shop?.timezone, 'America/New_York');
  assert.equal(shop?.address, 'Owner Edited Address, New York, NY');
  assert.equal(shop?.website_url, 'https://owner-edited.example');
  assert.deepEqual(shop?.services, before.services);
});

test('Completing required onboarding fields makes onboarding status complete with services and step 4', async () => {
  const { app } = createOnboardingTestApp();
  const cookie = await loginUser(app);

  const save = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      phone_number: '+15551234567',
      user_phone: '+15551234567',
      timezone: 'America/Los_Angeles',
      languages: ['en', 'vi'],
      hours: {
        mon: { open: '09:00', close: '19:00' },
      },
      services: [{ name: 'Manicure', duration_min: 45, price: 35 }],
      current_onboarding_step: 4,
    }),
  });
  assert.equal(save.status, 200);

  const status = await app.request('/user/onboarding-status', {
    headers: { cookie },
  });
  assert.equal(status.status, 200);
  const body = (await status.json()) as { ok: boolean; onboardingRequired: boolean };
  assert.equal(body.ok, true);
  assert.equal(body.onboardingRequired, false);
});

test('Onboarding can complete without services after reaching test step', async () => {
  const { app } = createOnboardingTestApp();
  const cookie = await loginUser(app);

  const save = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Mixed Beauty Studio',
      user_name: 'Mixed Beauty Studio',
      vertical: 'nail_salon',
      phone_number: '+15551234567',
      user_phone: '+15551234567',
      timezone: 'America/Los_Angeles',
      hours: {
        mon: { open: '09:00', close: '19:00' },
      },
      services: [],
      current_onboarding_step: 4,
    }),
  });
  assert.equal(save.status, 200);

  const status = await app.request('/user/onboarding-status', {
    headers: { cookie },
  });
  assert.equal(status.status, 200);
  const body = (await status.json()) as { ok: boolean; onboardingRequired: boolean };
  assert.equal(body.ok, true);
  assert.equal(body.onboardingRequired, false);
});

test('Confirmed services review saves user-edited imported service values', async () => {
  const { app, shopsRepository } = createOnboardingTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      services: [
        {
          name: 'Edited Balayage',
          duration_min: 75,
          duration_text: '75 min',
          price: 180,
          group: 'Hair Color',
          confidence: 0.42,
          needsReview: true,
          evidenceSnippet: '<script>raw</script>',
        },
      ],
      current_onboarding_step: 4,
    }),
  });

  assert.equal(response.status, 200);
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.services[0]?.name, 'Edited Balayage');
  assert.equal(shop?.services[0]?.duration_min, 75);
  assert.equal(shop?.services[0]?.price, 180);
  const savedService = shop?.services[0] as unknown as Record<string, unknown>;
  assert.equal(savedService.confidence, undefined);
  assert.equal(savedService.evidenceSnippet, undefined);
});
