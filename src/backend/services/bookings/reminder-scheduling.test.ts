import test from 'node:test';
import assert from 'node:assert/strict';

import { canScheduleReminder } from './reminder-scheduling';

test('canScheduleReminder requires confirmed status, real future time, and non-link source', () => {
  const future = new Date(Date.now() + 48 * 60 * 60 * 1000);

  assert.equal(canScheduleReminder({ status: 'confirmed', bookingAt: future, source: 'ai' }), true);
  assert.equal(canScheduleReminder({ status: 'pending', bookingAt: future, source: 'ai' }), false);
  assert.equal(canScheduleReminder({ status: 'confirmed', bookingAt: null, source: 'ai' }), false);
  assert.equal(canScheduleReminder({ status: 'confirmed', bookingAt: new Date('invalid'), source: 'ai' }), false);
  assert.equal(canScheduleReminder({ status: 'confirmed', bookingAt: new Date(Date.now() - 1000), source: 'ai' }), false);
  assert.equal(canScheduleReminder({ status: 'confirmed', bookingAt: future, source: 'booking_link' }), false);
});
