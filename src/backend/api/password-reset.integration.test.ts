import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'reset-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'initial_password_123',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

test('user forgot/reset password rotates credential and supports new login', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const forgotResponse = await app.request('/auth/user/forgot-password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'reset-user@ringbooker.local',
    }),
  });
  assert.equal(forgotResponse.status, 200);
  const forgotBody = (await forgotResponse.json()) as { resetToken?: string };
  assert.ok(forgotBody.resetToken);

  const resetResponse = await app.request('/auth/reset-password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      token: forgotBody.resetToken,
      newPassword: 'new_password_123',
    }),
  });
  assert.equal(resetResponse.status, 200);

  const oldLogin = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'reset-user@ringbooker.local',
      password: 'initial_password_123',
    }),
  });
  assert.equal(oldLogin.status, 401);

  const newLogin = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'reset-user@ringbooker.local',
      password: 'new_password_123',
    }),
  });
  assert.equal(newLogin.status, 200);
});
