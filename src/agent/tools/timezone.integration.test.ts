import test from 'node:test';
import assert from 'node:assert/strict';

import { shopLocalToUtcIso } from '@/src/agent/tools/types';

test('shopLocalToUtcIso converts shop local time to UTC correctly', () => {
  const utc = shopLocalToUtcIso({
    date: '2026-07-01',
    time: '09:30',
    timezone: 'America/Los_Angeles',
  });

  assert.equal(utc, '2026-07-01T16:30:00.000Z');
});

test('shopLocalToUtcIso returns null for invalid timezone', () => {
  const utc = shopLocalToUtcIso({
    date: '2026-07-01',
    time: '09:30',
    timezone: 'Invalid/Timezone',
  });

  assert.equal(utc, null);
});
