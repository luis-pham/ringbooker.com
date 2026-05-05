import test from 'node:test';
import assert from 'node:assert/strict';

import { isSignupSyntheticPlaceholderPhone } from '@/lib/shop-phone-placeholder';

test('isSignupSyntheticPlaceholderPhone matches fictional 555-010 block only', () => {
  assert.equal(isSignupSyntheticPlaceholderPhone('+15550101234'), true);
  assert.equal(isSignupSyntheticPlaceholderPhone(' +15550109999 '), true);
  assert.equal(isSignupSyntheticPlaceholderPhone('+17145550123'), false);
  assert.equal(isSignupSyntheticPlaceholderPhone(null), false);
});
