import test from 'node:test';
import assert from 'node:assert/strict';

import { CORE_VOICE_PROMPT, VERTICAL_PROMPT_PACKS } from '@/src/agent/prompts/generated-prompt-packs';
import {
  filterCoreVoicePromptForNailDemo,
  filterCoreVoicePromptForProductionPlan,
  filterVerticalPackForNailDemo,
  filterVerticalPackForProductionPlan,
} from '@/src/agent/prompts/production-plan-prompt-filter';

test('Starter production replaces core multilingual auto-switch block', () => {
  const filtered = filterCoreVoicePromptForProductionPlan(CORE_VOICE_PROMPT, 'starter', 'production');
  assert.doesNotMatch(filtered, /Detect and match the caller[\u2019']s language automatically/);
  assert.match(filtered, /Keep spoken dialogue in English unless RUNTIME BUSINESS CONFIG LANGUAGE DIRECTIVE/);
  assert.match(filtered, /Treat accented English, slow speech, and noisy ASR fragments as English/);
});

test('Professional production keeps core English-default language policy', () => {
  const filtered = filterCoreVoicePromptForProductionPlan(CORE_VOICE_PROMPT, 'professional', 'production');
  assert.match(filtered, /Speak English by default/);
  assert.match(filtered, /Treat accented English, slow speech, and noisy ASR fragments as English/);
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

test('Nail demo language filter removes Vietnamese switching instructions', () => {
  const nail = VERTICAL_PROMPT_PACKS['nail-salon'].content;
  const core = filterCoreVoicePromptForNailDemo(CORE_VOICE_PROMPT, 'demo', 'nail-salon');
  const vertical = filterVerticalPackForNailDemo(nail, 'demo', 'nail-salon');

  assert.doesNotMatch(core, /Detect and match the caller[\u2019']s language automatically/);
  assert.match(core, /Keep spoken dialogue in English only/);
  assert.doesNotMatch(vertical, /\bVietnamese\b/);
  assert.doesNotMatch(vertical, /Dạ được/);
});
