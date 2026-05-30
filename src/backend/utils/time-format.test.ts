import test from 'node:test';
import assert from 'node:assert/strict';

import { formatHour } from './time-format';

test('formatHour: renders natural American time labels', () => {
  assert.equal(formatHour('09:00'), '9 AM');
  assert.equal(formatHour('14:15'), '2:15 PM');
  assert.equal(formatHour('12:00'), 'noon');
  assert.equal(formatHour('00:00'), 'midnight');
  assert.equal(formatHour('09:30'), '9:30 AM');
});
