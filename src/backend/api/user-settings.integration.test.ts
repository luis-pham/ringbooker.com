import test from 'node:test';
import assert from 'node:assert/strict';

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

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const loginResponse = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie!;
}

test('starter plan user settings expose capabilities and reject locked fields', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter', active: true });

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

  const cookie = await loginUser(app);

  const getResponse = await app.request('/user/settings', {
    headers: {
      cookie,
    },
  });
  assert.equal(getResponse.status, 200);
  const getBody = (await getResponse.json()) as {
    ok: boolean;
    shop: { plan: string };
    capabilities: { edit_ai_voice: boolean; edit_ai_custom_instructions: boolean };
  };
  assert.equal(getBody.ok, true);
  assert.equal(getBody.shop.plan, 'starter');
  assert.equal(getBody.capabilities.edit_ai_voice, false);
  assert.equal(getBody.capabilities.edit_ai_custom_instructions, false);

  const blockedResponse = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      send_review_request_sms: true,
      ai_custom_instructions: 'Only offer premium routing.',
    }),
  });
  assert.equal(blockedResponse.status, 403);
  const blockedBody = (await blockedResponse.json()) as { ok: boolean; error: string; fields: string[] };
  assert.equal(blockedBody.ok, false);
  assert.equal(blockedBody.error, 'plan_feature_locked');
  assert.deepEqual(blockedBody.fields.sort(), ['ai_custom_instructions']);

  const allowedResponse = await app.request('/user/settings', {
    method: 'PUT',
    headers: {
      cookie,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      cancel_policy: 'Appointments should be canceled at least 24 hours before the scheduled time.',
      allow_callbacks: false,
    }),
  });
  assert.equal(allowedResponse.status, 200);
  const allowedBody = (await allowedResponse.json()) as {
    ok: boolean;
    shop: { cancel_policy: string; allow_callbacks: boolean };
  };
  assert.equal(allowedBody.ok, true);
  assert.equal(allowedBody.shop.allow_callbacks, false);
  assert.equal(
    allowedBody.shop.cancel_policy,
    'Appointments should be canceled at least 24 hours before the scheduled time.',
  );
});

test('professional plan user can save professional-tier automation fields', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'professional', active: true });

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
      ai_voice: 'Puck',
      ai_welcome_message: 'Welcome to RingBooker Demo Salon. I can help with bookings and pricing.',
      send_reminder_sms: false,
      send_review_request_sms: false,
    }),
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    shop: {
      ai_voice: string;
      ai_welcome_message: string;
      send_reminder_sms: boolean;
      send_review_request_sms: boolean;
    };
    capabilities: {
      edit_ai_custom_instructions: boolean;
    };
  };
  assert.equal(body.ok, true);
  assert.equal(body.shop.ai_voice, 'Puck');
  assert.equal(body.shop.send_reminder_sms, false);
  assert.equal(body.shop.send_review_request_sms, false);
  assert.equal(body.capabilities.edit_ai_custom_instructions, false);
});
