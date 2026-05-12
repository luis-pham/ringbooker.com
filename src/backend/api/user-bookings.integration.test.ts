import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryOutboundMessagesRepository } from '@/src/backend/adapters/memory/outbound-messages-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'bookings-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

function createBookingsTestApp() {
  const bookingsRepository = new InMemoryBookingsRepository();
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository,
    callbacksRepository: new InMemoryCallbacksRepository(),
    outboundMessagesRepository,
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository,
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  return { app, bookingsRepository, outboundMessagesRepository, callLogsRepository };
}

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const response = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'bookings-user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

test('user bookings endpoint returns real filtered data, stats, detail, sms log, and status override', async () => {
  const { app, bookingsRepository, outboundMessagesRepository, callLogsRepository } = createBookingsTestApp();
  const cookie = await loginUser(app);

  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'call-1',
    shopId: 'demo-shop',
    callerPhone: '+15551230001',
    requestId: 'req-booking',
    startedAt: new Date('2026-05-11T10:00:00.000Z'),
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'demo-shop',
    requestId: 'req-booking',
    speaker: 'caller',
    text: 'I want to book a haircut.',
  });
  await callLogsRepository.updateTranscriptStatusByRequestId({ shopId: 'demo-shop', requestId: 'req-booking', status: 'completed' });

  const confirmed = await bookingsRepository.create({
    id: 'booking-confirmed',
    shopId: 'demo-shop',
    customerPhone: '+15551230001',
    customerName: 'Alex Client',
    service: 'Haircut',
    techName: 'Maya',
    datetimeUtc: '2026-05-14T19:00:00.000Z',
    timezone: 'America/Chicago',
    durationMinutes: 45,
    status: 'confirmed',
    callLogId: 'req-booking',
  });
  await bookingsRepository.create({
    id: 'booking-captured',
    shopId: 'demo-shop',
    customerPhone: '+15551230002',
    service: 'Color',
    datetimeUtc: '2026-05-15T19:00:00.000Z',
    timezone: 'America/Chicago',
    status: 'captured',
  });
  await outboundMessagesRepository.create({
    shopId: 'demo-shop',
    bookingId: confirmed.id,
    customerPhone: confirmed.customerPhone,
    category: 'booking_confirmation',
    body: 'Confirmed',
    idempotencyKey: 'booking-confirmation-1',
    status: 'sent',
  });

  const filtered = await app.request('/user/bookings?tab=confirmed', { headers: { cookie } });
  assert.equal(filtered.status, 200);
  const filteredBody = await filtered.json() as {
    bookings: Array<{ id: string; status: string; callerName?: string; serviceRequested?: string }>;
    stats: { total: number; awaitingAction: number; confirmed: number };
    pagination: { page: number; limit: number; totalPages: number };
  };
  assert.equal(filteredBody.bookings.length, 1);
  assert.equal(filteredBody.bookings[0]?.id, 'booking-confirmed');
  assert.equal(filteredBody.bookings[0]?.callerName, 'Alex Client');
  assert.equal(filteredBody.bookings[0]?.serviceRequested, 'Haircut');
  assert.equal(filteredBody.stats.total, 2);
  assert.equal(filteredBody.stats.awaitingAction, 1);
  assert.equal(filteredBody.stats.confirmed, 1);
  assert.equal(filteredBody.pagination.limit, 25);

  const detail = await app.request('/user/bookings/booking-confirmed', { headers: { cookie } });
  assert.equal(detail.status, 200);
  const detailBody = await detail.json() as { booking: { smsLog: Array<{ type: string }>; parentCall?: { id: string; transcriptAvailable: boolean } } };
  assert.equal(detailBody.booking.smsLog[0]?.type, 'confirmation');
  assert.equal(detailBody.booking.parentCall?.id, 'req-booking');
  assert.equal(detailBody.booking.parentCall?.transcriptAvailable, true);

  const patch = await app.request('/user/bookings/booking-confirmed', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(patch.status, 200);
  const patchBody = await patch.json() as { booking: { status: string } };
  assert.equal(patchBody.booking.status, 'completed');

  const invalid = await app.request('/user/bookings/booking-captured', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(invalid.status, 400);
});
