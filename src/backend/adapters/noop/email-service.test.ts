import test from 'node:test';
import assert from 'node:assert/strict';

import { NoopEmailService } from '@/src/backend/adapters/noop/email-service';

test('NoopEmailService returns without provider message id', async () => {
  const service = new NoopEmailService();
  const result = await service.sendEmail({
    to: 'owner@example.com',
    subject: 'Test',
    category: 'welcome_signup',
    idempotencyKey: 'noop-test-key',
    shopId: 'shop-1',
  });
  assert.equal(result.providerMessageId, undefined);
});
