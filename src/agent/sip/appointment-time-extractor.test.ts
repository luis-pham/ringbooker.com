import test from 'node:test';
import assert from 'node:assert/strict';

import { extractTime24, extractAppointmentDateTime } from '@/src/agent/sip/appointment-time-extractor';

// Fixed reference point: 2026-05-27 (Wednesday) at 08:00 AM PDT = 15:00 UTC
// Shop timezone: America/Los_Angeles
const LA_SHOP = { timezone: 'America/Los_Angeles' };
const REF_NOW = new Date('2026-05-27T15:00:00.000Z'); // 08:00 AM PDT

// ---------------------------------------------------------------------------
// extractTime24
// ---------------------------------------------------------------------------

test('extractTime24: basic AM', () => {
  assert.equal(extractTime24('Maybe 9 a.m.'), '09:00');
  assert.equal(extractTime24('9 AM'), '09:00');
  assert.equal(extractTime24('9 am'), '09:00');
});

test('extractTime24: basic PM', () => {
  assert.equal(extractTime24('2 PM'), '14:00');
  assert.equal(extractTime24('2 p.m.'), '14:00');
  assert.equal(extractTime24('2:30 PM'), '14:30');
});

test('extractTime24: nouns', () => {
  assert.equal(extractTime24('noon'), '12:00');
  assert.equal(extractTime24('midnight'), '00:00');
  assert.equal(extractTime24('at noon please'), '12:00');
});

test('extractTime24: 12-hour edge cases', () => {
  assert.equal(extractTime24('12 PM'), '12:00'); // noon via digit
  assert.equal(extractTime24('12 AM'), '00:00'); // midnight via digit
  assert.equal(extractTime24('12:30 PM'), '12:30');
  assert.equal(extractTime24('12:30 AM'), '00:30');
});

test('extractTime24: explicit o\'clock with period', () => {
  assert.equal(extractTime24("9 o'clock AM"), '09:00');
  assert.equal(extractTime24("2 o'clock PM"), '14:00');
});

test('extractTime24: ambiguous without AM/PM → null', () => {
  assert.equal(extractTime24("9 o'clock"), null);
  assert.equal(extractTime24('at 9'), null);
  assert.equal(extractTime24('around 10'), null);
  assert.equal(extractTime24('book for tomorrow'), null);
});

test('extractTime24: out-of-range hours → null', () => {
  assert.equal(extractTime24('13 AM'), null);
  assert.equal(extractTime24('0 PM'), null);
});

test('extractTime24: minutes preserved', () => {
  assert.equal(extractTime24('10:15 AM'), '10:15');
  assert.equal(extractTime24('3:45 pm'), '15:45');
  assert.equal(extractTime24('11:00 AM'), '11:00');
});

// ---------------------------------------------------------------------------
// extractAppointmentDateTime — date inference
// ---------------------------------------------------------------------------

test('extractAppointmentDateTime: future time today → today', () => {
  // REF_NOW = 08:00 AM PDT; "9 AM" is future → today 2026-05-27
  const r = extractAppointmentDateTime('Maybe 9 a.m.', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-27');
  assert.equal(r.time, '09:00');
});

test('extractAppointmentDateTime: past time today → tomorrow', () => {
  // REF_NOW = 08:00 AM PDT; "7 AM" already passed → tomorrow 2026-05-28
  const r = extractAppointmentDateTime('7 a.m.', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-28');
  assert.equal(r.time, '07:00');
});

test('extractAppointmentDateTime: "tomorrow at 9 AM"', () => {
  const r = extractAppointmentDateTime('tomorrow at 9 AM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-28'); // Thursday
  assert.equal(r.time, '09:00');
});

test('extractAppointmentDateTime: "day after tomorrow" beats "tomorrow"', () => {
  const r = extractAppointmentDateTime('day after tomorrow at 9 AM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-29'); // Friday
  assert.equal(r.time, '09:00');
});

test('extractAppointmentDateTime: "today at noon"', () => {
  const r = extractAppointmentDateTime('today at noon', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-27');
  assert.equal(r.time, '12:00');
});

test('extractAppointmentDateTime: next day-of-week (different from today)', () => {
  // REF_NOW is Wednesday; "Monday" → next Monday = 2026-06-01
  const r = extractAppointmentDateTime('Monday at 10 AM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-06-01');
  assert.equal(r.time, '10:00');
});

test('extractAppointmentDateTime: "next Monday" always at least 7 days away', () => {
  // REF_NOW is Wednesday; "next Monday" → Monday after next = 2026-06-08
  const r = extractAppointmentDateTime('next Monday at 2 PM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-06-08');
  assert.equal(r.time, '14:00');
});

test('extractAppointmentDateTime: Friday this week', () => {
  // REF_NOW is Wednesday; "Friday" → this Friday = 2026-05-29
  const r = extractAppointmentDateTime('How about Friday at 3 PM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-29');
  assert.equal(r.time, '15:00');
});

test('extractAppointmentDateTime: month + day', () => {
  const r = extractAppointmentDateTime('June 15th at 10 AM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-06-15');
  assert.equal(r.time, '10:00');
});

test('extractAppointmentDateTime: past month+day rolls to next year', () => {
  // Jan 5 is already past relative to May 2026 → 2027-01-05
  const r = extractAppointmentDateTime('January 5th at 9 AM', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2027-01-05');
  assert.equal(r.time, '09:00');
});

test('extractAppointmentDateTime: no time → null', () => {
  assert.equal(extractAppointmentDateTime('I want to book tomorrow', LA_SHOP, REF_NOW), null);
  assert.equal(extractAppointmentDateTime('What are your hours?', LA_SHOP, REF_NOW), null);
});

test('extractAppointmentDateTime: ambiguous time (no AM/PM) → null', () => {
  assert.equal(extractAppointmentDateTime('tomorrow at 9', LA_SHOP, REF_NOW), null);
  assert.equal(extractAppointmentDateTime("at 9 o'clock tomorrow", LA_SHOP, REF_NOW), null);
});

test('extractAppointmentDateTime: midnight', () => {
  const r = extractAppointmentDateTime('tomorrow at midnight', LA_SHOP, REF_NOW);
  assert.ok(r);
  assert.equal(r.date, '2026-05-28');
  assert.equal(r.time, '00:00');
});

test('extractAppointmentDateTime: Saturday next week when today is Saturday', () => {
  // Simulate: today is Saturday 2026-05-30 at 10 AM PDT
  const satNow = new Date('2026-05-30T17:00:00.000Z'); // 10 AM PDT
  const r = extractAppointmentDateTime('Saturday at 9 AM', LA_SHOP, satNow);
  assert.ok(r);
  // Same weekday = today is Saturday → push to next Saturday = 2026-06-06
  assert.equal(r.date, '2026-06-06');
  assert.equal(r.time, '09:00');
});
