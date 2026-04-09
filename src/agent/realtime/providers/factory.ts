import type { CreateRealtimeVoiceBridgeParams, RealtimeVoiceBridge } from '@/src/agent/realtime/providers/types';
import { createGeminiLiveVoiceBridge } from '@/src/agent/realtime/providers/gemini-live-provider';
import { createOpenAIRealtimeVoiceBridge } from '@/src/agent/realtime/providers/openai-realtime-provider';
import type { RealtimeVoiceProvider } from '@/src/agent/realtime/types';

function resolveProviderFromDispatch(params: CreateRealtimeVoiceBridgeParams): RealtimeVoiceProvider {
  const fromDispatch =
    (params.dispatch.realtime.metadata as { dispatchPayload?: { llm?: { provider?: RealtimeVoiceProvider } } } | undefined)
      ?.dispatchPayload?.llm?.provider;
  if (fromDispatch) return fromDispatch;

  const envProvider = process.env.AGENT_VOICE_PROVIDER?.trim().toLowerCase();
  if (envProvider === 'gemini_live' || envProvider === 'openai_realtime' || envProvider === 'none') {
    return envProvider;
  }

  return process.env.AGENT_RUNTIME_MODE === 'livekit_gemini' ? 'gemini_live' : 'none';
}

export async function createRealtimeVoiceBridge(
  params: CreateRealtimeVoiceBridgeParams,
): Promise<RealtimeVoiceBridge | null> {
  const provider = resolveProviderFromDispatch(params);

  switch (provider) {
    case 'none':
      return null;
    case 'gemini_live':
      return await createGeminiLiveVoiceBridge(params);
    case 'openai_realtime':
      return await createOpenAIRealtimeVoiceBridge(params);
    default:
      throw new Error(`voice_provider_not_supported:${provider satisfies never}`);
  }
}
