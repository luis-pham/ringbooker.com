import test from 'node:test';
import assert from 'node:assert/strict';

import { SIP_SHOP_TOOLS, SIP_SHOP_TOOL_NAMES } from '@/src/agent/sip/sip-tool-definitions';

test('SIP_SHOP_TOOLS matches expected names and OpenAI function shape', () => {
  assert.equal(SIP_SHOP_TOOLS.length, SIP_SHOP_TOOL_NAMES.length);
  for (const tool of SIP_SHOP_TOOLS) {
    assert.equal(tool.type, 'function');
    assert.ok(typeof tool.name === 'string' && tool.name.length > 0);
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0);
    const params = tool.parameters as { type?: string };
    assert.equal(params.type, 'object');
  }
});
