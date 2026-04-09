import { withLogContext } from '@/src/backend/observability/logger';
import { getEnv } from '@/src/backend/config/env';
import type { RealtimeSessionMetadata } from '@/src/agent/realtime/types';

type RealtimeDispatchJobPayload = {
  requestId: string;
  roomName: string;
  destinationPhone: string;
  callerPhone: string;
  systemPrompt: string;
  realtime: {
    mode: 'mock' | 'livekit_realtime';
    sessionId: string;
    roomName: string;
    status: 'started' | 'simulated';
    metadata?: Record<string, unknown>;
  };
};

function getMetadata(input: RealtimeDispatchJobPayload['realtime']): RealtimeSessionMetadata | null {
  if (!input.metadata) return null;
  const candidate = input.metadata as Partial<RealtimeSessionMetadata>;
  if (typeof candidate.requestId !== 'string') return null;
  if (typeof candidate.shopId !== 'string') return null;
  if (!candidate.dispatchPayload || typeof candidate.dispatchPayload !== 'object') return null;
  return candidate as RealtimeSessionMetadata;
}

export class RealtimeDispatchError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
    this.name = 'RealtimeDispatchError';
  }
}

export async function dispatchRealtimeSession(payload: RealtimeDispatchJobPayload): Promise<void> {
  const metadata = getMetadata(payload.realtime);
  if (!metadata) {
    throw new RealtimeDispatchError('missing_realtime_metadata', false);
  }

  const log = withLogContext({
    requestId: payload.requestId,
    shopId: metadata.shopId,
    provider: metadata.dispatchPayload.transport.provider,
  });

  if (metadata.dispatchPayload.transport.provider === 'mock') {
    const strictProduction = process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_PROD_RUNTIME !== 'true';
    if (strictProduction) {
      throw new RealtimeDispatchError('mock_realtime_dispatch_blocked_in_production', false);
    }
    log.info(
      {
        roomName: payload.roomName,
      },
      'realtime_dispatch_simulated',
    );
    return;
  }

  const env = getEnv();
  const dispatchUrl = env.AGENT_DISPATCH_WEBHOOK_URL ?? `${env.APP_BASE_URL}/api/backend/agent/dispatch`;

  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.AGENT_DISPATCH_AUTH_TOKEN ? { Authorization: `Bearer ${env.AGENT_DISPATCH_AUTH_TOKEN}` } : {}),
      ...(env.BACKEND_INTERNAL_API_KEY ? { 'x-backend-key': env.BACKEND_INTERNAL_API_KEY } : {}),
    },
    body: JSON.stringify({
      requestId: payload.requestId,
      roomName: payload.roomName,
      destinationPhone: payload.destinationPhone,
      callerPhone: payload.callerPhone,
      systemPrompt: payload.systemPrompt,
      realtime: payload.realtime,
      dispatchedAt: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    log.error(
      {
        status: response.status,
        bodyText,
      },
      'realtime_dispatch_webhook_failed',
    );
    throw new RealtimeDispatchError(`dispatch_webhook_failed:${response.status}`, response.status >= 500);
  }

  log.info({ roomName: payload.roomName }, 'realtime_dispatch_webhook_sent');
}
