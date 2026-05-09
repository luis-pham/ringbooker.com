import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingNotificationsRepository } from '@/src/backend/adapters/memory/billing-notifications-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { createJobHandlers } from '@/src/backend/jobs/runner';
import type { EmailService } from '@/src/backend/services/email/types';

class RecordingEmailService implements EmailService {
  readonly sent: Array<Parameters<EmailService['sendEmail']>[0]> = [];

  async sendEmail(params: Parameters<EmailService['sendEmail']>[0]) {
    this.sent.push(params);
    return { providerMessageId: `email_${this.sent.length}` };
  }
}

async function createRuntime(params?: { customerEmail?: string }) {
  process.env.APP_BASE_URL = 'https://ringbooker.test';
  process.env.EMAIL_FROM_ADDRESS = 'RingBooker Notifications <notifications@send.ringbooker.com>';
  process.env.EMAIL_FOUNDER_FROM = 'Luis Pham from RingBooker <luis@send.ringbooker.com>';
  process.env.EMAIL_REPLY_TO = 'hello@ringbooker.com';
  process.env.EMAIL_SUPPORT_ADDRESS = 'support@ringbooker.com';

  const shopsRepository = new InMemoryShopsRepository();
  const billingCustomersRepository = new InMemoryBillingCustomersRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const billingNotificationsRepository = new InMemoryBillingNotificationsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  const jobsRepository = new InMemoryJobsRepository();
  const emailService = new RecordingEmailService();

  await billingCustomersRepository.upsert({
    shopId: 'demo-shop',
    provider: 'paddle',
    providerCustomerId: 'ctm_demo_paddle',
    email: params?.customerEmail ?? 'owner@example.com',
  });
  const subscription = await billingSubscriptionsRepository.upsert({
    shopId: 'demo-shop',
    provider: 'paddle',
    providerCustomerId: 'ctm_demo_paddle',
    providerSubscriptionId: 'sub_demo',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialStartedAt: '2026-05-01T00:00:00Z',
    trialEndsAt: '2026-05-15T00:00:00Z',
    paymentMethodStatus: 'valid',
  });

  const runtime = {
    shopsRepository,
    billingCustomersRepository,
    billingSubscriptionsRepository,
    billingNotificationsRepository,
    shopAccessStatesRepository,
    jobsRepository,
    emailService,
    smsService: {},
    outboundMessagesRepository: {},
    bookingsRepository: {},
  } as unknown as Parameters<typeof createJobHandlers>[0];

  return { runtime, emailService, billingNotificationsRepository, billingSubscriptionsRepository, shopsRepository, shopAccessStatesRepository, subscription };
}

test('forwarding number ready lifecycle email includes forwarding number and system sender', async () => {
  const { runtime, emailService, subscription } = await createRuntime();
  const handlers = createJobHandlers(runtime);

  await handlers.lifecycle_email?.({
    jobId: 'job-forwarding-ready',
    shopId: 'demo-shop',
    payload: { kind: 'forwarding_number_ready', subscriptionId: subscription.id, forwardingNumber: '+18888401886' },
    attemptCount: 1,
  });

  assert.equal(emailService.sent.length, 1);
  assert.equal(emailService.sent[0]?.category, 'forwarding_number_ready');
  assert.equal(emailService.sent[0]?.from, 'RingBooker Notifications <notifications@send.ringbooker.com>');
  assert.equal(emailService.sent[0]?.replyTo, 'support@ringbooker.com');
  assert.match(emailService.sent[0]?.text ?? '', /\+18888401886/);
  assert.match(emailService.sent[0]?.text ?? '', /Keep your current business number/i);
});

test('lifecycle email is not sent to ringbooker.local fallback addresses', async () => {
  const { runtime, emailService, subscription, billingNotificationsRepository } = await createRuntime({ customerEmail: 'user@ringbooker.local' });
  const handlers = createJobHandlers(runtime);

  await handlers.lifecycle_email?.({
    jobId: 'job-no-local-email',
    shopId: 'demo-shop',
    payload: { kind: 'payment_method_added', subscriptionId: subscription.id },
    attemptCount: 1,
  });

  assert.equal(emailService.sent.length, 0);
  assert.equal(
    await billingNotificationsRepository.hasSent({
      shopId: 'demo-shop',
      subscriptionId: subscription.id,
      type: 'payment_method_added',
      channel: 'email',
    }),
    true,
  );
});

test('trial ended email can be retried for already expired subscriptions', async () => {
  const { runtime, emailService, billingSubscriptionsRepository, subscription } = await createRuntime();
  const expired = await billingSubscriptionsRepository.updateById(subscription.id, {
    status: 'trial_expired',
    paymentMethodStatus: 'none',
    trialExpiredAt: '2026-05-16T00:00:00Z',
  });
  assert.ok(expired);
  const handlers = createJobHandlers(runtime);

  await handlers.trial_expiry_check?.({
    jobId: 'job-trial-ended-retry',
    shopId: 'demo-shop',
    payload: {},
    attemptCount: 1,
  });

  assert.equal(emailService.sent.length, 1);
  assert.equal(emailService.sent[0]?.category, 'billing_trial_ended');
  assert.match(emailService.sent[0]?.subject, /trial has ended/i);
});

test('add payment method email avoids no-charge claim unless Paddle trial config is verified', async () => {
  process.env.PADDLE_TRIAL_CONFIG_VERIFIED = 'false';
  const { runtime, emailService, subscription } = await createRuntime();
  await runtime.billingSubscriptionsRepository.updateById(subscription.id, { paymentMethodStatus: 'none' });
  const handlers = createJobHandlers(runtime);

  await handlers.lifecycle_email?.({
    jobId: 'job-add-payment',
    shopId: 'demo-shop',
    payload: { kind: 'add_payment_method_go_live', subscriptionId: subscription.id },
    attemptCount: 1,
  });

  assert.equal(emailService.sent.length, 1);
  const combined = `${emailService.sent[0]?.subject}\n${emailService.sent[0]?.text}`;
  assert.doesNotMatch(combined, /won't be charged until your trial ends/i);
  assert.match(combined, /payment method is required before RingBooker answers real callers/i);
});

test('billing paused email sends once per billing status transition', async () => {
  const { runtime, emailService, billingSubscriptionsRepository, subscription } = await createRuntime();
  const handlers = createJobHandlers(runtime);

  await billingSubscriptionsRepository.updateById(subscription.id, { status: 'canceled', paymentMethodStatus: 'failed' });
  await handlers.lifecycle_email?.({
    jobId: 'job-billing-canceled',
    shopId: 'demo-shop',
    payload: { kind: 'live_answering_billing_paused', subscriptionId: subscription.id, status: 'canceled' },
    attemptCount: 1,
  });
  await billingSubscriptionsRepository.updateById(subscription.id, { status: 'past_due', paymentMethodStatus: 'failed' });
  await handlers.lifecycle_email?.({
    jobId: 'job-billing-past-due',
    shopId: 'demo-shop',
    payload: { kind: 'live_answering_billing_paused', subscriptionId: subscription.id, status: 'past_due' },
    attemptCount: 1,
  });

  assert.equal(emailService.sent.length, 2);
  assert.equal(emailService.sent[0]?.category, 'live_answering_billing_paused');
  assert.equal(emailService.sent[1]?.category, 'live_answering_billing_paused');
});
