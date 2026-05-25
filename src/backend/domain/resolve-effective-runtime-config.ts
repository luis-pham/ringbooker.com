import type { Shop } from '@/src/backend/domain/types';
import { isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';

export const DEFAULT_RUNTIME_AI_VOICE = 'Aoede';
export const DEFAULT_RUNTIME_CONVERSATIONAL_STYLE = 'Warm and polished.';

const RUNTIME_CONVERSATIONAL_STYLE_BY_VOICE: Record<string, string> = {
  Aoede: DEFAULT_RUNTIME_CONVERSATIONAL_STYLE,
  Puck: 'Fast and concise.',
  Charon: 'Confident and premium.',
};

export type EffectiveRuntimeConfig = {
  aiWelcomeMessage: string;
  aiVoice: string;
  aiConversationalStyle: string;
  aiCustomInstructions: string | null;
  staff: Shop['staff'];
};

export function buildDefaultRuntimeGreeting(businessName: string): string {
  return `Thank you for calling ${businessName}, how can I help you today?`;
}

export function buildProductionInitialGreetingInstructions(greeting: string): string {
  return [
    'When a caller connects, say exactly:',
    `"${greeting}"`,
    'Then wait. Do not say anything else until the caller speaks.',
  ].join('\n');
}

export function resolveRuntimeConversationalStyle(voice: string | null | undefined): string {
  return RUNTIME_CONVERSATIONAL_STYLE_BY_VOICE[voice?.trim() ?? ''] ?? DEFAULT_RUNTIME_CONVERSATIONAL_STYLE;
}

export function resolveEffectiveRuntimeConfig(shop: Shop): EffectiveRuntimeConfig {
  const aiVoice = isCapabilityAllowed(shop.plan, 'edit_ai_voice') && shop.ai_voice?.trim()
    ? shop.ai_voice.trim()
    : DEFAULT_RUNTIME_AI_VOICE;

  return {
    aiWelcomeMessage: isCapabilityAllowed(shop.plan, 'edit_ai_greeting') && shop.ai_welcome_message?.trim()
      ? shop.ai_welcome_message.trim()
      : buildDefaultRuntimeGreeting(shop.name),
    aiVoice,
    aiConversationalStyle: resolveRuntimeConversationalStyle(aiVoice),
    aiCustomInstructions:
      isCapabilityAllowed(shop.plan, 'edit_ai_custom_instructions') && shop.ai_custom_instructions?.trim()
        ? shop.ai_custom_instructions.trim()
        : null,
    staff: isCapabilityAllowed(shop.plan, 'provider_context') ? shop.staff : [],
  };
}
