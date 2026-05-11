import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPhoneForDisplay, normalizePhoneForStorage, phoneComparableDigits } from './phone-number';

test('normalizes US website phones to E.164 for storage', () => {
  assert.equal(normalizePhoneForStorage('4694264308', 'Dallas, TX'), '+14694264308');
  assert.equal(normalizePhoneForStorage('469-426-4308', 'Dallas, TX'), '+14694264308');
  assert.equal(normalizePhoneForStorage('(469) 426-4308', 'Dallas, TX'), '+14694264308');
  assert.equal(normalizePhoneForStorage('+1 (469) 426-4308'), '+14694264308');
});

test('formats US E.164 phones for review UI', () => {
  assert.equal(formatPhoneForDisplay('+14694264308'), '469-426-4308');
  assert.equal(formatPhoneForDisplay('4694264308'), '469-426-4308');
});

test('compares US phone digits independent of country code formatting', () => {
  assert.equal(phoneComparableDigits('+1 (469) 426-4308'), phoneComparableDigits('469-426-4308'));
});
