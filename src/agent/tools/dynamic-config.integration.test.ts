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

test('dynamic shop config gates tool behavior and reminder job enqueueing', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  await shopsRepository.updateDynamicConfig('demo-shop', {
    allow_transfers: false,
    allow_callbacks: false,
    send_reminder_sms: false,
    send_review_request_sms: false,
    ai_welcome_message: 'Thanks for calling the demo shop.',
  });

  const bookingsRepository = new InMemoryBookingsRepository();
  const jobsRepository = new InMemoryJobsRepository();
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
      requestId: 'test-dynamic-config',
      roomName: 'rb-call-test-dynamic-config',
    },
  );

  assert.ok(session);

  const transferResult = (await session.runTool('transfer_to_user', {
    reason: 'Caller wants a human.',
  })) as Record<string, unknown>;
  assert.equal('success' in transferResult, false);
  assert.equal(transferResult.code, 'TRANSFER_FAILED');

  const callbackResult = (await session.runTool('schedule_callback', {
    reason: 'Need a follow up call.',
  })) as Record<string, unknown>;
  assert.equal('success' in callbackResult, false);
  assert.equal(callbackResult.code, 'RATE_LIMITED');

  const bookingResult = await session.runTool('create_booking', {
    date: '2099-01-02',
    time: '10:00',
    service: 'Manicure',
    customerName: 'Test Customer',
  });

  assert.equal((bookingResult as { success?: boolean }).success, true);
  const bookingId = (bookingResult as { bookingId: string }).bookingId;
  const booking = await bookingsRepository.findById(bookingId);
  assert.ok(booking);

  const farFutureNow = new Date('2100-01-01T00:00:00.000Z');
  const leasedTypes = new Set<string>();
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
