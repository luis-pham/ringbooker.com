import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
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

  async markProcessed(event: ProviderEventRecord): Promise<void> {
    this.processed.push(event);
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
