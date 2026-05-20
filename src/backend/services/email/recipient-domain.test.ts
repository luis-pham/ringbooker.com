import test from 'node:test';
import assert from 'node:assert/strict';

import { emailAddressDomain, emailRecipientDomain } from '@/src/backend/services/email/recipient-domain';

test('emailRecipientDomain returns domain without full address', () => {
  assert.equal(emailRecipientDomain('Owner@Example.COM'), 'example.com');
  assert.equal(emailRecipientDomain('invalid'), 'unknown');
});

test('emailAddressDomain parses angle-bracket from headers', () => {
  assert.equal(emailAddressDomain('RingBooker <notifications@send.ringbooker.com>'), 'send.ringbooker.com');
});
