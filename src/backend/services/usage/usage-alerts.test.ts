import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryShopUsageAlertsRepository } from '@/src/backend/adapters/memory/shop-usage-alerts-repository';
import type { Shop } from '@/src/backend/domain/types';
import type { EmailService } from '@/src/backend/services/email/types';
import {
  checkAndSendUsageAlerts,
  maybeSendUsageAlert,
  scheduleUsageAlertCheck,
} from '@/src/backend/services/usage/usage-alerts';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';

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
    id: `usage-alert-${plan}-shop`,
    name: 'Usage Alert Shop',
    phone_number: '+15550100000',
    user_phone: '+15550100001',
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

async function addSubscription(repo: InMemoryBillingSubscriptionsRepository, s: Shop) {
  await repo.upsert({
    shopId: s.id,
    provider: 'paddle',
    providerSubscriptionId: `sub_${s.id}`,
    providerCustomerId: `ctm_${s.id}`,
    plan: s.plan,
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: s.plan === 'starter' ? 79 : 149,
    currentPeriodStart: '2026-03-15T00:00:00.000Z',
    currentPeriodEnd: '2026-04-15T00:00:00.000Z',
    paymentMethodStatus: 'valid',
  });
}

async function addCapturedCalls(repo: InMemoryCallLogsRepository, s: Shop, count: number) {
  for (let i = 0; i < count; i += 1) {
    const requestId = `usage-alert-req-${i}`;
    await repo.createOrUpdateInboundCall({
      provider: 'telnyx_call_control',
      providerCallId: `usage-alert-call-${i}`,
      shopId: s.id,
      callerPhone: '+15550100002',
      startedAt: new Date('2026-03-20T12:00:00.000Z'),
      requestId,
    });
    await repo.updateStructuredSummary(s.id, requestId, { summaryServiceRequest: 'gel manicure' });
  }
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

function deps(params?: { callLogsRepository?: InMemoryCallLogsRepository }) {
  return {
    usageAlertsRepository: new InMemoryShopUsageAlertsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    emailService: new RecordingEmailService(),
    callLogsRepository: params?.callLogsRepository ?? new InMemoryCallLogsRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
  };
}

test('checkAndSendUsageAlerts triggers 80pct alert at exactly 80 callers for Starter', async () => {
  const s = shop('starter');
  const d = deps();
  await verifiedOwner(d.authUsersRepository, s);
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 80);

  await checkAndSendUsageAlerts(s, d);

  assert.equal(d.emailService.sent.length, 1);
  assert.equal(d.emailService.sent[0]?.category, 'usage_80pct_warning');
  assert.equal(d.emailService.sent[0]?.subject, "You've used 80% of your caller limit this period");
});

test('checkAndSendUsageAlerts triggers 100pct alert at exactly 100 callers for Starter', async () => {
  const s = shop('starter');
  const d = deps();
  await verifiedOwner(d.authUsersRepository, s);
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 100);

  await checkAndSendUsageAlerts(s, d);

  assert.equal(d.emailService.sent.length, 1);
  assert.equal(d.emailService.sent[0]?.category, 'usage_100pct_overage');
  assert.equal(d.emailService.sent[0]?.subject, 'Caller limit reached — overage now applies');
});

test('checkAndSendUsageAlerts does not trigger below 80 percent', async () => {
  const s = shop('starter');
  const d = deps();
  await verifiedOwner(d.authUsersRepository, s);
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 79);

  await checkAndSendUsageAlerts(s, d);

  assert.equal(d.emailService.sent.length, 0);
});

test('maybeSendUsageAlert is idempotent per billing period', async () => {
  const s = shop('starter');
  const d = deps();
  await verifiedOwner(d.authUsersRepository, s);
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 80);
  const period = { start: new Date('2026-03-15T00:00:00.000Z'), end: new Date('2026-04-15T00:00:00.000Z') };
  const usage = await getShopUsageForPeriod(d, { shop: s, period });

  await maybeSendUsageAlert(s, '80pct_warning', usage, period.start, d);
  await maybeSendUsageAlert(s, '80pct_warning', usage, period.start, d);

  assert.equal(d.emailService.sent.length, 1);
});

test('maybeSendUsageAlert skips when owner email is missing or unverified', async () => {
  const s = shop('starter');
  const d = deps();
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 80);
  const period = { start: new Date('2026-03-15T00:00:00.000Z'), end: new Date('2026-04-15T00:00:00.000Z') };
  const usage = await getShopUsageForPeriod(d, { shop: s, period });

  await maybeSendUsageAlert(s, '80pct_warning', usage, period.start, d);
  await d.authUsersRepository.create({ email: 'unverified@example.com', role: 'user', shopId: s.id, passwordHash: 'hash' });
  await maybeSendUsageAlert(s, '80pct_warning', usage, period.start, d);

  assert.equal(d.emailService.sent.length, 0);
});

test('80pct alert does not send if usage is already at 100pct', async () => {
  const s = shop('starter');
  const d = deps();
  await verifiedOwner(d.authUsersRepository, s);
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 100);
  const period = { start: new Date('2026-03-15T00:00:00.000Z'), end: new Date('2026-04-15T00:00:00.000Z') };
  const usage = await getShopUsageForPeriod(d, { shop: s, period });

  await maybeSendUsageAlert(s, '80pct_warning', usage, period.start, d);

  assert.equal(d.emailService.sent.length, 0);
});

test('100pct alert sends even when 80pct alert was already sent', async () => {
  const s = shop('starter');
  const d = deps();
  await verifiedOwner(d.authUsersRepository, s);
  await addSubscription(d.billingSubscriptionsRepository, s);
  await addCapturedCalls(d.callLogsRepository, s, 100);
  const period = { start: new Date('2026-03-15T00:00:00.000Z'), end: new Date('2026-04-15T00:00:00.000Z') };
  const usage = await getShopUsageForPeriod(d, { shop: s, period });
  await d.usageAlertsRepository.create({
    shopId: s.id,
    alertType: '80pct_warning',
    periodStart: period.start,
    idempotencyKey: `${s.id}:${period.start.toISOString()}:80pct_warning`,
  });

  await maybeSendUsageAlert(s, '100pct_overage', usage, period.start, d);

  assert.equal(d.emailService.sent.length, 1);
  assert.equal(d.emailService.sent[0]?.category, 'usage_100pct_overage');
});

test('scheduleUsageAlertCheck returns without throwing when alert dependencies fail', () => {
  const s = shop('starter');
  assert.doesNotThrow(() => {
    scheduleUsageAlertCheck(s, {
      usageAlertsRepository: {
        async findByIdempotencyKey() {
          throw new Error('db_down');
        },
        async create() {
          throw new Error('db_down');
        },
      },
      authUsersRepository: null,
      emailService: null,
      callLogsRepository: new InMemoryCallLogsRepository(),
      billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    });
  });
});
