export type RealtimeTransportProvider = 'mock' | 'livekit';
export type RealtimeVoiceProvider = 'none' | 'gemini_live' | 'openai_realtime';
export type RealtimeRuntimeMode = 'mock' | 'livekit_realtime';

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
  };
  toolPolicy?: {
    allowedTools?: string[];
    blockMessage?: string;
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
