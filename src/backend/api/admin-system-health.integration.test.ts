import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';

applyRequiredTestEnv({
  ADMIN_AUTH_EMAIL: 'admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});

test('admin system health metrics endpoint requires admin session and returns aggregated metrics', async () => {
  const jobsRepository = new InMemoryJobsRepository();
  await jobsRepository.enqueue({
    shopId: 'demo-shop',
    type: 'appointment_reminder_24h',
    payload: {},
    runAt: new Date(),
    idempotencyKey: 'test-job-1',
  });

  incrementMetric('webhook_requests_total', { provider: 'telnyx', outcome: 'processed' });
  incrementMetric('webhook_signature_invalid_total', { provider: 'telnyx' });
  observeDurationMs('realtime_response_latency_ms', 220, { transport: 'livekit', voiceProvider: 'gemini_live' });
  observeDurationMs('realtime_audio_jitter_ms', 12, { transport: 'livekit', voiceProvider: 'gemini_live' });
  observeDurationMs('toolcall_duration_ms', 340, { provider: 'gemini_live', toolName: 'check_availability', outcome: 'success' });
  incrementMetric('toolcall_total', { provider: 'gemini_live', toolName: 'check_availability', outcome: 'success' });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const unauthorized = await app.request('/admin/system-health/metrics');
  assert.equal(unauthorized.status, 401);

  const loginResponse = await app.request('/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'admin@ringbooker.local',
      password: 'change_me_admin_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookieHeader = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookieHeader);

  const response = await app.request('/admin/system-health/metrics', {
    headers: {
      cookie: cookieHeader!,
    },
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    realtime?: { responseLatencyMs: { avg: number }; jitterMs: { avg: number } };
    toolcalls?: { total: number };
    webhooks?: { processed: number; invalidSignature: number };
    jobs?: { queued: number };
  };
  assert.equal(body.ok, true);
  assert.equal(body.realtime?.responseLatencyMs.avg, 220);
  assert.equal(body.realtime?.jitterMs.avg, 12);
  assert.equal(body.toolcalls?.total, 1);
  assert.equal(body.webhooks?.processed, 1);
  assert.equal(body.webhooks?.invalidSignature, 1);
  assert.equal(body.jobs?.queued, 1);
});

