import test from 'node:test';
import assert from 'node:assert/strict';

import { maskEmail, maskPhone, sanitizeForLog } from '@/src/backend/security/pii';

test('maskEmail keeps domain and masks local part', () => {
  assert.equal(maskEmail('user@example.com'), 'u***@example.com');
});

test('maskPhone keeps only last 4 digits', () => {
  assert.equal(maskPhone('+1 (714) 555-0100'), '***0100');
});

test('sanitizeForLog masks nested email and phone fields', () => {
  const masked = sanitizeForLog({
    actorId: 'admin@example.com',
    details: {
      customerPhone: '+1 (714) 555-0100',
      nested: {
        userEmail: 'user@ringbooker.local',
      },
    },
  }) as {
    actorId: string;
    details: { customerPhone: string; nested: { userEmail: string } };
  };

  assert.equal(masked.actorId, 'a***@example.com');
  assert.equal(masked.details.customerPhone, '***0100');
  assert.equal(masked.details.nested.userEmail, 'u***@ringbooker.local');
});
