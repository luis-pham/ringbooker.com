import test from 'node:test';
import assert from 'node:assert/strict';

import { isWithinBusinessHours, parseBusinessTimeMinutes, resolveShopTimeContext } from './business-hours';
import type { BusinessHours } from '@/src/backend/domain/types';

const TZ = 'America/New_York'; // UTC-4 during EDT (summer)

// Monday 2026-05-18 14:00 NY local  →  UTC 18:00
const MON_14_00_UTC = new Date('2026-05-18T18:00:00.000Z');
// Monday 2026-05-18 07:30 NY local  →  UTC 11:30
const MON_07_30_UTC = new Date('2026-05-18T11:30:00.000Z');
// Monday 2026-05-18 17:00 NY local  →  UTC 21:00  (at close boundary — exclusive)
const MON_17_00_UTC = new Date('2026-05-18T21:00:00.000Z');

function shop(hours: BusinessHours) {
  return { hours, timezone: TZ };
}

// ---------------------------------------------------------------------------
// isWithinBusinessHours — routing decision used by doFinalFallback
// "within hours" → fallback attempts transfer; "outside" → enqueue callback
// ---------------------------------------------------------------------------

test('isWithinBusinessHours: within open window returns true', () => {
  assert.equal(
    isWithinBusinessHours(shop({ monday: { open: '09:00', close: '17:00' } }), MON_14_00_UTC),
    true,
  );
});

test('isWithinBusinessHours: before open returns false', () => {
  assert.equal(
    isWithinBusinessHours(shop({ monday: { open: '09:00', close: '17:00' } }), MON_07_30_UTC),
    false,
  );
});

test('isWithinBusinessHours: at close boundary returns false (exclusive upper bound)', () => {
  assert.equal(
    isWithinBusinessHours(shop({ monday: { open: '09:00', close: '17:00' } }), MON_17_00_UTC),
    false,
  );
});

test('isWithinBusinessHours: closed day entry returns false', () => {
  assert.equal(
    isWithinBusinessHours(shop({ monday: { closed: true } }), MON_14_00_UTC),
    false,
  );
});

test('isWithinBusinessHours: day missing from hours map returns false', () => {
  assert.equal(
    isWithinBusinessHours(shop({ tuesday: { open: '09:00', close: '17:00' } }), MON_14_00_UTC),
    false,
  );
});

test('isWithinBusinessHours: empty hours map returns false', () => {
  assert.equal(isWithinBusinessHours(shop({}), MON_14_00_UTC), false);
});

// ---------------------------------------------------------------------------
// parseBusinessTimeMinutes
// ---------------------------------------------------------------------------

test('parseBusinessTimeMinutes: parses HH:MM correctly', () => {
  assert.equal(parseBusinessTimeMinutes('09:30', '08:00'), 9 * 60 + 30);
  assert.equal(parseBusinessTimeMinutes('17:00', '08:00'), 17 * 60);
  assert.equal(parseBusinessTimeMinutes('00:00', '08:00'), 0);
});

test('parseBusinessTimeMinutes: falls back to fallback string on null', () => {
  assert.equal(parseBusinessTimeMinutes(null, '10:00'), 10 * 60);
  assert.equal(parseBusinessTimeMinutes(undefined, '09:00'), 9 * 60);
});

test('parseBusinessTimeMinutes: falls back on malformed input', () => {
  assert.equal(parseBusinessTimeMinutes('9:30', '08:00'), 8 * 60);
  assert.equal(parseBusinessTimeMinutes('bad', '08:00'), 8 * 60);
  assert.equal(parseBusinessTimeMinutes('25:00', '08:00'), 8 * 60);
});

test('resolveShopTimeContext: formats today hours in natural AM/PM wording', () => {
  const context = resolveShopTimeContext(shop({ monday: { open: '09:00', close: '17:30' } }), MON_14_00_UTC);

  assert.equal(context.todayHours, '9 AM to 5:30 PM');
});
