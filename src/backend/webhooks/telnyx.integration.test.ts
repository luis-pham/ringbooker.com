import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

const keyPair = generateKeyPairSync('ed25519');
applyRequiredTestEnv({
  TELNYX_WEBHOOK_PUBLIC_KEY: keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
});

function signTelnyxPayload(params: { body: string; timestamp: string }): string {
  const message = Buffer.from(`${params.timestamp}|${params.body}`, 'utf8');
  return sign(null, message, keyPair.privateKey).toString('base64');
}

test('telnyx webhook dedupes and enqueues one missed-call followup job', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  await shopAccessStatesRepository.upsert({ shopId: 'demo-shop', liveCallsEnabled: true });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    shopsRepository,
    billingSubscriptionsRepository,
    shopAccessStatesRepository,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.hangup',
      id: 'evt-missed-1',
      payload: {
        call_direction: 'inbound',
        hangup_cause: 'NO_ANSWER',
        to: '+17145550123',
        from: '+14155550000',
      },
    },
  });
  const timestamp = `${Date.now()}`;
  const signature = signTelnyxPayload({ body, timestamp });

  const firstResponse = await app.request('/webhooks/telnyx', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': signature,
    },
    body,
  });
  const duplicateResponse = await app.request('/webhooks/telnyx', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': signature,
    },
    body,
  });

  assert.equal(firstResponse.status, 200);
  assert.equal(duplicateResponse.status, 200);

  const leasedFirst = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.ok(leasedFirst);
  assert.equal(leasedFirst.type, 'missed_call_followup_sms');
  assert.deepEqual(leasedFirst.payload, { customerPhone: '+14155550000' });

  const leasedSecond = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker-2',
  });
  assert.equal(leasedSecond, null);
});

test('telnyx missed inbound does not enqueue follow-up when billing gate deps are missing', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    shopsRepository: new InMemoryShopsRepository(),
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.hangup',
      id: 'evt-missed-no-billing-gate',
      payload: {
        call_direction: 'inbound',
        hangup_cause: 'NO_ANSWER',
        to: '+17145550123',
        from: '+14155550001',
      },
    },
  });
  const timestamp = `${Date.now()}`;
  const signature = signTelnyxPayload({ body, timestamp });

  const res = await app.request('/webhooks/telnyx', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': signature,
    },
    body,
  });

  assert.equal(res.status, 200);
  const leased = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.equal(leased, null);
});

test('telnyx missed inbound does not enqueue follow-up when billing blocks live calls', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const blockedShop = await shopsRepository.create({
    name: 'Blocked Billing Salon',
    phone_number: '+15552220007',
    user_phone: '+15552220008',
    timezone: 'America/Los_Angeles',
    plan: 'professional',
    active: true,
  });
  await shopsRepository.updateUserSettings(blockedShop.id, {
    telnyx_number: '+15551110007',
    phone_number: '+15552220007',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    shopsRepository,
    billingSubscriptionsRepository: new InMemoryBillingSubscriptionsRepository(),
    shopAccessStatesRepository: new InMemoryShopAccessStatesRepository(),
  });

  const body = JSON.stringify({
    data: {
      event_type: 'call.hangup',
      id: 'evt-missed-billing-blocked',
      payload: {
        call_direction: 'inbound',
        hangup_cause: 'NO_ANSWER',
        to: '+15551110007',
        from: '+14155550002',
      },
    },
  });
  const timestamp = `${Date.now()}`;
  const signature = signTelnyxPayload({ body, timestamp });

  const res = await app.request('/webhooks/telnyx', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': signature,
    },
    body,
  });

  assert.equal(res.status, 200);
  const leased = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.equal(leased, null);
});

test('telnyx incoming YES message enqueues callback owner alert', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    shopsRepository: new InMemoryShopsRepository(),
  });

  const body = JSON.stringify({
    data: {
      event_type: 'message.received',
      id: 'evt-message-1',
      payload: {
        to: '+17145550123',
        from: '+14155550011',
        text: 'YES',
      },
    },
  });
  const timestamp = `${Date.now()}`;
  const signature = signTelnyxPayload({ body, timestamp });

  const response = await app.request('/webhooks/telnyx', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': signature,
    },
    body,
  });

  assert.equal(response.status, 200);

  const leased = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.ok(leased);
  assert.equal(leased.type, 'callback_request_owner_alert');
  assert.equal(leased.payload.callerPhone, '+14155550011');
  assert.equal(leased.payload.reason, 'Customer replied YES for callback SMS');
});
