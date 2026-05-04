import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingNotificationsRepository } from '@/src/backend/adapters/memory/billing-notifications-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { scheduleTrialLifecycleJobsWithRuntime } from '@/src/backend/jobs/runner';

test('trial lifecycle scheduler enqueues expiry and reminder jobs idempotently', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const billingNotificationsRepository = new InMemoryBillingNotificationsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();

  await billingSubscriptionsRepository.upsert({
    shopId: 'expired-shop',
    provider: 'internal',
    plan: 'starter',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    trialEndsAt: '2026-05-04T00:00:00Z',
    paymentMethodStatus: 'none',
  });
  await billingSubscriptionsRepository.upsert({
    shopId: 'reminder-shop',
    provider: 'internal',
    plan: 'professional',
    status: 'trialing',
    interval: 'month',
    currency: 'USD',
    amount: 149,
    amountCents: 14900,
    trialEndsAt: '2026-05-11T00:00:00Z',
    paymentMethodStatus: 'none',
  });

  const runtime = {
    jobsRepository,
    billingSubscriptionsRepository,
    billingNotificationsRepository,
    shopAccessStatesRepository,
  } as Parameters<typeof scheduleTrialLifecycleJobsWithRuntime>[0];

  const first = await scheduleTrialLifecycleJobsWithRuntime(runtime, new Date('2026-05-04T00:00:00Z'));
  const second = await scheduleTrialLifecycleJobsWithRuntime(runtime, new Date('2026-05-04T00:00:00Z'));

  assert.deepEqual(first, { expiryChecksEnqueued: 1, reminderEmailsEnqueued: 1, accessStatesRepaired: 1 });
  assert.deepEqual(second, { expiryChecksEnqueued: 1, reminderEmailsEnqueued: 1, accessStatesRepaired: 0 });
  assert.deepEqual(await jobsRepository.getStatusCounts(), { queued: 2 });

  const expiry = await jobsRepository.leaseNext({ now: new Date('2026-05-04T00:00:00Z'), leaseSeconds: 60, workerId: 'test' });
  assert.equal(expiry?.type, 'trial_expiry_check');
  const reminder = await jobsRepository.leaseNext({ now: new Date('2026-05-04T00:00:00Z'), leaseSeconds: 60, workerId: 'test' });
  assert.equal(reminder?.type, 'trial_reminder_email');
  assert.deepEqual(reminder?.payload, { daysRemaining: 7 });
});
