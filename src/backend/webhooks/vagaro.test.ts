import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryVagaroWebhookEventsRepository } from '@/src/backend/adapters/memory/vagaro-webhook-events-repository';
import type { ProviderEventRecord, ProviderEventsRepository } from '@/src/backend/ports/repositories';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  VAGARO_WEBHOOK_VERIFICATION_TOKEN: 'correct-token',
});

class MockProviderEventsRepository implements ProviderEventsRepository {
  readonly processed: ProviderEventRecord[] = [];
  readonly errors: Array<{ provider: string; providerEventId: string; reason: string }> = [];

  async hasProcessed(provider: string, providerEventId: string): Promise<boolean> {
    return this.processed.some((event) => event.provider === provider && event.providerEventId === providerEventId);
  }

  async tryMarkProcessing(event: ProviderEventRecord): Promise<{ acquired: boolean; state?: 'processing' | 'processed' | 'failed' }> {
    if (await this.hasProcessed(event.provider, event.providerEventId)) {
      return { acquired: false, state: 'processed' };
    }
    this.processed.push(event);
    return { acquired: true, state: 'processing' };
  }

  async markProcessed(event: ProviderEventRecord): Promise<void> {
    if (!(await this.hasProcessed(event.provider, event.providerEventId))) this.processed.push(event);
  }

  async markProcessingError(provider: string, providerEventId: string, reason: string): Promise<void> {
    this.errors.push({ provider, providerEventId, reason });
  }

  async clearProcessingError(): Promise<void> {
    // no-op for this test double
  }
}

function createVagaroTestApp(providerEventsRepository = new MockProviderEventsRepository()) {
  return {
    app: createBackendApp({ providerEventsRepository }),
    providerEventsRepository,
  };
}

function postVagaroWebhook(app: ReturnType<typeof createBackendApp>, signature: string, body: unknown) {
  return app.request('/webhooks/vagaro', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Vagaro-Signature': signature,
    },
    body: JSON.stringify(body),
  });
}

test('vagaro webhook rejects wrong signature', async () => {
  const { app, providerEventsRepository } = createVagaroTestApp();

  const response = await postVagaroWebhook(app, 'wrong-token', {
    id: 'evt-wrong-signature',
    createdDate: '2026-04-30T00:00:00Z',
    type: 'appointment',
    action: 'created',
    payload: {
      appointmentId: 'apt-123',
    },
  });

  assert.equal(response.status, 401);
  assert.equal(providerEventsRepository.processed.length, 0);
});

test('vagaro webhook accepts correct signature', async () => {
  const { app } = createVagaroTestApp();

  const response = await postVagaroWebhook(app, 'correct-token', {
    id: 'evt-appointment-created',
    createdDate: '2026-04-30T00:00:00Z',
    type: 'appointment',
    action: 'created',
    payload: {
      appointmentId: 'apt-123',
    },
  });

  assert.equal(response.status, 200);
});

test('vagaro duplicate webhook is ignored', async () => {
  const { app, providerEventsRepository } = createVagaroTestApp();
  const body = {
    id: 'evt-duplicate',
    createdDate: '2026-04-30T00:00:00Z',
    type: 'appointment',
    action: 'created',
    payload: {
      appointmentId: 'apt-duplicate',
    },
  };

  const firstResponse = await postVagaroWebhook(app, 'correct-token', body);
  const secondResponse = await postVagaroWebhook(app, 'correct-token', body);

  assert.equal(firstResponse.status, 200);
  assert.equal(secondResponse.status, 200);
  assert.equal(providerEventsRepository.processed.length, 1);
});

test('vagaro appointment created event handled', async () => {
  const { app, providerEventsRepository } = createVagaroTestApp();

  const response = await postVagaroWebhook(app, 'correct-token', {
    id: 'evt-appointment-object-created',
    createdDate: '2026-04-30T00:00:00Z',
    type: 'appointment',
    action: 'created',
    payload: {
      appointmentId: 'apt-123',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(providerEventsRepository.processed.length, 1);
  assert.deepEqual(providerEventsRepository.processed[0], {
    provider: 'vagaro',
    providerEventId: 'evt-appointment-object-created',
    eventType: 'appointment.created',
    payload: {
      id: 'evt-appointment-object-created',
      createdDate: '2026-04-30T00:00:00Z',
      type: 'appointment',
      action: 'created',
      payload: {
        appointmentId: 'apt-123',
      },
    },
  });
});

test('vagaro customer created event handled', async () => {
  const { app, providerEventsRepository } = createVagaroTestApp();

  const response = await postVagaroWebhook(app, 'correct-token', {
    id: 'evt-customer-object-created',
    createdDate: '2026-04-30T00:00:00Z',
    type: 'customer',
    action: 'created',
    payload: {
      customerId: 'cust-456',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(providerEventsRepository.processed.length, 1);
  assert.deepEqual(providerEventsRepository.processed[0], {
    provider: 'vagaro',
    providerEventId: 'evt-customer-object-created',
    eventType: 'customer.created',
    payload: {
      id: 'evt-customer-object-created',
      createdDate: '2026-04-30T00:00:00Z',
      type: 'customer',
      action: 'created',
      payload: {
        customerId: 'cust-456',
      },
    },
  });
});

test('vagaro tokenized webhook stores per-shop raw event', async () => {
  const providerEventsRepository = new MockProviderEventsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const vagaroWebhookEventsRepository = new InMemoryVagaroWebhookEventsRepository();
  await shopsRepository.updateVagaroSettings('demo-shop', {
    vagaro_webhook_token: 'whk_testtoken',
  });
  const app = createBackendApp({
    providerEventsRepository,
    shopsRepository,
    vagaroWebhookEventsRepository,
  });

  const response = await app.request('/webhooks/vagaro/whk_testtoken', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'vagaro-test',
      authorization: 'Bearer secret',
      cookie: 'secret=true',
      'x-vagaro-event-id': 'evt-tokenized',
      'x-vagaro-signature': 'do-not-store',
    },
    body: JSON.stringify({
      id: 'evt-tokenized',
      type: 'appointment',
      action: 'created',
      payload: { appointmentId: 'apt-tokenized' },
    }),
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
    providerEventsRepository: new MockProviderEventsRepository(),
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
