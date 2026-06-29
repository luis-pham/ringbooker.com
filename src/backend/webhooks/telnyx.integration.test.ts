import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryBillingSubscriptionsRepository } from '@/src/backend/adapters/memory/billing-subscriptions-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryOutboundMessagesRepository } from '@/src/backend/adapters/memory/outbound-messages-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopAccessStatesRepository } from '@/src/backend/adapters/memory/shop-access-states-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemorySmsMessagesRepository } from '@/src/backend/adapters/memory/sms-messages-repository';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

const keyPair = generateKeyPairSync('ed25519');
applyRequiredTestEnv({
  TELNYX_WEBHOOK_PUBLIC_KEY: keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
});

function signTelnyxPayload(params: { body: string; timestamp: string }): string {
  const message = Buffer.from(`${params.timestamp}|${params.body}`, 'utf8');
  return sign(null, message, keyPair.privateKey).toString('base64');
}

async function postSignedTelnyxWebhook(app: ReturnType<typeof createBackendApp>, body: string) {
  const timestamp = `${Date.now()}`;
  const signature = signTelnyxPayload({ body, timestamp });
  return app.request('/webhooks/telnyx', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'telnyx-timestamp': timestamp,
      'telnyx-signature-ed25519': signature,
    },
    body,
  });
}

function setSmsInboxWhitelist(value: string) {
  process.env.TELNYX_SMS_INBOX_ALLOWED_NUMBERS = value;
  resetEnvCacheForTests();
}

function clearSmsInboxWhitelist() {
  delete process.env.TELNYX_SMS_INBOX_ALLOWED_NUMBERS;
  resetEnvCacheForTests();
}

test('telnyx webhook dedupes and enqueues one missed-call followup job', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const billingSubscriptionsRepository = new InMemoryBillingSubscriptionsRepository();
  const shopAccessStatesRepository = new InMemoryShopAccessStatesRepository();
  // Followup SMS is gated on full live-answering access: the shop needs a provisioned
  // forwarding number and verified forwarding setup, not just liveCallsEnabled.
  await shopsRepository.updateUserSettings('demo-shop', {
    telnyx_number: '+17145551200',
    forwarding_number_status: 'provisioned',
  });
  await shopAccessStatesRepository.upsert({
    shopId: 'demo-shop',
    liveCallsEnabled: true,
    forwardingVerifiedAt: new Date().toISOString(),
  });

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

test('telnyx inbound SMS is stored only for whitelisted inbox numbers', async () => {
  setSmsInboxWhitelist('+17145550123');
  const smsMessagesRepository = new InMemorySmsMessagesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    smsMessagesRepository,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'message.received',
      id: 'evt-sms-allowed-1',
      payload: {
        id: 'msg-allowed-1',
        to: [{ phone_number: '+17145550123' }],
        from: { phone_number: '+14155550101' },
        text: 'Can I book tomorrow?',
        received_at: '2026-06-29T15:00:00.000Z',
      },
    },
  });

  const response = await postSignedTelnyxWebhook(app, body);
  assert.equal(response.status, 200);

  const list = await smsMessagesRepository.listAdminSmsMessages({
    allowedToNumbers: ['+17145550123'],
    page: 1,
    limit: 10,
    read: 'all',
  });
  assert.equal(list.total, 1);
  assert.equal(list.items[0]?.fromNumber, '+14155550101');
  assert.equal(list.items[0]?.toNumber, '+17145550123');
  assert.equal(list.items[0]?.bodyPreview, 'Can I book tomorrow?');
});

test('telnyx inbound SMS outside whitelist is acknowledged and not stored', async () => {
  setSmsInboxWhitelist('+17145550123');
  const smsMessagesRepository = new InMemorySmsMessagesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    smsMessagesRepository,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'message.received',
      id: 'evt-sms-outside-1',
      payload: {
        id: 'msg-outside-1',
        to: '+17145550999',
        from: '+14155550102',
        text: 'Outside inbox',
      },
    },
  });

  const response = await postSignedTelnyxWebhook(app, body);
  assert.equal(response.status, 200);

  const list = await smsMessagesRepository.listAdminSmsMessages({
    allowedToNumbers: ['+17145550123'],
    page: 1,
    limit: 10,
    read: 'all',
  });
  assert.equal(list.total, 0);
});

test('telnyx inbound SMS duplicate message id stores one inbox row', async () => {
  setSmsInboxWhitelist('+17145550123');
  const smsMessagesRepository = new InMemorySmsMessagesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    smsMessagesRepository,
  });

  const payload = {
    id: 'msg-duplicate-1',
    to: '+17145550123',
    from: '+14155550103',
    text: 'Duplicate body',
  };
  const firstBody = JSON.stringify({
    data: { event_type: 'message.received', id: 'evt-sms-dupe-1', payload },
  });
  const secondBody = JSON.stringify({
    data: { event_type: 'message.received', id: 'evt-sms-dupe-2', payload },
  });

  assert.equal((await postSignedTelnyxWebhook(app, firstBody)).status, 200);
  assert.equal((await postSignedTelnyxWebhook(app, secondBody)).status, 200);

  const list = await smsMessagesRepository.listAdminSmsMessages({
    allowedToNumbers: ['+17145550123'],
    page: 1,
    limit: 10,
    read: 'all',
  });
  assert.equal(list.total, 1);
  assert.equal(list.items[0]?.telnyxMessageId, 'msg-duplicate-1');
});

test('telnyx inbound SMS with missing body still stores metadata', async () => {
  setSmsInboxWhitelist('+17145550123');
  const smsMessagesRepository = new InMemorySmsMessagesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    smsMessagesRepository,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'message.received',
      id: 'evt-sms-missing-body-1',
      payload: {
        id: 'msg-missing-body-1',
        to: '+17145550123',
        from: '+14155550104',
      },
    },
  });

  const response = await postSignedTelnyxWebhook(app, body);
  assert.equal(response.status, 200);

  const list = await smsMessagesRepository.listAdminSmsMessages({
    allowedToNumbers: ['+17145550123'],
    page: 1,
    limit: 10,
    read: 'all',
  });
  assert.equal(list.total, 1);
  assert.equal(list.items[0]?.bodyPreview, null);
});

test('telnyx inbound SMS with missing whitelist is acknowledged and not stored', async () => {
  clearSmsInboxWhitelist();
  const smsMessagesRepository = new InMemorySmsMessagesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    smsMessagesRepository,
  });

  const body = JSON.stringify({
    data: {
      event_type: 'message.received',
      id: 'evt-sms-no-whitelist-1',
      payload: {
        id: 'msg-no-whitelist-1',
        to: '+17145550123',
        from: '+14155550105',
        text: 'No whitelist',
      },
    },
  });

  const response = await postSignedTelnyxWebhook(app, body);
  assert.equal(response.status, 200);

  const list = await smsMessagesRepository.listAdminSmsMessages({
    allowedToNumbers: ['+17145550123'],
    page: 1,
    limit: 10,
    read: 'all',
  });
  assert.equal(list.total, 0);
});

test('telnyx outbound SMS finalized webhook updates message delivery status', async () => {
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  const created = await outboundMessagesRepository.createQueued({
    shopId: '11111111-1111-4111-8111-111111111111',
    messageType: 'booking_confirmation',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    body: 'Your appointment is confirmed',
    idempotencyKey: 'outbound-delivered',
  });
  await outboundMessagesRepository.markSubmitted(created.id, {
    telnyxMessageId: 'msg-out-delivered-1',
    submittedAt: new Date('2026-03-05T18:29:00.000Z'),
  });
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    outboundMessagesRepository,
  });

  const response = await postSignedTelnyxWebhook(
    app,
    JSON.stringify({
      data: {
        event_type: 'message.finalized',
        id: 'evt-out-delivered-1',
        occurred_at: '2026-03-05T18:30:00.000Z',
        payload: {
          id: 'msg-out-delivered-1',
          direction: 'outbound',
          from: { phone_number: '+15551234567' },
          to: [{ phone_number: '+15559876543', status: 'delivered' }],
          text: 'Your appointment is confirmed',
          errors: [],
          completed_at: '2026-03-05T18:31:00.000Z',
        },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, outboundSms: 'updated' });
  const message = await outboundMessagesRepository.getAdminOutboundMessageById(created.id);
  assert.equal(message?.status, 'delivered');
  assert.equal(message?.deliveredAt, '2026-03-05T18:31:00.000Z');
  assert.equal(message?.telnyxEventId, 'evt-out-delivered-1');
  assert.deepEqual(message?.providerStatusPayload, {
    id: 'msg-out-delivered-1',
    direction: 'outbound',
    from: { phone_number: '+15551234567' },
    to: [{ phone_number: '+15559876543', status: 'delivered' }],
    text: 'Your appointment is confirmed',
    errors: [],
    completed_at: '2026-03-05T18:31:00.000Z',
  });
});

test('telnyx outbound SMS message.sent does not downgrade delivered status', async () => {
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  const created = await outboundMessagesRepository.createQueued({
    shopId: '11111111-1111-4111-8111-111111111111',
    messageType: 'booking_confirmation',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    body: 'Confirmed',
    idempotencyKey: 'outbound-no-downgrade',
  });
  await outboundMessagesRepository.markSubmitted(created.id, {
    telnyxMessageId: 'msg-out-no-downgrade',
  });
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    outboundMessagesRepository,
  });

  assert.equal(
    (
      await postSignedTelnyxWebhook(
        app,
        JSON.stringify({
          data: {
            event_type: 'message.finalized',
            id: 'evt-out-no-downgrade-delivered',
            payload: {
              id: 'msg-out-no-downgrade',
              direction: 'outbound',
              to: [{ phone_number: '+15559876543', status: 'delivered' }],
              completed_at: '2026-03-05T18:31:00.000Z',
            },
          },
        }),
      )
    ).status,
    200,
  );
  const lateSentResponse = await postSignedTelnyxWebhook(
    app,
    JSON.stringify({
      data: {
        event_type: 'message.sent',
        id: 'evt-out-no-downgrade-sent',
        occurred_at: '2026-03-05T18:32:00.000Z',
        payload: {
          id: 'msg-out-no-downgrade',
          direction: 'outbound',
          to: [{ phone_number: '+15559876543', status: 'sent' }],
        },
      },
    }),
  );

  assert.equal(lateSentResponse.status, 200);
  assert.deepEqual(await lateSentResponse.json(), { ok: true, outboundSms: 'ignored_downgrade' });
  const message = await outboundMessagesRepository.getAdminOutboundMessageById(created.id);
  assert.equal(message?.status, 'delivered');
  assert.equal(message?.deliveredAt, '2026-03-05T18:31:00.000Z');
  assert.equal(message?.telnyxEventId, 'evt-out-no-downgrade-sent');
});

test('telnyx outbound SMS status for unknown message id is acknowledged', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    outboundMessagesRepository: new InMemoryOutboundMessagesRepository(),
  });

  const response = await postSignedTelnyxWebhook(
    app,
    JSON.stringify({
      data: {
        event_type: 'message.finalized',
        id: 'evt-out-unknown-message',
        payload: {
          id: 'msg-does-not-exist',
          direction: 'outbound',
          to: [{ phone_number: '+15559876543', status: 'delivery_failed' }],
          errors: [{ code: '40310', detail: 'Carrier rejected message' }],
        },
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, outboundSms: 'not_found' });
});

test('telnyx outbound SMS duplicate provider event is acknowledged once', async () => {
  const providerEventsRepository = new InMemoryProviderEventsRepository();
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  const created = await outboundMessagesRepository.createQueued({
    shopId: '11111111-1111-4111-8111-111111111111',
    messageType: 'booking_confirmation',
    fromNumber: '+15551234567',
    toNumber: '+15559876543',
    body: 'Confirmed',
    idempotencyKey: 'outbound-duplicate-event',
  });
  await outboundMessagesRepository.markSubmitted(created.id, {
    telnyxMessageId: 'msg-out-duplicate-event',
  });
  const app = createBackendApp({
    providerEventsRepository,
    outboundMessagesRepository,
  });
  const body = JSON.stringify({
    data: {
      event_type: 'message.finalized',
      id: 'evt-out-duplicate-event',
      payload: {
        id: 'msg-out-duplicate-event',
        direction: 'outbound',
        to: [{ phone_number: '+15559876543', status: 'delivery_failed' }],
        errors: [{ code: '40310', detail: 'Carrier rejected message' }],
        completed_at: '2026-03-05T18:31:00.000Z',
      },
    },
  });

  const first = await postSignedTelnyxWebhook(app, body);
  const duplicate = await postSignedTelnyxWebhook(app, body);

  assert.equal(first.status, 200);
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { ok: true });
  const message = await outboundMessagesRepository.getAdminOutboundMessageById(created.id);
  assert.equal(message?.status, 'delivery_failed');
  assert.equal(message?.failedAt, '2026-03-05T18:31:00.000Z');
  assert.equal(message?.errorCode, '40310');
  assert.equal(message?.errorMessage, 'Carrier rejected message');
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
