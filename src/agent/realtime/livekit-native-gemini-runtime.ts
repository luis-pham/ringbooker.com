import { LiveKitRealtimeRuntime } from '@/src/agent/realtime/livekit-gemini-runtime';
import type { StartInboundRealtimeParams, StartInboundRealtimeResult } from '@/src/agent/realtime/types';

export class LiveKitNativeGeminiRuntime extends LiveKitRealtimeRuntime {
  override async startInboundSession(params: StartInboundRealtimeParams): Promise<StartInboundRealtimeResult> {
    const result = await super.startInboundSession(params);
    if (!result.metadata) return result;
    return {
      ...result,
      metadata: {
        ...result.metadata,
        runtimeVariant: 'livekit_native_gemini',
      },
    };
  }
}
