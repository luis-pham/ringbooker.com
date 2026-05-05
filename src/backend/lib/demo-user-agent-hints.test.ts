import test from 'node:test';
import assert from 'node:assert/strict';

import { parseDemoUserAgentHints } from '@/src/backend/lib/demo-user-agent-hints';

test('parseDemoUserAgentHints detects desktop Chrome and mobile Safari', () => {
  const chrome = parseDemoUserAgentHints(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );
  assert.equal(chrome.browser, 'Chrome');
  assert.equal(chrome.deviceType, 'desktop');

  const iphone = parseDemoUserAgentHints(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  );
  assert.equal(iphone.browser, 'Safari');
  assert.equal(iphone.deviceType, 'mobile');
});
