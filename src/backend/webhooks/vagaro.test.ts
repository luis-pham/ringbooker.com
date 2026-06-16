import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryVagaroWebhookEventsRepository } from '@/src/backend/adapters/memory/vagaro-webhook-events-repository';
import { verifyVagaroWebhookHmac } from '@/src/backend/webhooks/vagaro';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

const SHOP_TOKEN = 'whk_testtoken';

function signBody(body: string, secret = SHOP_TOKEN): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function createVagaroTestApp() {
  const shopsRepository = new InMemoryShopsRepository();
  const vagaroWebhookEventsRepository = new InMemoryVagaroWebhookEventsRepository();
  await shopsRepository.updateVagaroSettings('demo-shop', {
    vagaro_webhook_token: SHOP_TOKEN,
  });
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    vagaroWebhookEventsRepository,
  });
  return { app, shopsRepository, vagaroWebhookEventsRepository };
}

test('vagaro webhook without shop token is rejected', async () => {
  const { app, vagaroWebhookEventsRepository } = await createVagaroTestApp();

  const response = await app.request('/webhooks/vagaro', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'appointment', action: 'created', payload: {} }),
  });

  assert.equal(response.status, 401);
  assert.equal(vagaroWebhookEventsRepository.list().length, 0);
});

test('vagaro webhook rejects wrong HMAC signature for a valid shop token', async () => {
  const { app, vagaroWebhookEventsRepository } = await createVagaroTestApp();
  const body = JSON.stringify({
    id: 'evt-wrong-signature',
    type: 'appointment',
    action: 'created',
    payload: { appointmentId: 'apt-123' },
  });

  const response = await app.request('/webhooks/vagaro', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ringbooker-shop-token': SHOP_TOKEN,
      'x-vagaro-signature': signBody(body, 'some-other-secret'),
    },
    body,
  });

  assert.equal(response.status, 401);
  assert.equal(vagaroWebhookEventsRepository.list().length, 0);
});

test('vagaro webhook accepts valid HMAC signature and stores raw event', async () => {
  const { app, vagaroWebhookEventsRepository } = await createVagaroTestApp();
  const body = JSON.stringify({
    id: 'evt-appointment-created',
    type: 'appointment',
    action: 'created',
    payload: { appointmentId: 'apt-123' },
  });

  const response = await app.request('/webhooks/vagaro', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ringbooker-shop-token': SHOP_TOKEN,
      'x-vagaro-signature': signBody(body),
    },
    body,
  });

  assert.equal(response.status, 200);
  const events = vagaroWebhookEventsRepository.list();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.shop_id, 'demo-shop');
  assert.equal(events[0]?.event_type, 'appointment');
  assert.equal(events[0]?.action, 'created');
  assert.deepEqual(events[0]?.payload, { appointmentId: 'apt-123' });
});

test('vagaro webhook without signature header falls back to token auth', async () => {
  const { app, vagaroWebhookEventsRepository } = await createVagaroTestApp();

  const response = await app.request('/webhooks/vagaro', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ringbooker-shop-token': SHOP_TOKEN,
    },
    body: JSON.stringify({
      id: 'evt-token-auth-only',
      type: 'customer',
      action: 'created',
      payload: { customerId: 'cust-456' },
    }),
  });

  assert.equal(response.status, 200);
  const events = vagaroWebhookEventsRepository.list();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event_type, 'customer');
});

test('vagaro tokenized webhook stores per-shop raw event with redacted headers', async () => {
  const { app, vagaroWebhookEventsRepository } = await createVagaroTestApp();
  const body = JSON.stringify({
    id: 'evt-tokenized',
    type: 'appointment',
    action: 'created',
    payload: { appointmentId: 'apt-tokenized' },
  });

  const response = await app.request(`/webhooks/vagaro/${SHOP_TOKEN}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vagaro-test',
      authorization: 'Bearer secret',
      cookie: 'secret=true',
      'x-vagaro-event-id': 'evt-tokenized',
      'x-vagaro-signature': signBody(body),
    },
    body,
  });

  assert.equal(response.status, 200);
  const events = vagaroWebhookEventsRepository.list();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.shop_id, 'demo-shop');
  assert.equal(events[0]?.event_type, 'appointment');
  assert.equal(events[0]?.action, 'created');
  assert.deepEqual(events[0]?.payload, { appointmentId: 'apt-tokenized' });
  assert.equal(events[0]?.raw_headers?.authorization, undefined);
  assert.equal(events[0]?.raw_headers?.cookie, undefined);
  assert.equal(events[0]?.raw_headers?.['x-vagaro-signature'], undefined);
  assert.equal(events[0]?.raw_headers?.['x-vagaro-event-id'], 'evt-tokenized');
});

test('vagaro tokenized webhook returns 404 for unknown token', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    vagaroWebhookEventsRepository: new InMemoryVagaroWebhookEventsRepository(),
  });

  const response = await app.request('/webhooks/vagaro/whk_missing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'appointment', action: 'created', payload: {} }),
  });

  assert.equal(response.status, 404);
});

test('verifyVagaroWebhookHmac accepts prefixed signature formats and rejects mismatches', () => {
  const rawBody = '{"hello":"world"}';
  const secret = 'whk_secret';
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');

  assert.equal(verifyVagaroWebhookHmac({ rawBody, secret, signature: digest }), true);
  assert.equal(verifyVagaroWebhookHmac({ rawBody, secret, signature: `sha256=${digest}` }), true);
  assert.equal(verifyVagaroWebhookHmac({ rawBody, secret, signature: `HMAC-SHA256=${digest}` }), true);
  assert.equal(verifyVagaroWebhookHmac({ rawBody, secret, signature: 'not-a-signature' }), false);
  assert.equal(verifyVagaroWebhookHmac({ rawBody, secret: '', signature: digest }), false);
  assert.equal(verifyVagaroWebhookHmac({ rawBody, secret, signature: null }), false);
});
