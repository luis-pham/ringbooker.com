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

const COMPOSITION_NOTE =
  'COMPOSITION NOTE: Follow the core and guardrail layers first, then the vertical tone, then the call-type workflow, then the runtime business data. If layers conflict, safety and runtime business facts win.';

const COMPACTED_MARKER = '\n\n[Prompt compacted to fit latency/context budget]';

export function composeVoicePrompt(input: VoicePromptInput): string {
  const verticalPack = VERTICAL_PROMPT_PACKS[input.vertical];
  const callTypePack = CALL_TYPE_PROMPT_PACKS[input.callType];
  const runtimeText = renderRuntimeBusinessConfig(input.business);
  const prefixSections = [
    CORE_VOICE_PROMPT,
    UNIVERSAL_GUARDRAIL_PROMPT,
    input.mode === 'demo' ? DEMO_GUARDRAIL_PROMPT : null,
    verticalPack.content,
    callTypePack.content,
  ];
  const prefix = prefixSections.filter(Boolean).join('\n\n---\n\n').trim();
  const separator = '\n\n---\n\n';
  const tail = `${runtimeText}${separator}${COMPOSITION_NOTE}`;
  const prompt = `${prefix}${separator}${tail}`.trim();
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;

  /** Keep the tail (runtime facts + welcome + composition note); trim from the end of prefix packs only. */
  const tailBytes = tail.length + separator.length + COMPACTED_MARKER.length;
  const maxPrefix = MAX_PROMPT_CHARS - tailBytes;
  if (maxPrefix <= 0) {
    return `${tail.slice(0, MAX_PROMPT_CHARS - COMPACTED_MARKER.length)}${COMPACTED_MARKER}`.trim();
  }
  const trimmedPrefix = prefix.slice(0, maxPrefix).trimEnd();
  return `${trimmedPrefix}${COMPACTED_MARKER}${separator}${tail}`.trim();
}
