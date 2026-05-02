import test from 'node:test';
import assert from 'node:assert/strict';

import { getSipShopToolsForOpenAiAccept, SIP_CORE_TOOL_NAMES } from '@/src/agent/sip/sip-tool-definitions';
import { resetEnvCacheForTests } from '@/src/backend/config/env';

test('SIP tools for openai_sip_direct use request_human_handoff (not transfer_to_user)', () => {
  resetEnvCacheForTests();
  process.env.VOICE_TRANSPORT = 'openai_sip_direct';

  const tools = getSipShopToolsForOpenAiAccept();
  assert.ok(tools.some((t) => t.name === 'request_human_handoff'));
  assert.ok(!tools.some((t) => t.name === 'transfer_to_user'));
  assert.equal(tools.length, SIP_CORE_TOOL_NAMES.length + 1);
  for (const tool of tools) {
    assert.equal(tool.type, 'function');
    assert.ok(typeof tool.name === 'string' && tool.name.length > 0);
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0);
    const params = tool.parameters as { type?: string };
    assert.equal(params.type, 'object');
  }

  delete process.env.VOICE_TRANSPORT;
  resetEnvCacheForTests();
});

test('SIP tools for livekit_media include transfer_to_user', () => {
  resetEnvCacheForTests();
  process.env.VOICE_TRANSPORT = 'livekit_media';

  const tools = getSipShopToolsForOpenAiAccept();
  assert.ok(tools.some((t) => t.name === 'transfer_to_user'));
  assert.ok(!tools.some((t) => t.name === 'request_human_handoff'));

  delete process.env.VOICE_TRANSPORT;
  resetEnvCacheForTests();
});
