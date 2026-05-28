export type RealtimeTransportProvider = 'mock' | 'livekit';
export type RealtimeVoiceProvider = 'none' | 'gemini_live' | 'openai_realtime';
export type RealtimeRuntimeMode = 'mock' | 'livekit_realtime';

import type { ShopPlan } from '@/src/backend/domain/types';

export interface RealtimeDispatchPayload {
  transport: {
    provider: RealtimeTransportProvider;
    roomName: string;
    joinToken?: string;
    agentIdentity?: string;
  };
  llm: {
    provider: RealtimeVoiceProvider;
    model: string;
    apiKeyConfigured: boolean;
  };
  context: {
    requestId: string;
    shopId: string;
    callerPhone: string;
    destinationPhone: string;
    /** When set, gates LiveKit/OpenAI transcription defaults (e.g. Vietnamese) on Starter. */
    shopPlan?: ShopPlan;
    /** Production language policy input for Realtime transcription hints. */
    shopLanguages?: string[];
  };
  toolPolicy?: {
    allowedTools?: string[];
    blockMessage?: string;
  };
  demo?: {
    isolated: boolean;
    source: string;
    vertical: string;
    mode: string;
  };
}

export interface RealtimeSessionMetadata extends Record<string, unknown> {
  requestId: string;
  shopId: string;
  dispatchPayload: RealtimeDispatchPayload;
}

export interface StartInboundRealtimeParams {
  requestId: string;
  roomName: string;
  shopId: string;
  destinationPhone: string;
  callerPhone: string;
  systemPrompt: string;
  shopPlan?: ShopPlan;
  shopLanguages?: string[];
}

export interface StartInboundRealtimeResult {
  mode: RealtimeRuntimeMode;
  sessionId: string;
  roomName: string;
  status: 'started' | 'simulated';
  metadata?: RealtimeSessionMetadata;
}

export interface RealtimeAgentRuntime {
  startInboundSession(params: StartInboundRealtimeParams): Promise<StartInboundRealtimeResult>;
}
