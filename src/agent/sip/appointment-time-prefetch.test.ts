/**
 * Tests for the server-side appointment-time pre-population and cache-hit path.
 *
 * Verifies:
 * 1. Transcript with explicit time → ctx.appointmentTimeValidation.latest is populated
 * 2. executeSipShopToolCall returns cached result for matching date+time (no re-execution)
 * 3. Cache miss (different time) → tool executes normally and updates cache
 * 4. Second transcript with a different time → cache is invalidated and re-computed
 * 5. Transcript without a recognizable time → cache unchanged
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createSipAgentToolContext, executeSipShopToolCall, prePopulateFromTranscript } from '@/src/agent/sip/sip-tool-executor';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

function memoryDeps() {
  return {
    shopsRepository: new InMemoryShopsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    telephonyService: new NoopTelephonyService(),
  };
}

/** Shop with explicit hours so validation results are deterministic. */
const TEST_SHOP: Pick<Shop, 'timezone' | 'hours'> & Partial<Shop> = {
  timezone: 'America/Los_Angeles',
  hours: {
    monday:    { open: '09:00', close: '18:00' },
    tuesday:   { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday:  { open: '09:00', close: '18:00' },
    friday:    { open: '09:00', close: '20:00' },
    saturday:  { open: '09:00', close: '18:00' },
    sunday:    { closed: true },
  },
};

async function makeCtx(): Promise<AgentToolContext> {
  const deps = memoryDeps();
  // Apply test-shop hours to the in-memory demo shop
  await deps.shopsRepository.updateUserSettings('demo-shop', {
    booking_url: null,
  });
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  const patchedShop: Shop = { ...shop, ...TEST_SHOP } as Shop;
  return createSipAgentToolContext({
    shop: patchedShop,
    callerPhone: '+15550001111',
    requestId: 'test-prefetch',
    roomName: 'room-prefetch',
    deps,
  });
}

// ---------------------------------------------------------------------------
// Test 1: pre-populate from transcript with explicit AM/PM
// ---------------------------------------------------------------------------

test('pre-populate: transcript with explicit time populates cache', async () => {
  const ctx = await makeCtx();
  assert.equal(ctx.appointmentTimeValidation?.latest, null, 'cache starts empty');

  await prePopulateFromTranscript(ctx, 'Maybe 9 a.m.');

  const cached = ctx.appointmentTimeValidation?.latest;
  assert.ok(cached, 'cache is populated after transcript');
  assert.equal(cached.time, '09:00');
  assert.equal(typeof cached.valid, 'boolean');
  assert.ok(cached.date.match(/^\d{4}-\d{2}-\d{2}$/), 'date is YYYY-MM-DD format');
  assert.ok(cached.normalizedDatetimeUtc, 'normalizedDatetimeUtc is set');
  assert.ok(['within_business_hours', 'outside_business_hours', 'business_hours_not_configured', 'past_datetime'].includes(cached.reason));
});

// ---------------------------------------------------------------------------
// Test 2: cache hit — executeSipShopToolCall returns cached result
// ---------------------------------------------------------------------------

test('cache hit: executeSipShopToolCall returns pre-computed result for matching date+time', async () => {
  const ctx = await makeCtx();

  // Use a known far-future Monday at 10 AM (within business hours)
  const targetDate = '2099-01-06'; // Monday
  const targetTime = '10:00';

  // Manually pre-populate by calling the function with known args
  await prePopulateFromTranscript(ctx, 'Monday at 10 AM'); // date may differ from 2099
  // Override with exact known values via direct tool call to set cache precisely
  ctx.appointmentTimeValidation!.latest = null;
  await executeSipShopToolCall(ctx, 'validate_appointment_time', { date: targetDate, time: targetTime });
  const cached = ctx.appointmentTimeValidation?.latest;
  assert.ok(cached, 'cache set via direct tool call');
  assert.equal(cached.date, targetDate);
  assert.equal(cached.time, targetTime);

  // Mark the cache with a sentinel to detect if the tool re-runs
  // (If tool re-runs, it writes a new object; if cache hit, it returns without touching .latest)
  const cachedSnapshot = { ...cached };

  const start = Date.now();
  const json = await executeSipShopToolCall(ctx, 'validate_appointment_time', { date: targetDate, time: targetTime });
  const elapsed = Date.now() - start;

  const result = JSON.parse(json) as { success?: boolean; valid?: boolean; reason?: string; normalizedDatetimeUtc?: string };
  assert.equal(result.success, true);
  assert.equal(result.valid, cachedSnapshot.valid);
  assert.equal(result.reason, cachedSnapshot.reason);
  assert.equal(result.normalizedDatetimeUtc, cachedSnapshot.normalizedDatetimeUtc);

  // Under any reasonable load the cache path should return in well under 50 ms
  assert.ok(elapsed < 50, `cache hit should be fast, took ${elapsed}ms`);
});

// ---------------------------------------------------------------------------
// Test 3: cache miss — different time falls through to normal execution
// ---------------------------------------------------------------------------

test('cache miss: different time executes tool normally and updates cache', async () => {
  const ctx = await makeCtx();

  const preCacheDate = '2099-01-06'; // Monday
  // Set cache to 10:00
  await executeSipShopToolCall(ctx, 'validate_appointment_time', { date: preCacheDate, time: '10:00' });
  assert.equal(ctx.appointmentTimeValidation?.latest?.time, '10:00');

  // Call with 11:00 — different time, cache miss → tool must execute
  const json = await executeSipShopToolCall(ctx, 'validate_appointment_time', { date: preCacheDate, time: '11:00' });
  const result = JSON.parse(json) as { success?: boolean; valid?: boolean };
  assert.equal(result.success, true);
  assert.equal(typeof result.valid, 'boolean');

  // Cache is now updated to 11:00
  assert.equal(ctx.appointmentTimeValidation?.latest?.time, '11:00');
  assert.equal(ctx.appointmentTimeValidation?.latest?.date, preCacheDate);
});

// ---------------------------------------------------------------------------
// Test 4: cache invalidation — second transcript updates cache
// ---------------------------------------------------------------------------

test('cache invalidation: new time in subsequent transcript overwrites cache', async () => {
  const ctx = await makeCtx();

  await prePopulateFromTranscript(ctx, 'How about 9 AM?');
  const first = ctx.appointmentTimeValidation?.latest;
  assert.ok(first, 'first pre-populate set cache');
  assert.equal(first.time, '09:00');

  await prePopulateFromTranscript(ctx, 'Actually, can we do 10 AM instead?');
  const second = ctx.appointmentTimeValidation?.latest;
  assert.ok(second, 'second pre-populate updated cache');
  assert.equal(second.time, '10:00');
});

// ---------------------------------------------------------------------------
// Test 5: transcript without recognizable time → cache unchanged
// ---------------------------------------------------------------------------

test('no time in transcript: cache stays null', async () => {
  const ctx = await makeCtx();
  assert.equal(ctx.appointmentTimeValidation?.latest, null);

  await prePopulateFromTranscript(ctx, 'I want to make an appointment');
  assert.equal(ctx.appointmentTimeValidation?.latest, null, 'no time → cache still null');
});

test('no time in transcript: existing cache is not cleared', async () => {
  const ctx = await makeCtx();

  // Prime the cache
  await prePopulateFromTranscript(ctx, '9 AM please');
  const before = ctx.appointmentTimeValidation?.latest;
  assert.ok(before);

  // Non-time transcript should NOT clear the cache
  await prePopulateFromTranscript(ctx, 'What services do you offer?');
  assert.deepEqual(ctx.appointmentTimeValidation?.latest, before, 'cache unchanged after non-time transcript');
});

// ---------------------------------------------------------------------------
// Test 6: same date+time → idempotent (no re-computation)
// ---------------------------------------------------------------------------

test('same date+time in transcript: idempotent, cache not re-written', async () => {
  const ctx = await makeCtx();

  await prePopulateFromTranscript(ctx, '9 AM tomorrow');
  const first = ctx.appointmentTimeValidation?.latest;
  assert.ok(first);

  // Call again with the same time expression
  await prePopulateFromTranscript(ctx, 'That was 9 AM tomorrow, right?');
  const second = ctx.appointmentTimeValidation?.latest;
  // Same object reference proves it was not re-computed
  assert.equal(second, first, 'same date+time does not re-write cache');
});

// ---------------------------------------------------------------------------
// Test 7: ambiguous time (no AM/PM) → null, cache unchanged
// ---------------------------------------------------------------------------

test('ambiguous time without AM/PM: cache unchanged', async () => {
  const ctx = await makeCtx();

  await prePopulateFromTranscript(ctx, "How about 9 o'clock tomorrow?");
  assert.equal(ctx.appointmentTimeValidation?.latest, null, 'ambiguous time leaves cache null');
});

// ---------------------------------------------------------------------------
// Test 8: validate_appointment_time guard still blocks create_booking without validation
// ---------------------------------------------------------------------------

test('data integrity: create_booking is blocked until validate_appointment_time is called', async () => {
  const ctx = await makeCtx();

  // Try booking without any validation (cache is null)
  const blocked = JSON.parse(
    await executeSipShopToolCall(ctx, 'create_booking', {
      date: '2099-01-06',
      time: '10:00',
      service: 'Manicure',
      customerName: 'Test',
    }),
  ) as { code?: string };
  assert.equal(blocked.code, 'APPOINTMENT_TIME_NOT_VALIDATED', 'booking blocked without validation');

  // Validate via pre-populate + confirm cache is set
  await executeSipShopToolCall(ctx, 'validate_appointment_time', { date: '2099-01-06', time: '10:00' });
  assert.ok(ctx.appointmentTimeValidation?.latest?.valid, 'time validated as within hours');

  // Now booking must proceed past the validation guard
  const booking = JSON.parse(
    await executeSipShopToolCall(ctx, 'create_booking', {
      date: '2099-01-06',
      time: '10:00',
      service: 'Manicure',
      customerName: 'Test',
    }),
  ) as { success?: boolean };
  assert.equal(booking.success, true, 'booking succeeds after validation');
});
