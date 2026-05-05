import test from 'node:test';
import assert from 'node:assert/strict';

import { CORE_VOICE_PROMPT, VERTICAL_PROMPT_PACKS } from '@/src/agent/prompts/generated-prompt-packs';
import {
  filterCoreVoicePromptForProductionPlan,
  filterVerticalPackForProductionPlan,
} from '@/src/agent/prompts/production-plan-prompt-filter';

test('Starter production replaces core multilingual auto-switch block', () => {
  const filtered = filterCoreVoicePromptForProductionPlan(CORE_VOICE_PROMPT, 'starter', 'production');
  assert.doesNotMatch(filtered, /Detect and match the caller[\u2019']s language automatically/);
  assert.match(filtered, /Keep spoken dialogue in English unless RUNTIME BUSINESS CONFIG LANGUAGE DIRECTIVE/);
});

test('Professional production keeps core multilingual block', () => {
  const filtered = filterCoreVoicePromptForProductionPlan(CORE_VOICE_PROMPT, 'professional', 'production');
  assert.match(filtered, /Detect and match the caller[\u2019']s language automatically/);
});

test('Starter nail vertical strips bilingual / Vietnamese workflow lines', () => {
  const nail = VERTICAL_PROMPT_PACKS['nail-salon'].content;
  const filtered = filterVerticalPackForProductionPlan(nail, {
    plan: 'starter',
    mode: 'production',
    languages: ['en', 'vi'],
  });
  assert.doesNotMatch(filtered, /\bbilingual\b/i);
  assert.doesNotMatch(filtered, /\bVietnamese\b/);
});

test('Professional nail vertical with en/vi keeps Vietnamese workflow lines', () => {
  const nail = VERTICAL_PROMPT_PACKS['nail-salon'].content;
  const filtered = filterVerticalPackForProductionPlan(nail, {
    plan: 'professional',
    mode: 'production',
    languages: ['en', 'vi'],
  });
  assert.match(filtered, /\bVietnamese\b/);
  assert.match(filtered, /\bbilingual\b/i);
});

test('Demo mode leaves nail vertical unchanged', () => {
  const nail = VERTICAL_PROMPT_PACKS['nail-salon'].content;
  const filtered = filterVerticalPackForProductionPlan(nail, {
    plan: 'starter',
    mode: 'demo',
    languages: ['en', 'vi'],
  });
  assert.equal(filtered, nail);
});
