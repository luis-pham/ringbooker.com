import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SHOP_TIMEZONE,
  formatShopDate,
  formatShopDateTime,
  formatShopTime,
  getShopLocalMonthPeriod,
  isWithinBusinessHours,
  normalizeShopTimezone,
} from '@/src/shared/timezone';

test('shop date/time formatting uses the explicit shop timezone', () => {
  const value = '2026-05-01T06:30:00.000Z';

  assert.equal(formatShopDate(value, 'America/Los_Angeles'), 'Apr 30, 2026');
  assert.equal(formatShopDate(value, 'America/New_York'), 'May 1, 2026');
  assert.equal(formatShopTime(value, 'America/Los_Angeles'), '11:30 PM');
  assert.equal(formatShopTime(value, 'America/New_York'), '2:30 AM');
  assert.notEqual(formatShopDateTime(value, 'America/Los_Angeles'), formatShopDateTime(value, 'America/New_York'));
});

test('shop timezone helpers fall back safely for missing or invalid timezone', () => {
  assert.equal(normalizeShopTimezone(null), DEFAULT_SHOP_TIMEZONE);
  assert.equal(normalizeShopTimezone('Not/AZone'), DEFAULT_SHOP_TIMEZONE);
  assert.equal(formatShopDate('bad-date', 'America/New_York'), 'Unknown');
});

test('shop-local month period converts local month boundaries to UTC', () => {
  const la = getShopLocalMonthPeriod(new Date('2026-05-01T06:30:00.000Z'), 'America/Los_Angeles');
  assert.equal(la.periodStart.toISOString(), '2026-04-01T07:00:00.000Z');
  assert.equal(la.periodEnd.toISOString(), '2026-05-01T07:00:00.000Z');

  const ny = getShopLocalMonthPeriod(new Date('2026-05-01T03:30:00.000Z'), 'America/New_York');
  assert.equal(ny.periodStart.toISOString(), '2026-04-01T04:00:00.000Z');
  assert.equal(ny.periodEnd.toISOString(), '2026-05-01T04:00:00.000Z');
});

test('shop-local month period handles DST offset changes', () => {
  const period = getShopLocalMonthPeriod(new Date('2026-03-15T12:00:00.000Z'), 'America/Los_Angeles');
  assert.equal(period.periodStart.toISOString(), '2026-03-01T08:00:00.000Z');
  assert.equal(period.periodEnd.toISOString(), '2026-04-01T07:00:00.000Z');
});

test('business hours are evaluated in the shop timezone including overnight hours', () => {
  assert.equal(
    isWithinBusinessHours('2026-05-01T16:00:00.000Z', { fri: { open: '09:00', close: '17:00' } }, 'America/Los_Angeles'),
    true,
  );
  assert.equal(
    isWithinBusinessHours('2026-05-02T06:30:00.000Z', { fri: { open: '22:00', close: '02:00' } }, 'America/Los_Angeles'),
    true,
  );
  assert.equal(
    isWithinBusinessHours('2026-05-02T08:30:00.000Z', { fri: { open: '22:00', close: '02:00' } }, 'America/Los_Angeles'),
    true,
  );
  assert.equal(
    isWithinBusinessHours('2026-05-02T10:00:00.000Z', { fri: { open: '22:00', close: '02:00' } }, 'America/Los_Angeles'),
    false,
  );
});
