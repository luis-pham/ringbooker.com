import assert from 'node:assert/strict';
import test from 'node:test';

import { CALL_TYPE_PROMPT_PACKS, CORE_VOICE_PROMPT, UNIVERSAL_GUARDRAIL_PROMPT } from './generated-prompt-packs';

test('universal guardrails require end_call on final goodbye paths', () => {
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /\[END CALL TRIGGER -- HARD RULE\][\s\S]*Call end_call immediately after saying goodbye/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Do NOT continue the conversation after saying goodbye/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /do not respond -- call end_call immediately/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Never say "I'll end the call now" or "ending the call"/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /call end_call silently/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /SILENT CALLER[\s\S]*call end_call/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /UNSUPPORTED LANGUAGE[\s\S]*call end_call/);
});

test('universal guardrails forbid filler as a separate pre-tool turn', () => {
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Tools run silently/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /send_booking_link, create_booking/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /validate_appointment_time, check_availability/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Never split "one moment" and the result into separate turns/);
  assert.match(UNIVERSAL_GUARDRAIL_PROMPT, /Never output bracketed or narrated tool placeholders/);
});

test('core prompt does not encourage spoken filler before tools', () => {
  assert.match(CORE_VOICE_PROMPT, /Tools run silently/);
  assert.match(CORE_VOICE_PROMPT, /Filler phrases before answers are filtered by context/);
  assert.match(CORE_VOICE_PROMPT, /Say nothing before calling the tool/);
  assert.doesNotMatch(CORE_VOICE_PROMPT, /You may use one filler phrase per tool operation/);
});

test('web demo prompt requires end_call after demo goodbye', () => {
  assert.match(CALL_TYPE_PROMPT_PACKS.demo_outbound.content, /Demo completion:[\s\S]*call end_call immediately/);
});
