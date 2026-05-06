import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  ADMIN_AUTH_EMAIL: 'admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});

test('admin can create shop, update plan/settings, and invite admin', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const loginResponse = await app.request('/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'admin@ringbooker.local',
      password: 'change_me_admin_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookieHeader = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookieHeader);

  const createShopResponse = await app.request('/admin/shops', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({
      name: 'Pilot Shop',
      brand_slug: 'pilot-shop',
      phone_number: '+17145558888',
      user_phone: '+17145559999',
      timezone: 'America/Los_Angeles',
      plan: 'starter',
    }),
  });
  assert.equal(createShopResponse.status, 201);
  const createShopBody = (await createShopResponse.json()) as { ok: boolean; shop: { id: string } };
  assert.equal(createShopBody.ok, true);
  const createdShopId = createShopBody.shop.id;
  assert.ok(createdShopId);

  const updatePlanResponse = await app.request(`/admin/shops/${createdShopId}/plan`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({
      plan: 'professional',
      active: true,
    }),
  });
  assert.equal(updatePlanResponse.status, 200);
  const updatePlanBody = (await updatePlanResponse.json()) as { ok: boolean; shop: { plan: string } };
  assert.equal(updatePlanBody.ok, true);
  assert.equal(updatePlanBody.shop.plan, 'professional');

  const approveCommercialResponse = await app.request(`/admin/shops/${createdShopId}/approve-commercial-go-live`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({ note: 'Contract signed and implementation approved.' }),
  });
  assert.equal(approveCommercialResponse.status, 200);
  const approveCommercialBody = (await approveCommercialResponse.json()) as {
    ok: boolean;
    alreadyApproved: boolean;
    accessState: { commercialGoLiveApprovedAt?: string | null; commercialGoLiveApprovedBy?: string | null };
  };
  assert.equal(approveCommercialBody.ok, true);
  assert.equal(approveCommercialBody.alreadyApproved, false);
  assert.ok(approveCommercialBody.accessState.commercialGoLiveApprovedAt);
  assert.equal(approveCommercialBody.accessState.commercialGoLiveApprovedBy, 'admin@ringbooker.local');

  const updateSettingsResponse = await app.request(`/admin/shops/${createdShopId}/settings`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({
      user_name: 'Pilot User',
      booking_url: 'https://ringbooker.com/pilot',
    }),
  });
  assert.equal(updateSettingsResponse.status, 200);
  const updateSettingsBody = (await updateSettingsResponse.json()) as { ok: boolean; shop: { user_name: string } };
  assert.equal(updateSettingsBody.ok, true);
  assert.equal(updateSettingsBody.shop.user_name, 'Pilot User');

  const updateConfigResponse = await app.request(`/admin/shops/${createdShopId}/config`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({
      ai_voice: 'Aoede',
      ai_welcome_message: 'Thanks for calling Pilot Shop.',
      ai_custom_instructions: 'Offer callback before transfer.',
      allow_transfers: false,
      allow_callbacks: true,
      send_reminder_sms: false,
      send_review_request_sms: false,
      send_missed_call_followup_sms: true,
    }),
  });
  assert.equal(updateConfigResponse.status, 200);
  const updateConfigBody = (await updateConfigResponse.json()) as {
    ok: boolean;
    shop: { allow_transfers: boolean; send_reminder_sms: boolean; ai_welcome_message: string };
  };
  assert.equal(updateConfigBody.ok, true);
  assert.equal(updateConfigBody.shop.allow_transfers, false);
  assert.equal(updateConfigBody.shop.send_reminder_sms, false);
  assert.equal(updateConfigBody.shop.ai_welcome_message, 'Thanks for calling Pilot Shop.');

  const inviteResponse = await app.request('/admin/users/invite', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({
      email: 'ops-admin@ringbooker.local',
    }),
  });
  assert.equal(inviteResponse.status, 200);
  const inviteBody = (await inviteResponse.json()) as { ok: boolean; invited: boolean; resetToken?: string };
  assert.equal(inviteBody.ok, true);
  assert.equal(inviteBody.invited, true);
  assert.ok(typeof inviteBody.resetToken === 'string' && inviteBody.resetToken.length > 20);

  const listResponse = await app.request('/admin/users', {
    method: 'GET',
    headers: { cookie: cookieHeader! },
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    ok: boolean;
    users: Array<{ id: string; email: string; role: string; active: boolean }>;
    stats: { total: number };
  };
  assert.equal(listBody.ok, true);
  assert.ok(listBody.stats.total >= 3);
  const invited = listBody.users.find((u) => u.email === 'ops-admin@ringbooker.local');
  assert.ok(invited);
  const primaryAdmin = listBody.users.find((u) => u.email === 'admin@ringbooker.local');
  assert.ok(primaryAdmin);

  const deactivateInvited = await app.request(`/admin/users/${invited!.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(deactivateInvited.status, 200);

  const demoteInvited = await app.request(`/admin/users/${invited!.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({ role: 'user', active: true }),
  });
  assert.equal(demoteInvited.status, 200);

  const lastAdminBlock = await app.request(`/admin/users/${primaryAdmin!.id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({ role: 'user' }),
  });
  assert.equal(lastAdminBlock.status, 400);
  const blockedBody = (await lastAdminBlock.json()) as { ok: boolean; error?: string };
  assert.equal(blockedBody.ok, false);
  assert.equal(blockedBody.error, 'last_active_admin');
});
