import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateOwnerHandoffDestination } from './destination-policy';

const shop = {
  id: 'shop_handoff_policy',
  country_code: 'US',
  sms_owner_opted_in: true,
};

test('owner handoff destination policy allows verified US owner number', () => {
  const result = evaluateOwnerHandoffDestination({ shop, ownerPhone: '(415) 555-0100' });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.e164, '+14155550100');
});

test('owner handoff destination policy rejects unverified owner number', () => {
  const result = evaluateOwnerHandoffDestination({
    shop: { ...shop, sms_owner_opted_in: false },
    ownerPhone: '+14155550100',
  });
  assert.deepEqual(result, { ok: false, reason: 'unverified_owner_phone' });
});

test('owner handoff destination policy rejects premium and high-risk destinations', () => {
  assert.deepEqual(evaluateOwnerHandoffDestination({ shop, ownerPhone: '+19005550100' }), {
    ok: false,
    reason: 'premium_or_high_risk_destination',
  });
  assert.deepEqual(evaluateOwnerHandoffDestination({ shop, ownerPhone: '+18095550100' }), {
    ok: false,
    reason: 'premium_or_high_risk_destination',
  });
});

test('owner handoff destination policy rejects international destinations outside allowlist', () => {
  const result = evaluateOwnerHandoffDestination({ shop, ownerPhone: '+442071234567' });
  assert.deepEqual(result, { ok: false, reason: 'country_not_allowed' });
});
