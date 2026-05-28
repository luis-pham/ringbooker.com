import { randomUUID } from 'node:crypto';

import type {
  RealtimeAgentRuntime,
  RealtimeDispatchPayload,
  StartInboundRealtimeParams,
  StartInboundRealtimeResult,
} from '@/src/agent/realtime/types';

export class MockRealtimeAgentRuntime implements RealtimeAgentRuntime {
  async startInboundSession(params: StartInboundRealtimeParams): Promise<StartInboundRealtimeResult> {
    const dispatchPayload: RealtimeDispatchPayload = {
      transport: {
        provider: 'mock',
        roomName: params.roomName,
      },
      llm: {
        provider: 'none',
        model: 'mock-runtime',
        apiKeyConfigured: false,
      },
      context: {
        requestId: params.requestId,
        shopId: params.shopId,
        callerPhone: params.callerPhone,
        destinationPhone: params.destinationPhone,
        ...(params.shopPlan ? { shopPlan: params.shopPlan } : {}),
        ...(params.shopLanguages?.length ? { shopLanguages: params.shopLanguages } : {}),
      },
    };

    return {
      mode: 'mock',
      sessionId: `mock-${randomUUID()}`,
      roomName: params.roomName,
      status: 'simulated',
      metadata: {
        requestId: params.requestId,
        shopId: params.shopId,
        dispatchPayload,
      },
    };
  }
}
