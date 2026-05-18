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
  USER_AUTH_EMAIL: 'user-rate-limit@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

test('user login is rate limited after repeated failed attempts', async () => {
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

  let lastStatus = 0;
  for (let i = 0; i < 6; i += 1) {
    const response = await app.request('/auth/user/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'origin': 'http://localhost:3000',
        'x-rb-remote-addr': '10.0.0.99',
        'x-forwarded-for': '10.0.0.99',
      },
      body: JSON.stringify({
        email: 'user-rate-limit@ringbooker.local',
        password: 'wrong-password',
      }),
    });
    lastStatus = response.status;
  }

  assert.equal(lastStatus, 429);
});
