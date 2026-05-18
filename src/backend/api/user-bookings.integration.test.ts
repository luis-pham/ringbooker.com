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
  const jobsRepository = new InMemoryJobsRepository();
  const outboundMessagesRepository = new InMemoryOutboundMessagesRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository,
    bookingsRepository,
    callbacksRepository: new InMemoryCallbacksRepository(),
    outboundMessagesRepository,
    shopsRepository: new InMemoryShopsRepository(),
    telephonyService: new NoopTelephonyService(),
    callLogsRepository,
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  return { app, bookingsRepository, outboundMessagesRepository, callLogsRepository, jobsRepository };
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

test('confirming a booking schedules reminders when appointment time is verified and future', async () => {
  const { app, bookingsRepository, jobsRepository } = createBookingsTestApp();
  const cookie = await loginUser(app);

  await bookingsRepository.create({
    id: 'booking-contacted-confirm-later',
    shopId: 'demo-shop',
    customerPhone: '+15551230003',
    customerName: 'Later Confirm',
    service: 'Haircut',
    datetimeUtc: '2099-01-02T19:00:00.000Z',
    timezone: 'America/Chicago',
    status: 'contacted',
    provider: 'manual',
    providerStatus: 'request_only',
  });

  const patch = await app.request('/user/bookings/booking-contacted-confirm-later', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert.equal(patch.status, 200);

  const leasedTypes = new Set<string>();
  const farFutureNow = new Date('2100-01-01T00:00:00.000Z');
  while (true) {
    const leased = await jobsRepository.leaseNext({
      now: farFutureNow,
      leaseSeconds: 30,
      workerId: 'test-worker',
    });
    if (!leased) break;
    leasedTypes.add(leased.type);
  }

  assert.equal(leasedTypes.has('appointment_reminder_24h'), true);
  assert.equal(leasedTypes.has('appointment_reminder_2h'), true);
  assert.equal(leasedTypes.has('review_request_sms'), true);
});

test('confirming a booking_link source does not schedule time-based followups', async () => {
  const { app, bookingsRepository, jobsRepository } = createBookingsTestApp();
  const cookie = await loginUser(app);

  await bookingsRepository.create({
    id: 'booking-link-confirm-later',
    shopId: 'demo-shop',
    customerPhone: '+15551230004',
    customerName: 'Link Customer',
    service: 'Haircut',
    datetimeUtc: '2099-01-03T19:00:00.000Z',
    timezone: 'America/Chicago',
    status: 'contacted',
    provider: 'booking_link',
    providerStatus: 'request_only',
  });

  const patch = await app.request('/user/bookings/booking-link-confirm-later', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'confirmed' }),
  });
  assert.equal(patch.status, 200);

  const leasedTypes = new Set<string>();
  const farFutureNow = new Date('2100-01-01T00:00:00.000Z');
  while (true) {
    const leased = await jobsRepository.leaseNext({
      now: farFutureNow,
      leaseSeconds: 30,
      workerId: 'test-worker',
    });
    if (!leased) break;
    leasedTypes.add(leased.type);
  }

  assert.equal(leasedTypes.has('appointment_reminder_24h'), false);
  assert.equal(leasedTypes.has('appointment_reminder_2h'), false);
  assert.equal(leasedTypes.has('review_request_sms'), false);
});
