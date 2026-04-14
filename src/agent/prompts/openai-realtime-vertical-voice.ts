import type { VoicePromptVertical } from './types';

/** OpenAI Realtime speech voice id per marketing vertical (inbound SIP accept, LiveKit native demo). */
export const OPENAI_REALTIME_VOICE_BY_VERTICAL: Record<VoicePromptVertical, string> = {
  'nail-salon': 'shimmer',
  'hair-salon': 'coral',
  'day-spa': 'sage',
  'med-spa': 'ash',
  'beauty-clinic': 'echo',
};

const KNOWN = new Set<string>(Object.keys(OPENAI_REALTIME_VOICE_BY_VERTICAL));

/** Resolved voice for a demo vertical slug, or undefined when slug is missing / unknown. */
export function openAiRealtimeVoiceForDemoVerticalSlug(slug: string | undefined | null): string | undefined {
  if (!slug || !KNOWN.has(slug)) return undefined;
  return OPENAI_REALTIME_VOICE_BY_VERTICAL[slug as VoicePromptVertical];
}

export function openAiRealtimeVoiceForVertical(vertical: VoicePromptVertical | undefined, fallback = 'alloy'): string {
  if (!vertical) return fallback;
  return OPENAI_REALTIME_VOICE_BY_VERTICAL[vertical] ?? fallback;
}
