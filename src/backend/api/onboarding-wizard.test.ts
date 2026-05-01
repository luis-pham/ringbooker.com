import test from 'node:test';
import assert from 'node:assert/strict';

import { applyVerticalLanguageSelection, validateOnboardingStep1 } from '@/components/user/user-onboarding-live';
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

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const response = await app.request('/auth/user/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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

test('Step 1 validation requires business name, vertical, and phone', () => {
  assert.deepEqual(validateOnboardingStep1({ businessName: '', vertical: '', businessPhone: '' }), [
    'Business name is required.',
    'Business type is required.',
    'Business phone number is required.',
  ]);
});

test('Vietnamese auto-selected for nail salon', () => {
  assert.deepEqual(applyVerticalLanguageSelection('nail_salon', ['en']).sort(), ['en', 'vi']);
});

test('Step 1 save persists current_onboarding_step', async () => {
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
      name: 'Happy Nails & Spa',
      user_name: 'Happy Nails & Spa',
      vertical: 'nail_salon',
      phone_number: '+15551234567',
      user_phone: '+15551234567',
      current_onboarding_step: 2,
    }),
  });

  assert.equal(response.status, 200);
  const shop = await shopsRepository.findById('demo-shop');
  assert.equal(shop?.current_onboarding_step, 2);
});

test('Completing required onboarding fields makes onboarding status complete without services', async () => {
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
      name: 'Happy Nails & Spa',
      user_name: 'Happy Nails & Spa',
      vertical: 'nail_salon',
      phone_number: '+15551234567',
      user_phone: '+15551234567',
      timezone: 'America/Los_Angeles',
      languages: ['en', 'vi'],
      hours: {
        mon: { open: '09:00', close: '19:00' },
      },
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
