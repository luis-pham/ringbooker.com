import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  BACKEND_INTERNAL_API_KEY: 'test-internal-key',
});

test('metrics endpoint requires internal key and returns snapshot', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const unauthorized = await app.request('/metrics');
  assert.equal(unauthorized.status, 401);

  const health = await app.request('/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const readinessUnauthorized = await app.request('/readiness');
  assert.equal(readinessUnauthorized.status, 401);
  const readinessUnauthorizedBody = await readinessUnauthorized.text();
  assert.equal(readinessUnauthorizedBody.includes('supabase'), false);
  assert.equal(readinessUnauthorizedBody.includes('telnyx'), false);

  const readinessAuthorized = await app.request('/readiness', {
    headers: {
      'x-backend-key': 'test-internal-key',
    },
  });
  assert.equal(readinessAuthorized.status, 200);

  const authorized = await app.request('/metrics', {
    headers: {
      'x-backend-key': 'test-internal-key',
    },
  });
  assert.equal(authorized.status, 200);
  const body = (await authorized.json()) as {
    ok: boolean;
    generatedAt: string;
    metrics: Array<{ name: string; type: string }>;
  };
  assert.equal(body.ok, true);
  assert.ok(typeof body.generatedAt === 'string' && body.generatedAt.length > 0);
  assert.ok(body.metrics.some((metric) => metric.name === 'api_requests_total'));
});

test('public routes reject oversized bodies before parsing', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
  });

  const response = await app.request('/public/contact/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(5 * 1024 * 1024),
    },
    body: '{}',
  });

  assert.equal(response.status, 413);
});
