import {
  CALL_TYPE_PROMPT_PACKS,
  CORE_VOICE_PROMPT,
  DEMO_GUARDRAIL_PROMPT,
  UNIVERSAL_GUARDRAIL_PROMPT,
  VERTICAL_PROMPT_PACKS,
} from './generated-prompt-packs';
import {
  filterCoreVoicePromptForProductionPlan,
  filterVerticalPackForProductionPlan,
} from './production-plan-prompt-filter';
import { renderRuntimeBusinessConfig, STATIC_SERVICE_SCOPE_RULES } from './runtime-config';
import type { VoicePromptInput } from './types';
import { buildProductionLanguageRuntimeFields } from '@/src/backend/prompts/production-language-policy';

const MAX_PROMPT_CHARS = 18000;

const COMPOSITION_NOTE =
  'COMPOSITION NOTE: Core and guardrails first, then vertical, call-type, runtime. Safety and runtime facts win conflicts.';

const COMPACTED_MARKER = '\n\n[Prompt compacted to fit latency/context budget]';

export function composeVoicePrompt(input: VoicePromptInput): string {
  const verticalPack = VERTICAL_PROMPT_PACKS[input.vertical];
  const callTypePack = CALL_TYPE_PROMPT_PACKS[input.callType];

  let coreText = CORE_VOICE_PROMPT;
  let verticalText = verticalPack.content;
  let businessForRuntime = input.business;

  if (input.mode === 'production') {
    const planForFilter = input.shopPlan ?? 'starter';
    if (!input.shopPlan) {
      console.warn('[composeVoicePrompt] voice_prompt_production_missing_shop_plan');
      const safeLang = buildProductionLanguageRuntimeFields('starter', input.shopLanguages);
      const { languageOptions: _omitLang, productionLanguageDirective: _omitDirective, ...businessRest } =
        input.business;
      businessForRuntime = {
        ...businessRest,
        productionLanguageDirective: safeLang.productionLanguageDirective,
      };
    }

    coreText = filterCoreVoicePromptForProductionPlan(coreText, planForFilter, input.mode);
    verticalText = filterVerticalPackForProductionPlan(verticalText, {
      plan: planForFilter,
      mode: input.mode,
      languages: input.shopLanguages,
    });
  }

  const runtimeText = renderRuntimeBusinessConfig(businessForRuntime);

  const prefixSections = [
    coreText,
    UNIVERSAL_GUARDRAIL_PROMPT,
    input.mode === 'demo' ? DEMO_GUARDRAIL_PROMPT : null,
    verticalText,
    callTypePack.content,
    STATIC_SERVICE_SCOPE_RULES,
    COMPOSITION_NOTE,
  ];
  const prefix = prefixSections.filter(Boolean).join('\n\n---\n\n').trim();
  const separator = '\n\n---\n\n';
  const tail = runtimeText;
  const prompt = `${prefix}${separator}${tail}`.trim();
  if (prompt.length <= MAX_PROMPT_CHARS) return prompt;

  /** Keep the tail (runtime business facts); trim from the end of prefix packs only. */
  const tailBytes = tail.length + separator.length + COMPACTED_MARKER.length;
  const maxPrefix = MAX_PROMPT_CHARS - tailBytes;
  if (maxPrefix <= 0) {
    return `${tail.slice(0, MAX_PROMPT_CHARS - COMPACTED_MARKER.length)}${COMPACTED_MARKER}`.trim();
  }
  const trimmedPrefix = prefix.slice(0, maxPrefix).trimEnd();
  return `${trimmedPrefix}${COMPACTED_MARKER}${separator}${tail}`.trim();
}
