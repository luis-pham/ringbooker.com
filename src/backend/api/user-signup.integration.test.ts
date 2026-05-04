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
import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
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
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: new FakePhoneProvisioningService(),
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const searchResponse = await app.request('/auth/user/signup/phone-search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
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
      'origin': 'http://localhost:3000',
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
      plan: 'starter',
    }),
  });
  assert.equal(signupResponse.status, 201);
  const signupBody = (await signupResponse.json()) as {
    ok: boolean;
    role: string;
    shopId: string;
    postAuthRedirect?: string;
  };
  assert.equal(signupBody.ok, true);
  assert.equal(signupBody.role, 'user');
  assert.ok(typeof signupBody.shopId === 'string' && signupBody.shopId.length > 10);
  assert.equal(signupBody.postAuthRedirect, '/user/onboarding');
  const trial = await billingSubscriptionsRepository.findCurrentByShopId(signupBody.shopId);
  assert.equal(trial?.status, 'trialing');
  assert.equal(trial?.plan, 'starter');
  assert.equal(trial?.amountCents, 7900);
  assert.equal(trial?.paymentMethodStatus, 'none');
  assert.ok(trial?.trialStartedAt);
  assert.ok(trial?.trialEndsAt);
  const access = await shopAccessStatesRepository.findByShopId(signupBody.shopId);
  assert.equal(access?.liveCallsEnabled, false);
  assert.equal(access?.liveCallsPausedReason, 'payment_method_required_before_go_live');
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
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const response = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
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
      plan: 'starter',
    }),
  });

  assert.equal(response.status, 409);
  const body = (await response.json()) as { ok: boolean; error?: string; message?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'email_already_exists');
  assert.equal(body.message, 'Account already exists. Please log in to continue.');
});

test('user signup professional creates no-card trial with professional amount', async () => {
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: new FakePhoneProvisioningService(),
    billingCustomersRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const response = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'professional-user@ringbooker.local',
      password: 'new-user-password',
      remember: true,
      plan: 'professional',
    }),
  });

  assert.equal(response.status, 201);
  const body = (await response.json()) as { ok: boolean; shopId: string };
  assert.equal(body.ok, true);
  const subscription = await billingSubscriptionsRepository.findCurrentByShopId(body.shopId);
  assert.equal(subscription?.plan, 'professional');
  assert.equal(subscription?.amountCents, 14900);
  const customer = await billingCustomersRepository.findByShopId(body.shopId, 'paddle');
  assert.equal(customer?.email, 'professional-user@ringbooker.local');
});

test('user signup rejects missing trial plan', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: new FakePhoneProvisioningService(),
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const response = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'no-plan-user@ringbooker.local',
      password: 'new-user-password',
      remember: true,
    }),
  });

  assert.equal(response.status, 400);
  const body = (await response.json()) as { ok: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, 'plan_required');
});

test('google oauth start redirects invalid signup plan to pricing', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    phoneProvisioningService: new FakePhoneProvisioningService(),
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const res = await app.request('/auth/user/google/start?intent=signup&plan=enterprise', { method: 'GET' });
  assert.equal(res.status, 302);
  const loc = res.headers.get('location') ?? '';
  assert.ok(loc.includes('/pricing?reason=plan_required'), loc);
});

test('google oauth callback clears oauth cookies when dependencies unavailable', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const res = await app.request('/auth/user/google/callback?code=x&state=y', {
    method: 'GET',
    headers: {
      cookie:
        'rb_google_oauth_state=teststate; rb_google_oauth_intent=login; rb_google_oauth_selected_plan=starter',
    },
  });
  assert.equal(res.status, 500);
  const combined = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie().join('\n') : (res.headers.get('set-cookie') ?? '');
  assert.ok(
    combined.includes('rb_google_oauth_state') ||
      combined.includes('rb_google_oauth_intent') ||
      combined.includes('rb_google_oauth_selected_plan'),
    `expected Set-Cookie clearing oauth cookies, got: ${combined}`,
  );
});
