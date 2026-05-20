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
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    emailService,
  });
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
  assert.equal(emailService.sent.length, 1);
  assert.equal(emailService.sent[0]?.category, 'welcome_signup');
  assert.equal(emailService.sent[0]?.to, 'welcome-test@example.com');
  assert.match(emailService.sent[0]?.idempotencyKey ?? '', /^signup-welcome:/);
  assert.match(emailService.sent[0]?.subject ?? '', /welcome/i);
});
