import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryContactRequestsRepository } from '@/src/backend/adapters/memory/contact-requests-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  ADMIN_AUTH_EMAIL: 'admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});

test('public contact request is persisted and admin can update lead status', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    contactRequestsRepository: new InMemoryContactRequestsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const publicResponse = await app.request('/public/contact/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '11.22.33.44',
    },
    body: JSON.stringify({
      fullName: 'Alex Chen',
      businessName: 'Halo Nails',
      email: 'owner@halonails.com',
      phoneNumber: '+17145550199',
      businessType: 'Nail Salon',
      currentSetup: 'Manual',
      helpNeed: 'Need AI to answer peak-hour calls.',
      bestTime: 'Mornings',
      captchaToken: 'dev-turnstile-bypass',
      sessionId: 'contact_session_test_001',
    }),
  });

  assert.equal(publicResponse.status, 200);
  const publicBody = (await publicResponse.json()) as { ok: boolean; requestId: string };
  assert.equal(publicBody.ok, true);
  assert.ok(typeof publicBody.requestId === 'string' && publicBody.requestId.length > 10);

  const loginResponse = await app.request('/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@ringbooker.local',
      password: 'change_me_admin_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookieHeader = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookieHeader);

  const listResponse = await app.request('/admin/leads', {
    headers: {
      cookie: cookieHeader!,
    },
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    ok: boolean;
    leads: Array<{ id: string; requestId: string; status: string }>;
  };
  assert.equal(listBody.ok, true);
  assert.ok(Array.isArray(listBody.leads));
  assert.equal(listBody.leads.length, 1);
  assert.equal(listBody.leads[0]?.requestId, publicBody.requestId);
  assert.equal(listBody.leads[0]?.status, 'new');

  const leadId = listBody.leads[0]?.id;
  assert.ok(leadId);
  const updateResponse = await app.request(`/admin/leads/${encodeURIComponent(leadId!)}/status`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader!,
    },
    body: JSON.stringify({
      status: 'contacted',
      notes: 'Owner requested callback at 10am.',
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updateBody = (await updateResponse.json()) as {
    ok: boolean;
    lead?: { status: string; notes?: string | null; handledBy?: string | null };
  };
  assert.equal(updateBody.ok, true);
  assert.equal(updateBody.lead?.status, 'contacted');
  assert.equal(updateBody.lead?.notes, 'Owner requested callback at 10am.');
  assert.equal(updateBody.lead?.handledBy, 'admin@ringbooker.local');
});
