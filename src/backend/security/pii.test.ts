import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeForLog } from './pii';

test('sanitizeForLog redacts secret-like fields and masks PII', () => {
  const sanitized = sanitizeForLog({
    email: 'owner@example.com',
    customerPhone: '+14155550100',
    client_secret: 'sk-secret',
    accessToken: 'token-value',
    nested: {
      authorization: 'Bearer secret',
      paddleSignature: 'ts=1;h1=abc',
    },
  }) as Record<string, unknown>;

  assert.equal(sanitized.email, 'o***@example.com');
  assert.equal(sanitized.customerPhone, '***0100');
  assert.equal(sanitized.client_secret, '[REDACTED]');
  assert.equal(sanitized.accessToken, '[REDACTED]');
  assert.deepEqual(sanitized.nested, {
    authorization: '[REDACTED]',
    paddleSignature: '[REDACTED]',
  });
});
