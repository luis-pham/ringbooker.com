import test from 'node:test';
import assert from 'node:assert/strict';

import { __resetRateLimitMemoryStoreForTests, consumeRateLimit, getClientIp } from './rate-limit';

test('getClientIp ignores untrusted X-Forwarded-For', () => {
  const ip = getClientIp({
    get: (name) =>
      ({
        'x-rb-remote-addr': '198.51.100.10',
        'x-forwarded-for': '203.0.113.9',
      })[name.toLowerCase()],
  });
  assert.equal(ip, '198.51.100.10');
});

test('getClientIp uses X-Forwarded-For only from configured trusted proxy', () => {
  const previous = process.env.TRUSTED_PROXY_IPS;
  process.env.TRUSTED_PROXY_IPS = '198.51.100.10';
  try {
    const ip = getClientIp({
      get: (name) =>
        ({
          'x-rb-remote-addr': '198.51.100.10',
          'x-forwarded-for': '203.0.113.9, 198.51.100.10',
        })[name.toLowerCase()],
    });
    assert.equal(ip, '203.0.113.9');
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_PROXY_IPS;
    else process.env.TRUSTED_PROXY_IPS = previous;
  }
});

test('fake X-Forwarded-For values share one rate limit bucket without trusted proxy', async () => {
  __resetRateLimitMemoryStoreForTests();
  const policy = { name: 'xff_spoof_test', limit: 2, windowMs: 60_000 };
  const attempts = await Promise.all(
    ['203.0.113.1', '203.0.113.2', '203.0.113.3'].map((spoofed) => {
      const ip = getClientIp({
        get: (name) =>
          ({
            'x-rb-remote-addr': '198.51.100.10',
            'x-forwarded-for': spoofed,
          })[name.toLowerCase()],
      });
      return consumeRateLimit(policy, `ip:${ip}`);
    }),
  );
  assert.deepEqual(attempts.map((attempt) => attempt.ok), [true, true, false]);
});
