import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'calls-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

function createCallsTestApp() {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository,
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  return { app, callLogsRepository };
}

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const response = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'calls-user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

test('user calls endpoint returns real tab-filtered calls, stats, and resolves stale in-progress calls', async () => {
  const { app, callLogsRepository } = createCallsTestApp();
  const cookie = await loginUser(app);
  const staleStartedAt = new Date(Date.now() - 45 * 60 * 1000);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'stale-transcript-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230001',
    destinationPhone: '+15557650001',
    requestId: 'req-stale',
    startedAt: staleStartedAt,
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'demo-shop',
    requestId: 'req-stale',
    speaker: 'caller',
    text: 'How much is a haircut?',
  });
  await callLogsRepository.updateTranscriptStatusByRequestId({
    shopId: 'demo-shop',
    requestId: 'req-stale',
    status: 'completed',
  });

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'follow-up-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230002',
    requestId: 'req-follow-up',
    startedAt: new Date(),
  });
  await callLogsRepository.updateStructuredSummary('demo-shop', 'req-follow-up', {
    summaryFollowUpRequired: true,
    summaryUrgency: 'high',
    summaryCallerQuestion: 'Customer needs a manager callback.',
  });

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'missed-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230003',
    requestId: 'req-missed',
    startedAt: new Date(),
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx',
    providerCallId: 'missed-call',
    endedAt: new Date(),
    outcome: 'missed',
  });

  const filtered = await app.request('/user/calls?tab=follow_up', { headers: { cookie } });
  assert.equal(filtered.status, 200);
  const filteredBody = await filtered.json() as {
    calls: Array<{ id: string; followUpNeeded: boolean; highUrgency: boolean; status: string; outcome: string }>;
    stats: { last7Days: number; followUp: number; highUrgency: number; missed: number };
    pagination: { page: number; limit: number; totalPages: number };
  };
  assert.equal(filteredBody.calls.length, 1);
  assert.equal(filteredBody.calls[0]?.id, 'req-follow-up');
  assert.equal(filteredBody.calls[0]?.followUpNeeded, true);
  assert.equal(filteredBody.calls[0]?.highUrgency, true);
  assert.equal(filteredBody.stats.last7Days, 3);
  assert.equal(filteredBody.stats.followUp, 1);
  assert.equal(filteredBody.stats.highUrgency, 1);
  assert.equal(filteredBody.stats.missed, 1);
  assert.equal(filteredBody.pagination.limit, 25);

  const all = await app.request('/user/calls', { headers: { cookie } });
  const allBody = await all.json() as { calls: Array<{ id: string; status: string; outcome: string; durationSeconds?: number }> };
  const stale = allBody.calls.find((call) => call.id === 'req-stale');
  assert.equal(stale?.status, 'completed');
  assert.equal(stale?.outcome, 'pricing_inquiry');
  assert.ok((stale?.durationSeconds ?? 0) >= 30 * 60);

  const detail = await app.request('/user/calls/req-stale', { headers: { cookie } });
  assert.equal(detail.status, 200);
  const detailBody = await detail.json() as { call: { id: string; transcriptAvailable: boolean; transcriptText?: string } };
  assert.equal(detailBody.call.id, 'req-stale');
  assert.equal(detailBody.call.transcriptAvailable, true);
  assert.match(detailBody.call.transcriptText ?? '', /haircut/);
});
