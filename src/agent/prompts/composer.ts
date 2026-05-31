import {
  CALL_TYPE_PROMPT_PACKS,
  CORE_VOICE_PROMPT,
  DEMO_GUARDRAIL_PROMPT,
  UNIVERSAL_GUARDRAIL_PROMPT,
  VERTICAL_PROMPT_PACKS,
} from './generated-prompt-packs';
import {
  filterCoreVoicePromptForNailDemo,
  filterCoreVoicePromptForProductionPlan,
  filterVerticalPackForNailDemo,
  filterVerticalPackForProductionPlan,
} from './production-plan-prompt-filter';
import {
  renderRuntimeEssentials,
  renderRuntimeOptional,
  STATIC_SERVICE_SCOPE_RULES,
} from './runtime-config';
import type { VoicePromptInput } from './types';
import { buildProductionLanguageRuntimeFields } from '@/src/backend/prompts/production-language-policy';

const MAX_PROMPT_CHARS = 24000;

const COMPOSITION_NOTE =
  'COMPOSITION NOTE: Core and guardrails first, then vertical, call-type, runtime. Safety and runtime facts win conflicts.';

export const VOICE_PROMPT_COMPACTED_MARKER = '\n\n[Prompt compacted to fit latency/context budget]';

const NAIL_DEMO_ENGLISH_ONLY_PROMPT =
  'NAIL DEMO LANGUAGE OVERRIDE: This nail salon demo must stay in English only. Do not switch to another language, and do not use non-English wording, even if another prompt section or the caller asks for it.';

function renderDemoGuardrailPrompt(input: VoicePromptInput): string | null {
  if (input.mode !== 'demo') return null;
  if (input.vertical !== 'nail-salon') return DEMO_GUARDRAIL_PROMPT;
  return DEMO_GUARDRAIL_PROMPT.replace(
    /Respond in the caller's language with one short warm line, then redirect:[\s\S]*?Decline first, redirect second, always\./,
    'Respond in English with one short warm line, then redirect: "That\'s a bit outside what I can help with here — anything about our services or scheduling?" Never answer first and redirect second, always.',
  );
}

type VoicePromptParts = {
  fullPrompt: string;
  promptWithoutOptional: string;
  optionalTail: string;
  prefixLen: number;
  essentialsLen: number;
};

export type VoicePromptComposeResult = {
  prompt: string;
  compacted: boolean;
  originalChars: number;
  finalChars: number;
  droppedSections: string[];
};

function buildVoicePromptParts(input: VoicePromptInput): VoicePromptParts {
  const verticalPack = VERTICAL_PROMPT_PACKS[input.vertical];
  const callTypePack = CALL_TYPE_PROMPT_PACKS[input.callType];
  const separator = '\n\n---\n\n';

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
  } else if (input.mode === 'demo' && input.vertical === 'nail-salon') {
    coreText = filterCoreVoicePromptForNailDemo(coreText, input.mode, input.vertical);
    verticalText = filterVerticalPackForNailDemo(verticalText, input.mode, input.vertical);
  }

  const usePreRenderedRuntime = businessForRuntime === input.business;
  const runtimeEssentials =
    usePreRenderedRuntime && input.runtimeEssentials !== undefined
      ? input.runtimeEssentials
      : renderRuntimeEssentials(businessForRuntime);
  const runtimeOptional =
    usePreRenderedRuntime && input.runtimeOptional !== undefined
      ? input.runtimeOptional
      : renderRuntimeOptional(businessForRuntime);

  const neverCutSections = [
    coreText,
    UNIVERSAL_GUARDRAIL_PROMPT,
    renderDemoGuardrailPrompt(input),
    input.mode === 'demo' && input.vertical === 'nail-salon' ? NAIL_DEMO_ENGLISH_ONLY_PROMPT : null,
    verticalText,
    callTypePack.content,
    COMPOSITION_NOTE,
  ];
  const prefix = neverCutSections.filter(Boolean).join(separator).trim();
  const alwaysKeepTail = [STATIC_SERVICE_SCOPE_RULES, runtimeEssentials].filter(Boolean).join(separator).trim();
  const optionalTail = runtimeOptional.trim();
  const fullTail = [alwaysKeepTail, optionalTail].filter(Boolean).join(separator).trim();
  const fullPrompt = [prefix, fullTail].filter(Boolean).join(separator).trim();
  const promptWithoutOptional = [prefix, alwaysKeepTail].filter(Boolean).join(separator).trim();

  return {
    fullPrompt,
    promptWithoutOptional,
    optionalTail,
    prefixLen: prefix.length,
    essentialsLen: alwaysKeepTail.length,
  };
}

export function composeVoicePromptWithMeta(input: VoicePromptInput): VoicePromptComposeResult {
  const parts = buildVoicePromptParts(input);
  const originalChars = parts.fullPrompt.length;

  if (originalChars <= MAX_PROMPT_CHARS) {
    return {
      prompt: parts.fullPrompt,
      compacted: false,
      originalChars,
      finalChars: originalChars,
      droppedSections: [],
    };
  }

  const droppedSections = parts.optionalTail.length > 0 ? ['runtime_optional'] : [];
  const prompt = `${parts.promptWithoutOptional}${VOICE_PROMPT_COMPACTED_MARKER}`.trim();

  if (parts.promptWithoutOptional.length > MAX_PROMPT_CHARS) {
    console.error('[composeVoicePrompt] prompt_exceeds_max_after_compaction', {
      prefixLen: parts.prefixLen,
      essentialsLen: parts.essentialsLen,
      total: parts.promptWithoutOptional.length,
      limit: MAX_PROMPT_CHARS,
    });
  }

  return {
    prompt,
    compacted: true,
    originalChars,
    finalChars: prompt.length,
    droppedSections,
  };
}

export function composeVoicePrompt(input: VoicePromptInput): string {
  return composeVoicePromptWithMeta(input).prompt;
}
