import test from 'node:test';
import assert from 'node:assert/strict';

import { resetEnvCacheForTests } from '@/src/backend/config/env';
import {
  DEMO_PARTNER_KEY_HEADER,
  isDemoPartnerOrigin,
  isPublicDemoPartnerCorsPath,
  parseDemoPartnerOrigins,
  verifyDemoPartnerKey,
} from '@/src/backend/demo/public-demo-partner';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

test('parseDemoPartnerOrigins accepts bare origins and ignores wildcard', () => {
  const origins = parseDemoPartnerOrigins(
    'https://upmysalon.com, https://staging.upmysalon.com, *, https://evil.example/path, not-a-url',
  );
  assert.deepEqual(origins, ['https://upmysalon.com', 'https://staging.upmysalon.com']);
});

test('parseDemoPartnerOrigins dedupes and trims trailing slash form', () => {
  const origins = parseDemoPartnerOrigins('https://upmysalon.com/,https://upmysalon.com');
  assert.deepEqual(origins, ['https://upmysalon.com']);
});

test('isDemoPartnerOrigin respects DEMO_PARTNER_ORIGINS env', () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    DEMO_PARTNER_ORIGINS: 'https://upmysalon.com,https://staging.upmysalon.com',
    DEMO_PARTNER_KEY: 'test-partner-key-please-rotate',
  });
  assert.equal(isDemoPartnerOrigin('https://upmysalon.com'), true);
  assert.equal(isDemoPartnerOrigin('https://staging.upmysalon.com'), true);
  assert.equal(isDemoPartnerOrigin('https://evil.example'), false);
  assert.equal(isDemoPartnerOrigin(null), false);
});

test('verifyDemoPartnerKey matches configured secret', () => {
  resetEnvCacheForTests();
  applyRequiredTestEnv({
    DEMO_PARTNER_KEY: 'test-partner-key-please-rotate',
  });
  assert.equal(verifyDemoPartnerKey('test-partner-key-please-rotate'), true);
  assert.equal(verifyDemoPartnerKey('wrong-key'), false);
  assert.equal(verifyDemoPartnerKey(null), false);
  assert.equal(DEMO_PARTNER_KEY_HEADER, 'X-Demo-Partner-Key');
});

test('isPublicDemoPartnerCorsPath covers realtime + helper demo endpoints', () => {
  assert.equal(isPublicDemoPartnerCorsPath('/public/demo/realtime-session'), true);
  assert.equal(
    isPublicDemoPartnerCorsPath('/api/backend/public/demo/realtime-session/release'),
    true,
  );
  assert.equal(isPublicDemoPartnerCorsPath('/public/demo/web-session'), false);
  assert.equal(isPublicDemoPartnerCorsPath('/public/demo/request'), false);
});
