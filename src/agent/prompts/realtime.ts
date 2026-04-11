import { RUNTIME_PROMPT_TEMPLATES } from './generated-prompt-packs';

const DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS = 18000;

export type RealtimePolicyKind = 'default' | 'native_openai';

function renderTemplate(template: string, values: Record<string, string | null | undefined>): string {
  return Object.entries(values).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value ?? ''),
    template,
  );
}

export function normalizePromptWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function compactRealtimeSystemInstruction(
  raw: string,
  options: {
    maxCharsRaw?: string | number | null;
    defaultMaxChars?: number;
    policyKind?: RealtimePolicyKind;
  } = {},
): string {
  const defaultMaxChars = options.defaultMaxChars ?? DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS;
  const parsedMaxChars = Number(options.maxCharsRaw ?? defaultMaxChars);
  const maxChars = Number.isFinite(parsedMaxChars) && parsedMaxChars >= 1000 ? parsedMaxChars : defaultMaxChars;
  const policy =
    options.policyKind === 'native_openai'
      ? RUNTIME_PROMPT_TEMPLATES.realtimeNativeOpenaiConstrainedPolicy
      : RUNTIME_PROMPT_TEMPLATES.realtimeConstrainedPolicy;
  const constrainedPolicy = `\n\n${policy}`;
  const compacted = normalizePromptWhitespace(raw);
  if (compacted.length <= maxChars) return `${compacted}${constrainedPolicy}`;
  return `${compacted.slice(0, maxChars)}…${constrainedPolicy}`;
}

export function getOpenAiVietnameseBookingTranscriptionPrompt(): string {
  return RUNTIME_PROMPT_TEMPLATES.openaiViBookingTranscription;
}

export function renderRealtimeGreetingInstructions(greeting: string): string {
  return renderTemplate(RUNTIME_PROMPT_TEMPLATES.realtimeGreetingResponseInstructions, { greeting });
}

export function renderFallbackGreeting(input: { businessName?: string | null; language: 'en' | 'vi' }): string {
  const businessName = input.businessName?.trim();
  if (input.language === 'vi') {
    return businessName
      ? renderTemplate(RUNTIME_PROMPT_TEMPLATES.fallbackGreetingViWithBusiness, { businessName })
      : RUNTIME_PROMPT_TEMPLATES.fallbackGreetingVi;
  }
  return businessName
    ? renderTemplate(RUNTIME_PROMPT_TEMPLATES.fallbackGreetingEnWithBusiness, { businessName })
    : RUNTIME_PROMPT_TEMPLATES.fallbackGreetingEn;
}

export function renderPublicDemoFallbackCustomInstructions(notes?: string | null): string {
  const rendered = renderTemplate(RUNTIME_PROMPT_TEMPLATES.publicDemoFallbackCustomInstructions, {
    notes: notes ? `Custom demo notes: ${notes}.` : '',
  });
  return rendered
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function renderProductionCustomInstructions(input: {
  voiceStyle?: string | null;
  shopCustomInstructions?: string | null;
}): string {
  const rendered = renderTemplate(RUNTIME_PROMPT_TEMPLATES.productionCustomInstructions, {
    voiceStyle: input.voiceStyle?.trim() || 'Aoede',
    shopCustomInstructions: input.shopCustomInstructions?.trim() ?? '',
  });
  return rendered
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}
