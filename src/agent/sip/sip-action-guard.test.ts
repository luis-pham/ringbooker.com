import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createSipAgentToolContext,
  executeSipShopToolCall,
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

async function createCtx(options?: { bookingUrl?: string | null; callerPhone?: string | null }) {
  const deps = memoryDeps();
  if (options && 'bookingUrl' in options) {
    await deps.shopsRepository.updateUserSettings('demo-shop', { booking_url: options.bookingUrl ?? null });
  }
  const shop = await deps.shopsRepository.findById('demo-shop');
  assert.ok(shop);
  return createSipAgentToolContext({
    shop,
    callerPhone: options && 'callerPhone' in options ? options.callerPhone ?? '' : '+15550001111',
    requestId: `sip-action-guard-${Math.random().toString(16).slice(2)}`,
    roomName: 'sip-room-action-guard',
    deps,
  });
}

test('action guard blocks create_booking when booking draft is missing required fields', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(ctx, 'I want to book color tomorrow at nine AM.');

  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
  });
  const parsed = JSON.parse(json) as { code?: string; reason?: string; missingFields?: string[] };

  assert.equal(parsed.code, 'ACTION_GUARD_BLOCKED');
  assert.equal(parsed.reason, 'booking_required_fields_missing');
  assert.deepEqual(parsed.missingFields, ['callerName']);
  assert.equal(ctx.actionGuard?.lastBlockedAction?.toolName, 'create_booking');
  assert.equal(ctx.bookingDraft?.intentSource, 'tool_call');
});

test('action guard allows create_booking without collected phone when caller ID is present', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(
    ctx,
    'I want to book manicure June 1 at two PM. My name is Maya.',
  );

  const validation = JSON.parse(await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2026-06-01',
    time: '14:00',
  })) as { valid?: boolean };
  assert.equal(validation.valid, true);

  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Maya',
  });
  const parsed = JSON.parse(json) as { success?: boolean; bookingId?: string };

  assert.equal(parsed.success, true);
  assert.equal(typeof parsed.bookingId, 'string');
  assert.equal(ctx.callerPhone, '+15550001111');
});

test('action guard blocks create_booking when caller ID is unavailable and phone was not collected', async () => {
  const ctx = await createCtx({ bookingUrl: null, callerPhone: null });
  updateSipBookingDraftFromTranscript(
    ctx,
    'I want to book manicure June 1 at two PM. My name is Maya.',
  );

  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Maya',
  });
  const parsed = JSON.parse(json) as { code?: string; reason?: string; missingFields?: string[] };

  assert.equal(parsed.code, 'ACTION_GUARD_BLOCKED');
  assert.equal(parsed.reason, 'booking_required_fields_missing');
  assert.deepEqual(parsed.missingFields, ['phone']);
});

test('action guard requires explicit confirmation before using caller-provided phone digits', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(
    ctx,
    'I want to book manicure June 1 at two PM. My name is Maya. My number is five one two three four five six seven eight nine.',
  );

  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Maya',
  });
  const parsed = JSON.parse(json) as { code?: string; reason?: string; missingFields?: string[] };

  assert.equal(parsed.code, 'ACTION_GUARD_BLOCKED');
  assert.equal(parsed.reason, 'confirmation_required');
  assert.deepEqual(parsed.missingFields, ['phone']);
});

test('action guard allows create_booking after required fields and phone confirmation', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(
    ctx,
    'I want to book manicure June 1 at two PM. My name is Maya. My number is five one two three four five six seven eight nine.',
  );
  updateSipBookingDraftFromTranscript(ctx, "Yes, that's correct.");

  const validation = JSON.parse(await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2026-06-01',
    time: '14:00',
  })) as { valid?: boolean };
  assert.equal(validation.valid, true);

  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Maya',
  });
  const parsed = JSON.parse(json) as { success?: boolean; bookingId?: string };

  assert.equal(parsed.success, true);
  assert.equal(typeof parsed.bookingId, 'string');
  assert.equal(ctx.actionGuard?.createBookingCompleted, true);
  assert.equal(ctx.callerPhone, '+15123456789');
});

test('action guard does not overwrite caller ID from confirmed digits unless caller asked to use a new number', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(
    ctx,
    'I want to book manicure June 1 at two PM. My name is Maya. five one two three four five six seven eight nine.',
  );
  updateSipBookingDraftFromTranscript(ctx, "Yes, that's correct.");

  const validation = JSON.parse(await executeSipShopToolCall(ctx, 'validate_appointment_time', {
    date: '2026-06-01',
    time: '14:00',
  })) as { valid?: boolean };
  assert.equal(validation.valid, true);

  const json = await executeSipShopToolCall(ctx, 'create_booking', {
    date: '2026-06-01',
    time: '14:00',
    service: 'Manicure',
    customerName: 'Maya',
  });
  const parsed = JSON.parse(json) as { success?: boolean; bookingId?: string };

  assert.equal(parsed.success, true);
  assert.equal(typeof parsed.bookingId, 'string');
  assert.equal(ctx.callerPhone, '+15550001111');
});

test('action guard blocks send_booking_link when caller has not expressed booking intent', async () => {
  const ctx = await createCtx({ bookingUrl: 'https://booking.example/demo' });
  updateSipBookingDraftFromTranscript(ctx, 'What time do you close today?');

  const json = await executeSipShopToolCall(ctx, 'send_booking_link', {
    serviceInterest: 'appointment',
  });
  const parsed = JSON.parse(json) as { code?: string; reason?: string };

  assert.equal(parsed.code, 'ACTION_GUARD_BLOCKED');
  assert.equal(parsed.reason, 'booking_intent_required');
});

test('action guard allows end_call to close partial booking as other', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(ctx, 'I want to book color tomorrow at nine AM.');

  const json = await executeSipShopToolCall(ctx, 'end_call', { reason: 'other' });
  const parsed = JSON.parse(json) as { ok?: boolean };

  assert.equal(parsed.ok, true);
});

test('action guard allows end_call as link_sent even before booking link tool succeeds', async () => {
  const ctx = await createCtx({ bookingUrl: 'https://booking.example/demo' });
  updateSipBookingDraftFromTranscript(ctx, 'I want to book a manicure.');

  const earlyJson = await executeSipShopToolCall(ctx, 'end_call', { reason: 'link_sent' });
  const early = JSON.parse(earlyJson) as { ok?: boolean };
  assert.equal(early.ok, true);

  const linkJson = await executeSipShopToolCall(ctx, 'send_booking_link', {
    callerName: 'there',
    serviceInterest: 'manicure',
  });
  const linkResult = JSON.parse(linkJson) as { success?: boolean };
  assert.equal(linkResult.success, true);

  const allowedJson = await executeSipShopToolCall(ctx, 'end_call', { reason: 'link_sent' });
  const allowed = JSON.parse(allowedJson) as { ok?: boolean };
  assert.equal(allowed.ok, true);
});

test('action guard allows partial booking to close even before callback follow-up is recorded', async () => {
  const ctx = await createCtx({ bookingUrl: null });
  updateSipBookingDraftFromTranscript(ctx, 'I want to book color tomorrow at nine AM.');

  const earlyJson = await executeSipShopToolCall(ctx, 'end_call', { reason: 'callback_scheduled' });
  const early = JSON.parse(earlyJson) as { ok?: boolean };
  assert.equal(early.ok, true);

  const callbackJson = await executeSipShopToolCall(ctx, 'schedule_callback', {
    reason: 'Incomplete booking request: color tomorrow at 9 AM. Caller needs team follow-up.',
  });
  const callback = JSON.parse(callbackJson) as { success?: boolean; callbackJobId?: string };
  assert.equal(callback.success, true);
  assert.equal(typeof callback.callbackJobId, 'string');
  assert.equal(ctx.actionGuard?.callbackScheduled, true);

  const allowedJson = await executeSipShopToolCall(ctx, 'end_call', { reason: 'callback_scheduled' });
  const allowed = JSON.parse(allowedJson) as { ok?: boolean };
  assert.equal(allowed.ok, true);
});
