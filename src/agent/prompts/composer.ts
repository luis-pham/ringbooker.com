import {
  CALL_TYPE_PROMPT_PACKS,
  CORE_VOICE_PROMPT,
  DEMO_GUARDRAIL_PROMPT,
  UNIVERSAL_GUARDRAIL_PROMPT,
  VERTICAL_PROMPT_PACKS,
} from './generated-prompt-packs';
import { renderRuntimeBusinessConfig } from './runtime-config';
import type { VoicePromptInput } from './types';

const MAX_PROMPT_CHARS = 18000;

export function composeVoicePrompt(input: VoicePromptInput): string {
  const verticalPack = VERTICAL_PROMPT_PACKS[input.vertical];
  const callTypePack = CALL_TYPE_PROMPT_PACKS[input.callType];
  const sections = [
    CORE_VOICE_PROMPT,
    UNIVERSAL_GUARDRAIL_PROMPT,
    input.mode === 'demo' ? DEMO_GUARDRAIL_PROMPT : null,
    verticalPack.content,
    callTypePack.content,
    renderRuntimeBusinessConfig(input.business),
    'COMPOSITION NOTE: Follow the core and guardrail layers first, then the vertical tone, then the call-type workflow, then the runtime business data. If layers conflict, safety and runtime business facts win.',
  ];

  const prompt = sections.filter(Boolean).join('\n\n---\n\n').trim();
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
  return `${prompt.slice(0, MAX_PROMPT_CHARS)}\n\n[Prompt compacted to fit latency/context budget]`;
}
