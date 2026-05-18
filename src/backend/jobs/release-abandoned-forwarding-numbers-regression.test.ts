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
      releaseNumber: async (params) => { releases.push(params); },
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

// 9. 72h cleanup job: does not release live users
test('regression: cleanup job skips shops with live answering enabled', async () => {
  const { runtime, releases } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'Live Salon',
    phone_number: '+15550003001',
    user_phone: '+15550003002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15551115555',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
  });
  await runtime.shopAccessStatesRepository!.upsert({
    shopId: shop.id,
    liveCallsEnabled: true,
  });

  const result = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-04T01:00:00.000Z'));

  assert.equal(result.released, 0);
  assert.equal(releases.length, 0);
  const updated = await runtime.shopsRepository.findById(shop.id);
  assert.equal(updated?.telnyx_number, '+15551115555');
});

// 10. 72h cleanup job: does not release users with valid billing
test('regression: cleanup job skips shops with valid payment method', async () => {
  const { runtime, releases } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'Paid Salon',
    phone_number: '+15550004001',
    user_phone: '+15550004002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15551116666',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
  });
  await runtime.billingSubscriptionsRepository!.upsert({
    shopId: shop.id,
    provider: 'paddle',
    plan: 'starter',
    status: 'active',
    interval: 'month',
    currency: 'USD',
    amount: 79,
    paymentMethodStatus: 'valid',
  });

  const result = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-04T01:00:00.000Z'));

  assert.equal(result.released, 0);
  assert.equal(releases.length, 0);
  const updated = await runtime.shopsRepository.findById(shop.id);
  assert.equal(updated?.telnyx_number, '+15551116666');
});

// 11. 72h cleanup job: does release abandoned users after 72h
test('regression: cleanup job releases forwarding number after 72h without billing', async () => {
  const { runtime, releases } = createRuntime();
  const shop = await runtime.shopsRepository.create({
    name: 'Abandoned Salon',
    phone_number: '+15550005001',
    user_phone: '+15550005002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.billingCustomersRepository!.upsert({
    shopId: shop.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_abandoned',
    email: 'owner@example.com',
  });
  await runtime.shopsRepository.updateUserSettings(shop.id, {
    telnyx_number: '+15551117777',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
    forwarding_number_provider_order_id: 'order_abc',
    forwarding_country: 'us',
    forwarding_carrier: 'tmobile',
    forwarding_type: 'no_answer',
  });

  const result = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-04T01:00:00.000Z'));

  assert.equal(result.released, 1);
  assert.equal(releases.length, 1);
  const updated = await runtime.shopsRepository.findById(shop.id);
  assert.equal(updated?.telnyx_number, null);
  assert.equal(updated?.forwarding_number_status, 'none');
  assert.equal(updated?.forwarding_number_release_reason, 'billing_timeout_72h');
  assert.equal(updated?.forwarding_number_released_at, '2026-05-04T01:00:00.000Z');
});

// 12. SMS reminder: only sends when sms_owner_opted_in = true
test('regression: 48h SMS reminder is not sent when sms_owner_opted_in is false', async () => {
  const { runtime, sms } = createRuntime();

  const optedIn = await runtime.shopsRepository.create({
    name: 'Opted In Salon',
    phone_number: '+15550006001',
    user_phone: '+15550006002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.billingCustomersRepository!.upsert({
    shopId: optedIn.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_opted_in',
    email: 'optedin@example.com',
  });
  await runtime.shopsRepository.updateUserSettings(optedIn.id, {
    telnyx_number: '+15551118888',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
    sms_owner_opted_in: true,
  });

  const notOptedIn = await runtime.shopsRepository.create({
    name: 'Not Opted In Salon',
    phone_number: '+15550007001',
    user_phone: '+15550007002',
    timezone: 'America/Los_Angeles',
    plan: 'starter',
    active: true,
  });
  await runtime.billingCustomersRepository!.upsert({
    shopId: notOptedIn.id,
    provider: 'paddle',
    providerCustomerId: 'ctm_not_opted',
    email: 'notoptedin@example.com',
  });
  await runtime.shopsRepository.updateUserSettings(notOptedIn.id, {
    telnyx_number: '+15551119999',
    forwarding_number_status: 'provisioned',
    forwarding_number_provisioned_at: '2026-05-01T00:00:00.000Z',
    sms_owner_opted_in: false,
  });

  const result = await runReleaseAbandonedForwardingNumbersJob(runtime, new Date('2026-05-03T01:00:00.000Z'));

  assert.equal(result.reminders48hSent, 2);
  assert.equal(sms.length, 1, 'SMS should only be sent to the opted-in shop');
});
