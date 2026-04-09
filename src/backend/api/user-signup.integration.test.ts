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
import type { PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'existing-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

class FakePhoneProvisioningService implements PhoneProvisioningService {
  async searchAvailableNumbers() {
    return [
      {
        phoneNumber: '+17145556666',
        locality: 'Garden Grove',
        administrativeArea: 'CA',
        countryCode: 'US',
      },
      {
        phoneNumber: '+17145557777',
        locality: 'Anaheim',
        administrativeArea: 'CA',
        countryCode: 'US',
      },
    ];
  }

  async provisionNumber(params: { phoneNumber: string; requestId: string }) {
    return {
      phoneNumber: params.phoneNumber,
      providerNumberId: `test-${params.phoneNumber.replace(/\D/g, '')}`,
      orderId: `order-${params.requestId}`,
    };
  }
}

test('user signup supports phone search and creates authenticated session', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: new FakePhoneProvisioningService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const searchResponse = await app.request('/auth/user/signup/phone-search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      countryCode: 'US',
      locality: 'Garden Grove',
      administrativeArea: 'CA',
    }),
  });
  assert.equal(searchResponse.status, 200);
  const searchBody = (await searchResponse.json()) as { ok: boolean; numbers: Array<{ phoneNumber: string }> };
  assert.equal(searchBody.ok, true);
  assert.equal(searchBody.numbers.length > 0, true);

  const signupResponse = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      shopName: 'Luxe Nails Garden Grove',
      userName: 'Kim Tran',
      userPhone: '+17145550009',
      timezone: 'America/Los_Angeles',
      phoneNumber: '+17145556666',
      email: 'new-user@ringbooker.local',
      password: 'new-user-password',
      remember: true,
    }),
  });
  assert.equal(signupResponse.status, 201);
  const signupBody = (await signupResponse.json()) as { ok: boolean; role: string; shopId: string };
  assert.equal(signupBody.ok, true);
  assert.equal(signupBody.role, 'user');
  assert.ok(typeof signupBody.shopId === 'string' && signupBody.shopId.length > 10);
  const setCookie = signupResponse.headers.get('set-cookie');
  assert.ok(setCookie);
  const cookieHeader = setCookie.split(';')[0];

  const meResponse = await app.request('/auth/me', {
    method: 'GET',
    headers: {
      cookie: cookieHeader,
    },
  });
  assert.equal(meResponse.status, 200);
  const meBody = (await meResponse.json()) as { ok: boolean; session: { role: string; email: string; shopId?: string } };
  assert.equal(meBody.ok, true);
  assert.equal(meBody.session.role, 'user');
  assert.equal(meBody.session.email, 'new-user@ringbooker.local');
  assert.equal(typeof meBody.session.shopId, 'string');
});

test('user signup rejects duplicate email', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: new FakePhoneProvisioningService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const response = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      shopName: 'Duplicated Email Shop',
      userName: 'Dup',
      userPhone: '+17145550008',
      timezone: 'America/Los_Angeles',
      phoneNumber: '+17145557777',
      email: 'existing-user@ringbooker.local',
      password: 'new-user-password',
      remember: true,
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'email_already_exists');
});
