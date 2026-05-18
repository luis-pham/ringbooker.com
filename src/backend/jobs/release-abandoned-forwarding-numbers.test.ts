import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBillingCustomersRepository } from '@/src/backend/adapters/memory/billing-customers-repository';
import { InMemoryBillingNotificationsRepository } from '@/src/backend/adapters/memory/billing-notifications-repository';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import {
  runReleaseAbandonedForwardingNumbersJob,
  type ReleaseAbandonedForwardingNumbersRuntime,
} from '@/src/backend/jobs/release-abandoned-forwarding-numbers';

function createRuntime() {
  const emails: unknown[] = [];
  const sms: unknown[] = [];
  const releases: unknown[] = [];
  const runtime: ReleaseAbandonedForwardingNumbersRuntime = {
    shopsRepository: new InMemoryShopsRepository(),
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
    billingCustomersRepository: new InMemoryBillingCustomersRepository(),
    billingNotificationsRepository: new InMemoryBillingNotificationsRepository(),
    phoneProvisioningService: {
      searchAvailableNumbers: async () => [],
      provisionNumber: async () => ({ phoneNumber: '+15550000000' }),
      releaseNumber: async (params) => {
        releases.push(params);
      },
    },
    emailService: {
      sendEmail: async (params) => {
        emails.push(params);
        return { providerMessageId: `email-${emails.length}` };
      },
    },
    smsService: {
      sendSms: async (params) => {
        sms.push(params);
        return { providerMessageId: `sms-${sms.length}` };
      },
    },
  };
  return { runtime, emails, sms, releases };
}

test('release abandoned forwarding number after 72 hours without billing', async () => {
  const { runtime, emails, sms, releases } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'Release Salon',
    phone_number: '+15550000001',
    user_phone: '+15550000002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.billingCustomersRepository!.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_release',
    email: 'owner@example.com',
  });
  await runtime.shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15551112222',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
    forwarding_number_provider_order_id: 'order_123',
    forwarding_country: 'us',
    forwarding_carrier: 'verizon',
    forwarding_type: 'no_answer',
    sms_owner_opted_in: true,
  });
  await runtime.shopAccessStatesRepository!.upsert({
    shopId: shop.id,
    liveCallsEnabled: false,
    forwardingSetupVerifiedAt: '2026-05-01T00:10:00.000Z',
    forwardingSetupVerifiedVia: 'forwarding_test',
  });

  const result = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-04T01:00:00.000Z'));

  assert.equal(result.released, 1);
  assert.equal(releases.length, 1);
  assert.equal(emails.length, 1);
  assert.equal(sms.length, 1);
  const updated = await runtime.shopsRepository.findById(shop.id);
  assert.equal(updated?.telnyx_number, null);
  assert.equal(updated?.forwarding_number_status, 'none');
  assert.equal(updated?.forwarding_carrier, null);
  assert.equal(updated?.forwarding_type, 'no_answer');
  assert.equal(updated?.forwarding_number_release_reason, 'billing_timeout_72h');
  assert.equal(updated?.forwarding_number_released_at, '2026-05-04T01:00:00.000Z');
  const access = await runtime.shopAccessStatesRepository!.findByShopId(shop.id);
  assert.equal(access?.forwardingSetupVerifiedAt, null);
});

test('does not release when payment method is valid', async () => {
  const { runtime, releases } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'Paid Salon',
    phone_number: '+15550001001',
    user_phone: '+15550001002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15551113333',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
  });
  await runtime.billingSubscriptionsRepository!.upsert({
    shopId: shop.id,
    provider: 'paddle',
    plan: 'starter',
    status: 'unknown',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    amountCents: 7900,
    paymentMethodStatus: 'valid',
  });

  const result = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-04T01:00:00.000Z'));

  assert.equal(result.released, 0);
  assert.equal(releases.length, 0);
  const updated = await runtime.shopsRepository.findById(shop.id);
  assert.equal(updated?.telnyx_number, '+15551113333');
});

test('sends 24h email and 48h SMS reminders idempotently before release', async () => {
  const { runtime, emails, sms, releases } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'Reminder Salon',
    phone_number: '+15550002001',
    user_phone: '+15550002002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.billingCustomersRepository!.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_reminder',
    email: 'reminder@example.com',
  });
  await runtime.shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15551114444',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
    sms_owner_opted_in: true,
  });

  const first24 = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-02T01:00:00.000Z'));
  const second24 = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-02T02:00:00.000Z'));
  const first48 = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-03T01:00:00.000Z'));
  const second48 = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-03T02:00:00.000Z'));

  assert.equal(first24.reminders24hSent, 1);
  assert.equal(second24.reminders24hSent, 0);
  assert.equal(first48.reminders48hSent, 1);
  assert.equal(second48.reminders48hSent, 0);
  assert.equal(emails.length, 2);
  assert.equal(sms.length, 1);
  assert.equal(releases.length, 0);
});
