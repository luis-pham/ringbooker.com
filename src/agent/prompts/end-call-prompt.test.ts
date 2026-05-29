import assert from 'node:assert/strict';
import test from 'node:test';

import { CALL_TYPE_PROMPT_PACKS, UNIVERSAL_GUARDRAIL_PROMPT } from './generated-prompt-packs';

test('universal guardrails require end_call on final goodbye paths', () => {
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /CALL COMPLETION:[\s\S]*call end_call immediately/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Do not say a final goodbye without calling end_call/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /SILENT CALLER[\s\S]*call end_call immediately/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /UNSUPPORTED LANGUAGE[\s\S]*call end_call immediately/);
});

test('universal guardrails forbid filler as a separate pre-tool turn', () => {
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Tools are silent/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /call the tool before speaking/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Never say "One moment"/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /After the tool result returns, give one concise final message/);
});

test('web demo prompt requires end_call after demo goodbye', () => {
  assert.match(CALL_TYPE_PROMPT_PACKS.demo_outbound.content, /Demo completion:[\s\S]*call end_call immediately/);
});
