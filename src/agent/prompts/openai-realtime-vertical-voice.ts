import type { VoicePromptVertical } from './types';

export const OPENAI_REALTIME_DEFAULT_DEMO_VOICE = 'marin';

/** OpenAI Realtime speech voice id per marketing vertical (inbound SIP accept, LiveKit native demo). */
export const OPENAI_REALTIME_VOICE_BY_VERTICAL: Record<VoicePromptVertical, string> = {
  'nail-salon': 'coral',
  'hair-salon': 'marin',
  'day-spa': 'sage',
  'med-spa': 'cedar',
  'beauty-clinic': 'cedar',
};

const OPENAI_REALTIME_SUPPORTED_VOICES = new Set([
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'marin',
  'sage',
  'shimmer',
  'verse',
]);

const KNOWN = new Set<string>(Object.keys(OPENAI_REALTIME_VOICE_BY_VERTICAL));

export function normalizeOpenAiRealtimeVoice(
  voice: string | undefined | null,
  fallback = OPENAI_REALTIME_DEFAULT_DEMO_VOICE,
): string {
  const trimmed = voice?.trim();
  if (!trimmed) return fallback;
  return OPENAI_REALTIME_SUPPORTED_VOICES.has(trimmed) ? trimmed : fallback;
}

/** Resolved voice for a demo vertical slug, or marin when slug is missing / unknown. */
export function openAiRealtimeVoiceForDemoVerticalSlug(slug: string | undefined | null): string {
  if (!slug || !KNOWN.has(slug)) return OPENAI_REALTIME_DEFAULT_DEMO_VOICE;
  return normalizeOpenAiRealtimeVoice(OPENAI_REALTIME_VOICE_BY_VERTICAL[slug as VoicePromptVertical]);
}

export function openAiRealtimeVoiceForVertical(vertical: VoicePromptVertical | undefined, fallback = 'alloy'): string {
  if (!vertical) return fallback;
  return normalizeOpenAiRealtimeVoice(OPENAI_REALTIME_VOICE_BY_VERTICAL[vertical], fallback);
}
