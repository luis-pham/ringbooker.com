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
import type { CallRecordingStorage } from '@/src/backend/services/calls/call-recording-storage';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'calls-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

function createCallsTestApp(recordingStorage?: CallRecordingStorage) {
  const callLogsRepository = new InMemoryCallLogsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  const bookingsRepository = new InMemoryBookingsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository,
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository,
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    recordingStorage,
  });
  return { app, callLogsRepository, shopsRepository, bookingsRepository };
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

test('user calls shows a booking outcome only when a linked booking record exists', async () => {
  const { app, callLogsRepository, bookingsRepository } = createCallsTestApp();
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'unconfirmed-request-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230100',
    requestId: 'req-unconfirmed-request',
    startedAt: new Date(),
  });
  await callLogsRepository.updateStructuredSummary('demo-shop', 'req-unconfirmed-request', {
    summaryServiceRequest: 'Relaxing massage',
    summaryNextAction: 'booking_created',
    summaryFollowUpRequired: true,
  });

  const withoutBooking = await app.request('/user/calls', { headers: { cookie } });
  const withoutBookingBody = await withoutBooking.json() as {
    calls: Array<{ id: string; outcome: string; bookingCaptured: boolean; bookingRequestId?: string }>;
    stats: { bookings: number };
  };
  const unlinked = withoutBookingBody.calls.find((call) => call.id === 'req-unconfirmed-request');
  assert.equal(unlinked?.outcome, 'follow_up_needed');
  assert.equal(unlinked?.bookingCaptured, false);
  assert.equal(withoutBookingBody.stats.bookings, 0);

  const booking = await bookingsRepository.create({
    shopId: 'demo-shop',
    customerPhone: '+15551230100',
    service: 'Relaxing massage',
    datetimeUtc: new Date().toISOString(),
    timezone: 'America/Los_Angeles',
    status: 'pending',
    callLogId: 'req-unconfirmed-request',
  });

  const withBooking = await app.request('/user/calls', { headers: { cookie } });
  const withBookingBody = await withBooking.json() as {
    calls: Array<{ id: string; outcome: string; bookingCaptured: boolean; bookingRequestId?: string }>;
    stats: { bookings: number };
  };
  const linked = withBookingBody.calls.find((call) => call.id === 'req-unconfirmed-request');
  assert.equal(linked?.outcome, 'booking_request');
  assert.equal(linked?.bookingCaptured, true);
  assert.equal(linked?.bookingRequestId, booking.id);
  assert.equal(withBookingBody.stats.bookings, 1);

  await bookingsRepository.updateStatusByShop('demo-shop', booking.id, 'completed');
  const afterCompleted = await app.request('/user/calls', { headers: { cookie } });
  const afterCompletedBody = await afterCompleted.json() as { calls: Array<{ id: string; outcome: string }> };
  assert.equal(afterCompletedBody.calls.find((call) => call.id === 'req-unconfirmed-request')?.outcome, 'booking_completed');

  await callLogsRepository.updateStructuredSummary('demo-shop', 'req-unconfirmed-request', {
    summaryNextAction: 'cancellation_requested',
  });
  const cancellationRequest = await app.request('/user/calls', { headers: { cookie } });
  const cancellationRequestBody = await cancellationRequest.json() as { calls: Array<{ id: string; outcome: string }> };
  assert.equal(cancellationRequestBody.calls.find((call) => call.id === 'req-unconfirmed-request')?.outcome, 'cancelled_request');
});

test('user calls labels an assistant-only greeting as no caller response and not a captured outcome', async () => {
  const { app, callLogsRepository } = createCallsTestApp();
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'assistant-only-greeting-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230101',
    requestId: 'req-assistant-only-greeting',
    startedAt: new Date(),
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'demo-shop',
    requestId: 'req-assistant-only-greeting',
    speaker: 'assistant',
    text: 'Thank you for calling Avalon Salon and Spa. How can I help you today?',
  });

  const response = await app.request('/user/calls', { headers: { cookie } });
  const body = await response.json() as { calls: Array<{ id: string; outcome: string; bookingCaptured: boolean }> };
  const call = body.calls.find((item) => item.id === 'req-assistant-only-greeting');
  assert.equal(call?.outcome, 'no_response');
  assert.equal(call?.bookingCaptured, false);
});

test('follow-up filtering uses the resolvable follow-up flag and clearing it also removes high urgency', async () => {
  const { app, callLogsRepository } = createCallsTestApp();
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'flagged-call',
    shopId: 'demo-shop',
    requestId: 'req-flagged-call',
    startedAt: new Date(),
  });
  await callLogsRepository.updateStructuredSummary('demo-shop', 'req-flagged-call', {
    summaryFollowUpRequired: true,
    summaryUrgency: 'high',
  });
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'legacy-callback-call',
    shopId: 'demo-shop',
    requestId: 'req-legacy-callback',
    startedAt: new Date(),
  });
  await callLogsRepository.updateStructuredSummary('demo-shop', 'req-legacy-callback', {
    summaryNextAction: 'callback_scheduled',
    summaryFollowUpRequired: false,
  });

  const before = await app.request('/user/calls?tab=follow_up', { headers: { cookie } });
  const beforeBody = await before.json() as { calls: Array<{ id: string }>; stats: { followUp: number; highUrgency: number } };
  assert.deepEqual(beforeBody.calls.map((call) => call.id), ['req-flagged-call']);
  assert.equal(beforeBody.stats.followUp, 1);
  assert.equal(beforeBody.stats.highUrgency, 1);

  const resolved = await app.request('/user/calls/req-flagged-call/follow-up-done', {
    method: 'PATCH',
    headers: { cookie },
  });
  assert.equal(resolved.status, 200);

  const after = await app.request('/user/calls?tab=follow_up', { headers: { cookie } });
  const afterBody = await after.json() as { calls: Array<{ id: string }>; stats: { followUp: number; highUrgency: number } };
  assert.equal(afterBody.calls.length, 0);
  assert.equal(afterBody.stats.followUp, 0);
  assert.equal(afterBody.stats.highUrgency, 0);
});

test('Starter can view call transcripts and advanced call analytics fields', async () => {
  const { app, callLogsRepository, shopsRepository } = createCallsTestApp();
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter' });
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'starter-transcript-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230004',
    requestId: 'req-starter-transcript',
    startedAt: new Date(),
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'demo-shop',
    requestId: 'req-starter-transcript',
    speaker: 'caller',
    text: 'Can I book a manicure?',
  });
  await callLogsRepository.updateStructuredSummary('demo-shop', 'req-starter-transcript', {
    summaryServiceRequest: 'Manicure',
    summaryFollowUpRequired: true,
    summaryUrgency: 'high',
  });

  const list = await app.request('/user/calls', { headers: { cookie } });
  assert.equal(list.status, 200);
  const listBody = await list.json() as {
    calls: Array<{ id: string; transcriptAvailable?: boolean; transcriptText?: string; highUrgency?: boolean; summary?: string }>;
    stats: { followUp: number; highUrgency: number };
  };
  const listedCall = listBody.calls.find((call) => call.id === 'req-starter-transcript');
  assert.equal(listedCall?.transcriptAvailable, true);
  assert.match(listedCall?.transcriptText ?? '', /manicure/);
  assert.equal(listedCall?.highUrgency, true);
  assert.match(listedCall?.summary ?? '', /Manicure/);
  assert.equal(listBody.stats.followUp, 1);
  assert.equal(listBody.stats.highUrgency, 1);

  const detail = await app.request('/user/calls/req-starter-transcript', { headers: { cookie } });
  assert.equal(detail.status, 200);
  const detailBody = await detail.json() as {
    call: { transcriptAvailable: boolean; transcriptText?: string; highUrgency?: boolean; summary?: string };
  };
  assert.equal(detailBody.call.transcriptAvailable, true);
  assert.match(detailBody.call.transcriptText ?? '', /manicure/);
  assert.equal(detailBody.call.highUrgency, true);
  assert.match(detailBody.call.summary ?? '', /Manicure/);
});

test('Professional can request a signed recording playback URL for its available call recording', async () => {
  const recordingStorage: CallRecordingStorage = {
    storeFromUrl: async () => undefined,
    createPlaybackUrl: async ({ objectKey }) => `https://recordings.example/${objectKey}`,
  };
  const { app, callLogsRepository } = createCallsTestApp(recordingStorage);
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'professional-recording-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230005',
    requestId: 'req-professional-recording',
    startedAt: new Date(),
  });
  await callLogsRepository.markRecordingAvailableByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'professional-recording-call',
    recordingProvider: 'telnyx',
    recordingId: 'rec-professional',
    recordingStorageKey: 'call-recordings/demo-shop/req-professional-recording/rec-professional.mp3',
    recordingFormat: 'mp3',
  });

  const list = await app.request('/user/calls', { headers: { cookie } });
  assert.equal(list.status, 200);
  const listBody = await list.json() as { calls: Array<{ id: string; recordingAvailable?: boolean }> };
  assert.equal(listBody.calls.find((call) => call.id === 'req-professional-recording')?.recordingAvailable, true);

  const playback = await app.request('/user/calls/professional-recording-call/recording-playback-url', { headers: { cookie } });
  assert.equal(playback.status, 200);
  const playbackBody = await playback.json() as { ok: boolean; url: string; expiresInSeconds: number };
  assert.equal(playbackBody.ok, true);
  assert.match(playbackBody.url, /rec-professional\.mp3$/);
  assert.equal(playbackBody.expiresInSeconds, 300);
});

test('Starter cannot request recording playback even when a stored recording exists', async () => {
  const recordingStorage: CallRecordingStorage = {
    storeFromUrl: async () => undefined,
    createPlaybackUrl: async () => 'https://recordings.example/should-not-be-returned',
  };
  const { app, callLogsRepository, shopsRepository } = createCallsTestApp(recordingStorage);
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter' });
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'starter-recording-call',
    shopId: 'demo-shop',
    callerPhone: '+15551230006',
    requestId: 'req-starter-recording',
    startedAt: new Date(),
  });
  await callLogsRepository.markRecordingAvailableByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'starter-recording-call',
    recordingProvider: 'telnyx',
    recordingId: 'rec-starter',
    recordingStorageKey: 'call-recordings/demo-shop/req-starter-recording/rec-starter.mp3',
    recordingFormat: 'mp3',
  });

  const list = await app.request('/user/calls', { headers: { cookie } });
  const listBody = await list.json() as { calls: Array<{ id: string; recordingAvailable?: boolean }> };
  assert.equal(listBody.calls.find((call) => call.id === 'req-starter-recording')?.recordingAvailable, undefined);

  const playback = await app.request('/user/calls/starter-recording-call/recording-playback-url', { headers: { cookie } });
  assert.equal(playback.status, 403);
  const playbackBody = await playback.json() as { error: string; requirements: { capability: string } };
  assert.equal(playbackBody.error, 'plan_feature_locked');
  assert.equal(playbackBody.requirements.capability, 'call_recording_playback');
});

test('Starter cannot request call recovery insights', async () => {
  const { app, shopsRepository } = createCallsTestApp();
  await shopsRepository.updatePlanAndActivation('demo-shop', { plan: 'starter' });
  const cookie = await loginUser(app);

  const response = await app.request('/user/calls/insights', { headers: { cookie } });
  assert.equal(response.status, 403);
  const body = await response.json() as { error: string; requirements: { capability: string } };
  assert.equal(body.error, 'plan_feature_locked');
  assert.equal(body.requirements.capability, 'call_recovery_insights');
});

test('Professional call recovery insights aggregate calls in the current usage period', async () => {
  const { app, callLogsRepository } = createCallsTestApp();
  const cookie = await loginUser(app);
  const startedAt = new Date();

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'insights-missed',
    shopId: 'demo-shop',
    requestId: 'req-insights-missed',
    startedAt,
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx',
    providerCallId: 'insights-missed',
    endedAt: new Date(),
    outcome: 'missed',
  });
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'insights-answered-not-captured',
    shopId: 'demo-shop',
    requestId: 'req-insights-answered-not-captured',
    startedAt,
  });
  for (const [index, service] of ['Haircut', 'Haircut', 'Color'].entries()) {
    const requestId = `req-insights-captured-${index}`;
    await callLogsRepository.createOrUpdateInboundCall({
      provider: 'telnyx',
      providerCallId: `insights-captured-${index}`,
      shopId: 'demo-shop',
      requestId,
      startedAt,
    });
    await callLogsRepository.updateStructuredSummary('demo-shop', requestId, { summaryServiceRequest: service });
  }

  const response = await app.request('/user/calls/insights', { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json() as {
    missedOpportunities: { percentage: number; trend: Array<{ date: string; count: number }> };
    topServices: Array<{ service: string; count: number; percentage: number }>;
    peakCallTimes: Array<{ hour: number; count: number }>;
  };
  assert.equal(body.missedOpportunities.percentage, 20);
  assert.equal(body.missedOpportunities.trend.reduce((sum, item) => sum + item.count, 0), 1);
  assert.deepEqual(body.topServices[0], { service: 'Haircut', count: 2, percentage: 67 });
  assert.equal(body.peakCallTimes.reduce((sum, item) => sum + item.count, 0), 5);
});
