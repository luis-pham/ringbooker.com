import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
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
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    shopsRepository: new InMemoryShopsRepository(),
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

test('telnyx incoming YES message enqueues callback outbound call', async () => {
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
  assert.equal(leased.type, 'callback_outbound_call');
  assert.equal(leased.payload.customerPhone, '+14155550011');
});
