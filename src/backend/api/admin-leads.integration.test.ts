import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryContactRequestsRepository } from '@/src/backend/adapters/memory/contact-requests-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import type { EmailService } from '@/src/backend/services/email/types';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  ADMIN_AUTH_EMAIL: 'admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});


type RecordedEmail = Parameters<EmailService['sendEmail']>[0];

class RecordingEmailService implements EmailService {
  readonly sent: RecordedEmail[] = [];

  async sendEmail(params: RecordedEmail) {
    this.sent.push(params);
    return { providerMessageId: `test-email-${this.sent.length}` };
  }
}

async function adminLogin(app: ReturnType<typeof createBackendApp>) {
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
  return cookieHeader!;
}

function createContactPayload(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Alex Chen',
    businessName: 'Halo Nails',
    email: 'owner@halonails.com',
    phoneNumber: '+17145550199',
    businessType: 'Nail Salon',
    currentSetup: 'Manual',
    helpNeed: 'Need AI to answer peak-hour calls.',
    bestTime: 'Mornings',
    captchaToken: 'dev-turnstile-bypass',
    sessionId: `contact_session_${Math.random().toString(16).slice(2)}`,
    ...overrides,
  };
}

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
      'origin': 'http://localhost:3000',
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
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
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
      'origin': 'http://localhost:3000',
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


test('enterprise contact request persists classification fields and sends enterprise subject', async () => {
  const emailService = new RecordingEmailService();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    contactRequestsRepository: new InMemoryContactRequestsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    emailService,
  });

  const response = await app.request('/public/contact/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': '11.22.33.45',
    },
    body: JSON.stringify(createContactPayload({
      intent: 'enterprise',
      source: 'pricing_custom',
      planInterest: 'enterprise',
      locationCount: 4,
      estimatedCallVolume: '2,000 calls/month',
      bookingSoftware: 'Vagaro',
      routingNeeds: 'Route Location A calls to Location A manager.',
      goLiveTimeline: 'Next 30 days',
      email: 'enterprise@halonails.com',
      sessionId: 'contact_session_enterprise_001',
    })),
  });
  assert.equal(response.status, 200);

  assert.ok(emailService.sent.some((email) => email.subject === '[Enterprise inquiry] Custom setup request from Halo Nails'));
  const internal = emailService.sent.find((email) => email.category === 'contact_request');
  assert.ok(internal?.text?.includes('Intent: enterprise'));
  assert.ok(internal?.text?.includes('Source: pricing_custom'));
  assert.ok(internal?.text?.includes('Plan Interest: enterprise'));
  assert.ok(internal?.text?.includes('Routing Needs: Route Location A calls to Location A manager.'));
  assert.equal(emailService.sent.some((email) => email.category === 'demo_request_confirmation'), false);

  const cookieHeader = await adminLogin(app);
  const listResponse = await app.request('/admin/leads?intent=enterprise', {
    headers: { cookie: cookieHeader },
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    ok: boolean;
    leads: Array<{
      intent: string;
      sourceDetail?: string | null;
      planInterest?: string;
      locationCount?: number | null;
      estimatedCallVolume?: string | null;
      bookingSoftware?: string | null;
      routingNeeds?: string | null;
      goLiveTimeline?: string | null;
    }>;
  };
  assert.equal(listBody.ok, true);
  assert.equal(listBody.leads.length, 1);
  assert.equal(listBody.leads[0]?.intent, 'enterprise');
  assert.equal(listBody.leads[0]?.sourceDetail, 'pricing_custom');
  assert.equal(listBody.leads[0]?.planInterest, 'enterprise');
  assert.equal(listBody.leads[0]?.locationCount, 4);
  assert.equal(listBody.leads[0]?.estimatedCallVolume, '2,000 calls/month');
  assert.equal(listBody.leads[0]?.bookingSoftware, 'Vagaro');
  assert.equal(listBody.leads[0]?.goLiveTimeline, 'Next 30 days');
});

test('demo contact request sends demo subject and customer confirmation', async () => {
  const emailService = new RecordingEmailService();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    contactRequestsRepository: new InMemoryContactRequestsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    emailService,
  });

  const response = await app.request('/public/contact/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': '11.22.33.46',
    },
    body: JSON.stringify(createContactPayload({
      intent: 'demo',
      source: 'homepage_demo',
      email: 'demo@halonails.com',
      sessionId: 'contact_session_demo_001',
    })),
  });
  assert.equal(response.status, 200);
  assert.ok(emailService.sent.some((email) => email.subject === '[Demo request] Halo Nails'));
  assert.ok(emailService.sent.some((email) => email.category === 'demo_request_confirmation'));
});

test('unknown contact intent falls back to general', async () => {
  const emailService = new RecordingEmailService();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    contactRequestsRepository: new InMemoryContactRequestsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    emailService,
  });

  const response = await app.request('/public/contact/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': '11.22.33.47',
    },
    body: JSON.stringify(createContactPayload({
      intent: 'not_real',
      email: 'general@halonails.com',
      sessionId: 'contact_session_general_001',
    })),
  });
  assert.equal(response.status, 200);
  assert.ok(emailService.sent.some((email) => email.subject === '[Contact] Halo Nails'));

  const cookieHeader = await adminLogin(app);
  const listResponse = await app.request('/admin/leads?intent=general', {
    headers: { cookie: cookieHeader },
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as { ok: boolean; leads: Array<{ intent: string }> };
  assert.equal(listBody.ok, true);
  assert.equal(listBody.leads.length, 1);
  assert.equal(listBody.leads[0]?.intent, 'general');
});
