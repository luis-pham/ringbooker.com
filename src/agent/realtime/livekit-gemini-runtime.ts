import { createHash, randomUUID } from 'node:crypto';

import { SignJWT } from 'jose';

import { logger } from '@/src/backend/observability/logger';
import type {
  RealtimeAgentRuntime,
  RealtimeDispatchPayload,
  RealtimeSessionMetadata,
  StartInboundRealtimeParams,
  StartInboundRealtimeResult,
} from '@/src/agent/realtime/types';

type LiveKitGeminiRuntimeConfig = {
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  voiceProvider: 'gemini_live' | 'openai_realtime';
  voiceApiKeyConfigured: boolean;
  voiceModel: string;
};

function normalizeLiveKitHttpUrl(url: string): string {
  if (url.startsWith('wss://')) return `https://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `http://${url.slice('ws://'.length)}`;
  return url;
}

async function createLiveKitJoinToken(params: {
  apiKey: string;
  apiSecret: string;
  roomName: string;
  identity: string;
  ttlSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    video: {
      room: params.roomName,
      roomJoin: true,
    },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(params.apiKey)
    .setSubject(params.identity)
    .setIssuedAt(now)
    .setExpirationTime(now + (params.ttlSeconds ?? 60 * 60))
    .sign(new TextEncoder().encode(params.apiSecret));
}

async function createLiveKitServiceToken(params: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  ttlSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    video: {
      roomCreate: true,
      roomList: true,
      roomAdmin: true,
      canPublish: true,
      canSubscribe: true,
    },
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(params.apiKey)
    .setSubject(params.identity)
    .setIssuedAt(now)
    .setExpirationTime(now + (params.ttlSeconds ?? 10 * 60))
    .sign(new TextEncoder().encode(params.apiSecret));
}

async function twirpCall(params: {
  url: string;
  servicePath: string;
  accessToken: string;
  body: Record<string, unknown>;
}): Promise<{ ok: true; data: unknown } | { ok: false; status: number; bodyText: string }> {
  const response = await fetch(`${params.url}${params.servicePath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify(params.body),
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      bodyText: await response.text(),
    };
  }

  return {
    ok: true,
    data: await response.json().catch(() => ({})),
  };
}

function safeJsonStringify(input: unknown): string {
  try {
    return JSON.stringify(input);
  } catch {
    return '{}';
  }
}

function compactPrompt(prompt: string, maxLength = 2000): string {
  if (prompt.length <= maxLength) return prompt;
  return `${prompt.slice(0, maxLength)}...(truncated)`;
}

function isRoomAlreadyExistsError(status: number, bodyText: string): boolean {
  if (status !== 409 && status !== 400) return false;
  const text = bodyText.toLowerCase();
  return text.includes('already exists') || text.includes('room exists');
}

export class LiveKitRealtimeRuntime implements RealtimeAgentRuntime {
  constructor(private readonly config: LiveKitGeminiRuntimeConfig) {}

  async startInboundSession(params: StartInboundRealtimeParams): Promise<StartInboundRealtimeResult> {
    const roomHttpUrl = normalizeLiveKitHttpUrl(this.config.livekitUrl);
    const serviceIdentity = `rb-runtime-${params.shopId}-${params.requestId}`;
    const agentIdentity = `rb-agent-${params.shopId}-${params.requestId}`;
    const serviceToken = await createLiveKitServiceToken({
      apiKey: this.config.livekitApiKey,
      apiSecret: this.config.livekitApiSecret,
      identity: serviceIdentity,
    });
    const agentJoinToken = await createLiveKitJoinToken({
      apiKey: this.config.livekitApiKey,
      apiSecret: this.config.livekitApiSecret,
      roomName: params.roomName,
      identity: agentIdentity,
    });

    const systemPromptSha256 = createHash('sha256').update(params.systemPrompt).digest('hex');
    const roomMetadata = {
      requestId: params.requestId,
      shopId: params.shopId,
      destinationPhone: params.destinationPhone,
      callerPhone: params.callerPhone,
      systemPromptSha256,
      systemPromptPreview: compactPrompt(params.systemPrompt, 500),
    };

    const createRoom = await twirpCall({
      url: roomHttpUrl,
      servicePath: '/twirp/livekit.RoomService/CreateRoom',
      accessToken: serviceToken,
      body: {
        name: params.roomName,
        empty_timeout: 600,
        metadata: safeJsonStringify(roomMetadata),
      },
    });

    if (!createRoom.ok && !isRoomAlreadyExistsError(createRoom.status, createRoom.bodyText)) {
      logger.error(
        {
          status: createRoom.status,
          bodyText: createRoom.bodyText,
          requestId: params.requestId,
          shopId: params.shopId,
          provider: 'livekit',
        },
        'livekit_create_room_failed',
      );
      throw new Error(`livekit_create_room_failed:${createRoom.status}`);
    }

    // Keep metadata fresh even if room already existed.
    await twirpCall({
      url: roomHttpUrl,
      servicePath: '/twirp/livekit.RoomService/UpdateRoomMetadata',
      accessToken: serviceToken,
      body: {
        room: params.roomName,
        metadata: safeJsonStringify(roomMetadata),
      },
    });

    const dispatchPayload: RealtimeDispatchPayload = {
      transport: {
        provider: 'livekit',
        roomName: params.roomName,
        joinToken: agentJoinToken,
        agentIdentity,
      },
      llm: {
        provider: this.config.voiceProvider,
        model: this.config.voiceModel,
        apiKeyConfigured: this.config.voiceApiKeyConfigured,
      },
      context: {
        requestId: params.requestId,
        shopId: params.shopId,
        callerPhone: params.callerPhone,
        destinationPhone: params.destinationPhone,
        ...(params.shopPlan ? { shopPlan: params.shopPlan } : {}),
      },
    };

    logger.info(
      {
        requestId: params.requestId,
        shopId: params.shopId,
        roomName: params.roomName,
        provider: 'livekit',
      },
      'livekit_inbound_session_started',
    );

    const sessionId = `lk-${randomUUID()}`;
    const metadata: RealtimeSessionMetadata = {
      requestId: params.requestId,
      shopId: params.shopId,
      livekitRoomHttpUrl: roomHttpUrl,
      voiceProvider: this.config.voiceProvider,
      voiceApiConfigured: this.config.voiceApiKeyConfigured,
      dispatchPayload,
      systemPromptSha256,
    };

    if (!createRoom.ok && isRoomAlreadyExistsError(createRoom.status, createRoom.bodyText)) {
      metadata.roomAlreadyExisted = true;
    }

    return {
      mode: 'livekit_realtime',
      sessionId,
      roomName: params.roomName,
      status: 'started',
      metadata,
    };
  }
}

export class LiveKitGeminiRuntime extends LiveKitRealtimeRuntime {
  constructor(params: {
    livekitUrl: string;
    livekitApiKey: string;
    livekitApiSecret: string;
    googleAiApiKey: string;
    geminiModel: string;
  }) {
    super({
      livekitUrl: params.livekitUrl,
      livekitApiKey: params.livekitApiKey,
      livekitApiSecret: params.livekitApiSecret,
      voiceProvider: 'gemini_live',
      voiceApiKeyConfigured: Boolean(params.googleAiApiKey),
      voiceModel: params.geminiModel,
    });
  }
}
