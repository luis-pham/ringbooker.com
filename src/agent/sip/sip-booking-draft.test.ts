import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSipAgentToolContext,
  updateSipBookingDraftFromTranscript,
} from '@/src/agent/sip/sip-tool-executor';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';

function memoryDeps() {
  return {
    shopsRepository: new InMemoryShopsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    telephonyService: new NoopTelephonyService(),
  };
}

test('SIP tool context owns a booking draft updated from caller transcript', async () => {
  const deps = memoryDeps();
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);

  const ctx = createSipAgentToolContext({
    shop,
    callerPhone: '+15550001111',
    requestId: 'sip-booking-draft',
    roomName: 'sip-room-booking-draft',
    deps,
  });

  const update = updateSipBookingDraftFromTranscript(ctx, 'I want to book color tomorrow at nine AM.');

  assert.ok(update);
  assert.ok(update.reasonCodes.includes('booking_intent_detected'));
  assert.equal(ctx.bookingDraft?.intent, 'book_appointment');
  assert.ok(ctx.bookingDraft?.serviceCandidates.includes('color'));
  assert.ok(ctx.bookingDraft?.timeCandidates.includes('9 AM'));
  assert.equal((update.bookingDraft as { phoneComplete?: boolean } | null)?.phoneComplete, false);
  assert.equal(ctx.bookingDraft?.missingFields.includes('phone'), false);
});
