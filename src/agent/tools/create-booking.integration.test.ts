import test from 'node:test';
import assert from 'node:assert/strict';

import { createInboundAgentSession } from '@/src/agent/runtime/session';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv();

test('create_booking tool persists pending manual booking without reminder/review jobs', async () => {
  const bookingsRepository = new InMemoryBookingsRepository();
  const jobsRepository = new InMemoryJobsRepository();
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updateUserSettings('demo-shop', { booking_url: null });
  const session = await createInboundAgentSession(
    {
      shopsRepository,
      jobsRepository,
      bookingsRepository,
      callbacksRepository: new InMemoryCallbacksRepository(),
      telephonyService: new NoopTelephonyService(),
      realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    },
    {
      destinationPhone: '+17145550123',
      callerPhone: '+14155550199',
      requestId: 'test-create-booking',
      roomName: 'rb-call-test-create-booking',
    },
  );

  assert.ok(session);

  const validation = await session.runTool('validate_appointment_time', {
    date: '2099-01-02',
    time: '10:00',
  });
  assert.equal((validation as { valid?: boolean }).valid, true);

  const result = await session.runTool('create_booking', {
    date: '2099-01-02',
    time: '10:00',
    service: 'Manicure',
    customerName: 'Test Customer',
  });

  assert.equal((result as { success?: boolean }).success, true);
  const bookingId = (result as { bookingId: string }).bookingId;
  const booking = await bookingsRepository.findById(bookingId);
  assert.ok(booking);
  assert.equal(booking.customerName, 'Test Customer');
  assert.equal(booking.status, 'pending');
  assert.equal(booking.callLogId, 'test-create-booking');

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
