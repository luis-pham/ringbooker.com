import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import type { EmailService } from '@/src/backend/services/email/types';

applyRequiredTestEnv();

type RecordedEmail = Parameters<EmailService['sendEmail']>[0];

class RecordingEmailService implements EmailService {
  readonly sent: RecordedEmail[] = [];

  async sendEmail(params: RecordedEmail) {
    this.sent.push(params);
    return { providerMessageId: `test-email-${this.sent.length}` };
  }
}

function signPaddlePayload(rawBody: string, timestamp = Math.floor(Date.now() / 1000)) {
  const h1 = createHmac('sha256', process.env.PADDLE_WEBHOOK_SECRET ?? '')
    .update(`${timestamp}:${rawBody}`)
    .digest('hex');
  return `ts=${timestamp};h1=${h1}`;
}

test('paddle webhook rejects invalid signatures before syncing billing', async () => {
  applyRequiredTestEnv({ PADDLE_WEBHOOK_SECRET: 'paddle_test_secret' });
  resetEnvCacheForTests();
  let syncCount = 0;
  const billingProvider: BillingProviderAdapter = {
    provider: 'paddle',
    async createCheckoutSession() {
      throw new Error('not_used');
    },
    async syncWebhookEvent() {
      syncCount += 1;
      return null;
    },
  };
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    billingProvider,
  });

  const res = await app.request('/webhooks/paddle', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'paddle-signature': 'ts=123;h1=bad',
    },
    body: JSON.stringify({
      event_id: 'evt_bad_signature',
      event_type: 'subscription.updated',
      data: { custom_data: { shop_id: 'demo-shop' } },
    }),
  });

  assert.equal(res.status, 401);
  assert.equal(syncCount, 0);
});

test('paddle webhook is idempotent by event_id', async () => {
  applyRequiredTestEnv({ PADDLE_WEBHOOK_SECRET: 'paddle_test_secret' });
  resetEnvCacheForTests();
  let syncCount = 0;
  const billingProvider: BillingProviderAdapter = {
    provider: 'paddle',
    async createCheckoutSession() {
      throw new Error('not_used');
    },
    async syncWebhookEvent(params) {
      syncCount += 1;
      assert.equal(params.eventType, 'transaction.completed');
      return null;
    },
  };
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    billingProvider,
  });
  const rawBody = JSON.stringify({
    event_id: 'evt_idempotent_1',
    event_type: 'transaction.completed',
    data: {
      custom_data: { shop_id: 'demo-shop' },
      items: [{ price: { id: process.env.PADDLE_PRICE_STARTER_MONTHLY } }],
    },
  });
  const signature = signPaddlePayload(rawBody);

  const first = await app.request('/webhooks/paddle', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'paddle-signature': signature,
    },
    body: rawBody,
  });
  const second = await app.request('/webhooks/paddle', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'paddle-signature': signature,
    },
    body: rawBody,
  });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(syncCount, 1);
});

test('paddle duplicate webhooks racing run one billing sync', async () => {
  applyRequiredTestEnv({ PADDLE_WEBHOOK_SECRET: 'paddle_test_secret' });
  resetEnvCacheForTests();
  let syncCount = 0;
  const billingProvider: BillingProviderAdapter = {
    provider: 'paddle',
    async createCheckoutSession() {
      throw new Error('not_used');
    },
    async syncWebhookEvent() {
      syncCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return null;
    },
  };
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    billingProvider,
  });
  const rawBody = JSON.stringify({
    event_id: 'evt_idempotent_race_1',
    event_type: 'transaction.completed',
    data: { custom_data: { shop_id: 'demo-shop' } },
  });
  const signature = signPaddlePayload(rawBody);

  const [first, second] = await Promise.all([
    app.request('/webhooks/paddle', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': signature },
      body: rawBody,
    }),
    app.request('/webhooks/paddle', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'paddle-signature': signature },
      body: rawBody,
    }),
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(syncCount, 1);
});

test('paddle unmapped customer events do not send internal alert emails', async () => {
  applyRequiredTestEnv({ PADDLE_WEBHOOK_SECRET: 'paddle_test_secret' });
  resetEnvCacheForTests();
  const emailService = new RecordingEmailService();
  const billingProvider: BillingProviderAdapter = {
    provider: 'paddle',
    async createCheckoutSession() {
      throw new Error('not_used');
    },
    async syncWebhookEvent(params) {
      assert.equal(params.eventType, 'customer.created');
      return null;
    },
  };
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    billingProvider,
    emailService,
  });
  const rawBody = JSON.stringify({
    event_id: 'evt_unmapped_customer_no_email',
    event_type: 'customer.created',
    data: {
      id: 'ctm_unmapped_customer',
      email: 'customer@example.com',
    },
  });

  const res = await app.request('/webhooks/paddle', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'paddle-signature': signPaddlePayload(rawBody),
    },
    body: rawBody,
  });

  assert.equal(res.status, 200);
  assert.equal(emailService.sent.length, 0);
});
