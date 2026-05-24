import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryShopOverageChargesRepository } from '@/src/backend/adapters/memory/shop-overage-charges-repository';
import { InMemoryShopUsageAlertsRepository } from '@/src/backend/adapters/memory/shop-usage-alerts-repository';
import type { Shop } from '@/src/backend/domain/types';
import type { EmailService } from '@/src/backend/services/email/types';
import { processOverageForPeriod } from '@/src/backend/services/billing/process-overage';

type RecordedEmail = Parameters<EmailService['sendEmail']>[0];

class RecordingEmailService implements EmailService {
  readonly sent: RecordedEmail[] = [];

  async sendEmail(params: RecordedEmail) {
    this.sent.push(params);
    return { providerMessageId: `email_${this.sent.length}` };
  }
}

function shop(plan: Shop['plan'] = 'starter'): Shop {
  return {
    id: `overage-${plan}-shop`,
    name: 'Overage Shop',
    phone_number: '+15550000000',
    user_phone: '+15550000001',
    timezone: 'America/Los_Angeles',
    services: [],
    hours: {},
    cancel_policy: '',
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: true,
    send_review_request_sms: true,
    send_missed_call_followup_sms: true,
    plan,
    active: true,
  };
}

async function addSubscription(repo: InMemoryBillingSubscriptionsRepository, s: Shop, status: 'active' | 'trialing' | 'past_due' = 'active') {
  return await repo.upsert({
    shopId: s.id,
    provider: 'paddle',
    providerSubscriptionId: `sub_${s.id}`,
    providerCustomerId: `ctm_${s.id}`,
    plan: s.plan,
    status,
    interval: 'month',
    currency: 'USD',
    amount: s.plan === 'starter' ? 79 : 149,
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
    paymentMethodStatus: status === 'active' ? 'valid' : 'failed',
  });
}

async function addCapturedCall(repo: InMemoryCallLogsRepository, s: Shop, index: number) {
  const requestId = `overage-req-${index}`;
  await repo.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: `overage-call-${index}`,
    shopId: s.id,
    callerPhone: '+15550000002',
    startedAt: new Date('2026-03-20T12:00:00.000Z'),
    requestId,
  });
  await repo.updateStructuredSummary(s.id, requestId, { summaryServiceRequest: 'gel manicure' });
}

async function verifiedOwner(repo: InMemoryAuthUsersRepository, s: Shop) {
  const user = await repo.create({
    email: `${s.id}@example.com`,
    role: 'user',
    shopId: s.id,
    passwordHash: 'hash',
  });
  await repo.markEmailVerified(user.id, new Date('2026-03-01T00:00:00.000Z'));
}

function billingProvider(params?: { fail?: boolean }) {
  const calls: Array<{ providerSubscriptionId: string; amountCents: number; description: string }> = [];
  return {
    provider: 'paddle' as const,
    calls,
    async chargeOverage(input: { providerSubscriptionId: string; amountCents: number; description: string }) {
      calls.push(input);
      if (params?.fail) throw new Error('paddle_down');
      return { providerTransactionId: 'txn_overage_123' };
    },
    async createCheckoutSession() {
      throw new Error('not_implemented');
    },
    async syncWebhookEvent() {
      return null;
    },
  };
}

test('processOverageForPeriod creates skipped record when captured callers are within allowance', async () => {
  const s = shop('starter');
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  const provider = billingProvider();
  await addSubscription(billingSubscriptionsRepository, s);
  for (let i = 0; i < 100; i += 1) await addCapturedCall(callLogsRepository, s, i);

  await processOverageForPeriod(s, new Date('2026-03-15T00:00:00.000Z'), new Date('2026-04-15T00:00:00.000Z'), {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: provider,
  });

  const rows = await overageRepository.listByShopId(s.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, 'skipped');
  assert.equal(rows[0]?.overageCallers, 0);
  assert.equal(provider.calls.length, 0);
});

test('processOverageForPeriod charges correct amount and is idempotent', async () => {
  const s = shop('starter');
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  const provider = billingProvider();
  await addSubscription(billingSubscriptionsRepository, s);
  for (let i = 0; i < 105; i += 1) await addCapturedCall(callLogsRepository, s, i);
  const periodStart = new Date('2026-03-15T00:00:00.000Z');
  const periodEnd = new Date('2026-04-15T00:00:00.000Z');

  await processOverageForPeriod(s, periodStart, periodEnd, {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: provider,
  });
  await processOverageForPeriod(s, periodStart, periodEnd, {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: provider,
  });

  const rows = await overageRepository.listByShopId(s.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, 'charged');
  assert.equal(rows[0]?.overageCallers, 5);
  assert.equal(rows[0]?.amountCents, 125);
  assert.equal(rows[0]?.paddleTransactionId, 'txn_overage_123');
  assert.equal(provider.calls.length, 1);
  assert.equal(provider.calls[0]?.amountCents, 125);
});

test('processOverageForPeriod sends overage receipt after successful Paddle charge', async () => {
  const s = { ...shop('starter'), id: 'overage-receipt-shop' };
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  const usageAlertsRepository = new InMemoryShopUsageAlertsRepository();
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const emailService = new RecordingEmailService();
  const provider = billingProvider();
  await verifiedOwner(authUsersRepository, s);
  await addSubscription(billingSubscriptionsRepository, s);
  for (let i = 0; i < 105; i += 1) await addCapturedCall(callLogsRepository, s, i);

  await processOverageForPeriod(s, new Date('2026-03-15T00:00:00.000Z'), new Date('2026-04-15T00:00:00.000Z'), {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: provider,
    usageAlertsRepository,
    authUsersRepository,
    emailService,
  });

  assert.equal(emailService.sent.length, 1);
  assert.equal(emailService.sent[0]?.category, 'usage_overage_charged');
  assert.equal(emailService.sent[0]?.subject, 'Your RingBooker overage charge: $1.25');
  assert.match(emailService.sent[0]?.text ?? '', /Overage callers:\s+5/);
});

test('processOverageForPeriod skips trial or past_due subscriptions', async () => {
  for (const status of ['trialing', 'past_due'] as const) {
    const s = { ...shop('starter'), id: `overage-${status}-shop` };
    const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
    const callLogsRepository = new InMemoryCallLogsRepository();
    const overageRepository = new InMemoryShopOverageChargesRepository();
    const provider = billingProvider();
    await addSubscription(billingSubscriptionsRepository, s, status);
    for (let i = 0; i < 105; i += 1) await addCapturedCall(callLogsRepository, s, i);

    await processOverageForPeriod(s, new Date('2026-03-15T00:00:00.000Z'), new Date('2026-04-15T00:00:00.000Z'), {
      overageRepository,
      billingSubscriptionsRepository,
      callLogsRepository,
      billingProvider: provider,
    });

    assert.equal((await overageRepository.listByShopId(s.id)).length, 0);
    assert.equal(provider.calls.length, 0);
  }
});

test('processOverageForPeriod marks failed Paddle charge without throwing', async () => {
  const s = shop('starter');
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const overageRepository = new InMemoryShopOverageChargesRepository();
  const emailService = new RecordingEmailService();
  const authUsersRepository = new InMemoryAuthUsersRepository();
  const provider = billingProvider({ fail: true });
  await verifiedOwner(authUsersRepository, s);
  await addSubscription(billingSubscriptionsRepository, s);
  for (let i = 0; i < 105; i += 1) await addCapturedCall(callLogsRepository, s, i);

  await processOverageForPeriod(s, new Date('2026-03-15T00:00:00.000Z'), new Date('2026-04-15T00:00:00.000Z'), {
    overageRepository,
    billingSubscriptionsRepository,
    callLogsRepository,
    billingProvider: provider,
    usageAlertsRepository: new InMemoryShopUsageAlertsRepository(),
    authUsersRepository,
    emailService,
  });

  const rows = await overageRepository.listByShopId(s.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.status, 'failed');
  assert.equal(rows[0]?.amountCents, 125);
  assert.equal(emailService.sent.length, 0);
});
