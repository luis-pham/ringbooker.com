import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIRECT_REALTIME_DEMO_DURATION_MESSAGE,
  userMessageForDirectDemoRealtimeJson,
} from '@/lib/marketing-vertical-demo-errors';

test('userMessageForDirectDemoRealtimeJson prefers server message', () => {
  const msg = userMessageForDirectDemoRealtimeJson(429, {
    ok: false,
    code: 'demo_rate_limited_burst',
    message: 'You started several demos very quickly. Please wait about a minute and try again.',
    retryAfterSeconds: 60,
  });
  assert.match(msg, /several demos very quickly/i);
});

test('userMessageForDirectDemoRealtimeJson falls back for 403', () => {
  const msg = userMessageForDirectDemoRealtimeJson(403, { ok: false });
  assert.match(msg, /Captcha/i);
});

test('duration copy matches backend contract', () => {
  assert.match(DIRECT_REALTIME_DEMO_DURATION_MESSAGE, /5-minute limit/i);
});
