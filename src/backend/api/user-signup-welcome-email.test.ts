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
import type { EmailService, EmailSendResult } from '@/src/backend/services/email/types';
import { hashEmailVerificationToken } from '@/src/backend/security/email-verification';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

class RecordingEmailService implements EmailService {
  readonly sent: Array<Parameters<EmailService['sendEmail']>[0]> = [];

  async sendEmail(params: Parameters<EmailService['sendEmail']>[0]): Promise<EmailSendResult> {
    this.sent.push(params);
    return { providerMessageId: `test_email_${this.sent.length}` };
  }
}

function createSignupTestApp(emailService: RecordingEmailService) {
  const authUsersRepository = new InMemoryAuthUsersRepository();
  return createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    emailService,
  });
}

function createSignupTestRuntime(emailService: RecordingEmailService) {
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    emailService,
  });
  return { app, authUsersRepository };
}

test('email/password signup sends welcome email via emailService', async () => {
  const emailService = new RecordingEmailService();
  const app = createSignupTestApp(emailService);

  const signupResponse = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      shopName: 'Welcome Test Salon',
      email: 'welcome-test@example.com',
      password: 'welcome-test-password',
      remember: true,
      plan: 'starter',
    }),
  });

  assert.equal(signupResponse.status, 201);
  assert.equal(emailService.sent.length, 2);
  assert.equal(emailService.sent[0]?.category, 'email_verification');
  assert.equal(emailService.sent[0]?.to, 'welcome-test@example.com');
  assert.match(emailService.sent[0]?.idempotencyKey ?? '', /^email-verification:/);
  assert.match(emailService.sent[0]?.subject ?? '', /confirm/i);
  assert.equal(emailService.sent[1]?.category, 'welcome_signup');
  assert.equal(emailService.sent[1]?.to, 'welcome-test@example.com');
  assert.match(emailService.sent[1]?.idempotencyKey ?? '', /^signup-welcome:/);
  assert.match(emailService.sent[1]?.subject ?? '', /welcome/i);
});

test('email/password signup verification token can verify email and rejects used token', async () => {
  const emailService = new RecordingEmailService();
  const { app } = createSignupTestRuntime(emailService);

  const signupResponse = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      shopName: 'Verify Test Salon',
      email: 'verify-test@example.com',
      password: 'verify-test-password',
      remember: true,
      plan: 'starter',
    }),
  });

  assert.equal(signupResponse.status, 201);
  const signupBody = (await signupResponse.json()) as { verificationToken?: string };
  assert.ok(signupBody.verificationToken);
  const cookieHeader = signupResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookieHeader);

  const verifyResponse = await app.request('/auth/verify-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: signupBody.verificationToken }),
  });
  assert.equal(verifyResponse.status, 200);

  const meResponse = await app.request('/auth/me', {
    method: 'GET',
    headers: { cookie: cookieHeader },
  });
  assert.equal(meResponse.status, 200);
  const meBody = (await meResponse.json()) as { session: { emailVerified?: boolean } };
  assert.equal(meBody.session.emailVerified, true);

  const usedResponse = await app.request('/auth/verify-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: signupBody.verificationToken }),
  });
  assert.equal(usedResponse.status, 409);
  const usedBody = (await usedResponse.json()) as { status?: string };
  assert.equal(usedBody.status, 'already_verified');
});

test('expired email verification token is rejected and resend is rate limited', async () => {
  const emailService = new RecordingEmailService();
  const { app, authUsersRepository } = createSignupTestRuntime(emailService);

  const signupResponse = await app.request('/auth/user/signup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      shopName: 'Expired Test Salon',
      email: 'expired-test@example.com',
      password: 'expired-test-password',
      remember: true,
      plan: 'starter',
    }),
  });
  assert.equal(signupResponse.status, 201);
  const cookieHeader = signupResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookieHeader);
  const authUser = await authUsersRepository.findByEmail('expired-test@example.com');
  assert.ok(authUser);

  const expiredRaw = 'a'.repeat(64);
  await authUsersRepository.createEmailVerificationToken({
    authUserId: authUser.id,
    tokenHash: hashEmailVerificationToken(expiredRaw),
    expiresAt: new Date(Date.now() - 1000),
  });

  const expiredResponse = await app.request('/auth/verify-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: expiredRaw }),
  });
  assert.equal(expiredResponse.status, 410);

  for (let i = 0; i < 3; i += 1) {
    const resend = await app.request('/auth/resend-verification', {
      method: 'POST',
      headers: {
        cookie: cookieHeader,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    assert.equal(resend.status, 200);
  }
  const limited = await app.request('/auth/resend-verification', {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      origin: 'http://localhost:3000',
      host: 'localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  assert.equal(limited.status, 429);
});
