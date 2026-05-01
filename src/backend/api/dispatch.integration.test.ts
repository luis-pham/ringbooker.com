import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

test('agent dispatch endpoint requires bearer token when configured', async () => {
  applyRequiredTestEnv({
    AGENT_DISPATCH_AUTH_TOKEN: 'dispatch-test-token',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const payload = {
    requestId: 'req-1',
    roomName: 'rb-call-123',
    destinationPhone: '+17145550123',
    callerPhone: '+14155550000',
    systemPrompt: 'test prompt',
    realtime: {
      mode: 'livekit_realtime' as const,
      sessionId: 'lk-session',
      roomName: 'rb-call-123',
      status: 'started' as const,
      metadata: {
        requestId: 'req-1',
        shopId: 'demo-shop',
        dispatchPayload: {
          transport: { provider: 'livekit', roomName: 'rb-call-123' },
          llm: { provider: 'gemini_live', model: 'gemini-2.5', apiKeyConfigured: true },
          context: {
            requestId: 'req-1',
            shopId: 'demo-shop',
            callerPhone: '+14155550000',
            destinationPhone: '+17145550123',
          },
        },
      },
    },
  };

  const unauthorized = await app.request('/agent/dispatch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify(payload),
  });
  assert.equal(unauthorized.status, 401);

  const authorized = await app.request('/agent/dispatch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      authorization: 'Bearer dispatch-test-token',
    },
    body: JSON.stringify(payload),
  });

  assert.equal(authorized.status, 200);
  const body = await authorized.json();
  assert.equal(body.ok, true);
  assert.equal(body.accepted, true);
  assert.equal(body.requestId, 'req-1');
});

test('agent dispatch status completed enqueues post-call summary job', async () => {
  applyRequiredTestEnv({
    AGENT_DISPATCH_AUTH_TOKEN: 'dispatch-test-token',
  });

  const callLogsRepository = new InMemoryCallLogsRepository();
  const jobsRepository = new InMemoryJobsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'marketing_demo',
    providerCallId: 'req-2',
    shopId: 'demo-shop',
    callerPhone: '+14155550000',
    destinationPhone: '+17145550123',
    requestId: 'req-2',
    roomName: 'rb-call-222',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    callLogsRepository,
    jobsRepository,
  });

  const response = await app.request('/agent/dispatch/status', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      authorization: 'Bearer dispatch-test-token',
    },
    body: JSON.stringify({
      requestId: 'req-2',
      roomName: 'rb-call-222',
      sessionId: 'lk-session-2',
      status: 'completed',
      shopId: 'demo-shop',
    }),
  });

  assert.equal(response.status, 200);
  const leased = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.ok(leased);
  assert.equal(leased.type, 'post_call_summary');
  assert.equal(leased.shopId, 'demo-shop');
  assert.equal(leased.payload.requestId, 'req-2');
});
