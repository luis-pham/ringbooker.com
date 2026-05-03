import test from 'node:test';
import assert from 'node:assert/strict';

import { getDemoRequestConfirmationEmail } from '@/src/backend/services/email/templates/demo-request-confirmation';

test('subject is stable RingBooker demo copy', () => {
  const { subject } = getDemoRequestConfirmationEmail({ firstName: 'Jane' });
  assert.ok(subject.includes('RingBooker'));
  assert.ok(subject.includes('demo request'));
});

test('subject fallback when no name does not contain undefined', () => {
  const { subject } = getDemoRequestConfirmationEmail({ firstName: '' });
  assert.ok(!subject.includes('undefined'));
});

test('body contains demo URL', () => {
  const { text } = getDemoRequestConfirmationEmail({ firstName: 'Pat' });
  assert.ok(text.includes('ringbooker.com/demo'));
});

test('body contains reply address', () => {
  const { text } = getDemoRequestConfirmationEmail({ firstName: 'Pat' });
  assert.ok(text.includes('hello@ringbooker.com'));
});
