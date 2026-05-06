import { AutoSubscribe, WorkerOptions, cli, defineAgent, type JobContext } from '@livekit/agents';
import { fileURLToPath } from 'node:url';

import { parseRealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { runLiveKitNativeOpenAIConnectedRoomRuntime } from '@/src/agent/realtime/livekit-native-openai-room-runtime';
import { createInboundAgentSession } from '@/src/agent/runtime/session';
import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import { getEnv } from '@/src/backend/config/env';
import { withLogContext } from '@/src/backend/observability/logger';

function resolveAgentName(): string {
  return process.env.AGENT_LIVEKIT_NATIVE_OPENAI_AGENT_NAME?.trim() || 'ringbooker-native-openai';
}

function decodeDispatchInputFromJob(ctx: JobContext) {
  try {
    return parseRealtimeDispatchInput(JSON.parse(ctx.job.metadata || '{}'));
  } catch {
    return null;
  }
}

async function postDispatchStatus(params: {
  requestId: string;
  roomName: string;
  sessionId: string;
  shopId?: string;
  status: 'received' | 'agent_joined' | 'completed' | 'failed';
  error?: string;
}) {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) return;

  const url = `${appBaseUrl}/api/backend/agent/dispatch/status`;
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AGENT_DISPATCH_AUTH_TOKEN ? { Authorization: `Bearer ${process.env.AGENT_DISPATCH_AUTH_TOKEN}` } : {}),
      ...(process.env.BACKEND_INTERNAL_API_KEY ? { 'x-backend-key': process.env.BACKEND_INTERNAL_API_KEY } : {}),
    },
    body: JSON.stringify({
      requestId: params.requestId,
      roomName: params.roomName,
      sessionId: params.sessionId,
      shopId: params.shopId,
      status: params.status,
      error: params.error,
      occurredAt: new Date().toISOString(),
    }),
  }).catch(() => {});
}

const agent = defineAgent({
  entry: async (ctx: JobContext) => {
    const parsed = decodeDispatchInputFromJob(ctx);
    if (!parsed) {
      throw new Error('invalid_livekit_native_openai_dispatch_metadata');
    }

    const log = withLogContext({
      requestId: parsed.requestId,
      callId: parsed.realtime.sessionId,
      provider: 'livekit_native_openai',
    });
    const shopId =
      (parsed.realtime.metadata as { shopId?: string } | undefined)?.shopId ??
      (parsed.realtime.metadata as { dispatchPayload?: { context?: { shopId?: string } } } | undefined)?.dispatchPayload?.context
        ?.shopId;

    const runtime = getBackendRuntime();
    const inboundSession = await createInboundAgentSession(
      {
        shopsRepository: runtime.shopsRepository,
        jobsRepository: runtime.jobsRepository,
        bookingsRepository: runtime.bookingsRepository,
        callbacksRepository: runtime.callbacksRepository,
        telephonyService: runtime.telephonyService,
        shopRoutingRulesRepository: runtime.shopRoutingRulesRepository,
        realtimeAgentRuntime: runtime.realtimeAgentRuntime,
      },
      {
        destinationPhone: parsed.destinationPhone,
        callerPhone: parsed.callerPhone,
        requestId: parsed.requestId,
        roomName: parsed.roomName,
      },
    );

    if (inboundSession) {
      void inboundSession.warmupCallStartContext().catch((error) => {
        log.warn(
          {
            err: error,
            shopId: inboundSession.shop.id,
          },
          'agent_call_start_warmup_failed',
        );
      });
    }

    await postDispatchStatus({
      requestId: parsed.requestId,
      roomName: parsed.roomName,
      sessionId: parsed.realtime.sessionId,
      shopId,
      status: 'received',
    });

    const runtimeStartedAtMs = Date.now();
    await ctx.connect(undefined, AutoSubscribe.SUBSCRIBE_ALL);
    const roomConnectedAtMs = Date.now();

    await postDispatchStatus({
      requestId: parsed.requestId,
      roomName: parsed.roomName,
      sessionId: parsed.realtime.sessionId,
      shopId,
      status: 'agent_joined',
    });

    try {
      await runLiveKitNativeOpenAIConnectedRoomRuntime(parsed, ctx.room, {
        log,
        runtimeStartedAtMs,
        roomConnectedAtMs,
      });

      await postDispatchStatus({
        requestId: parsed.requestId,
        roomName: parsed.roomName,
        sessionId: parsed.realtime.sessionId,
        shopId,
        status: 'completed',
      });
    } catch (error) {
      await postDispatchStatus({
        requestId: parsed.requestId,
        roomName: parsed.roomName,
        sessionId: parsed.realtime.sessionId,
        shopId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'unknown_native_openai_agent_error',
      });
      throw error;
    }
  },
});

export default agent;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const env = getEnv();
  cli.runApp(
    new WorkerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: resolveAgentName(),
      wsURL: env.LIVEKIT_URL,
      apiKey: env.LIVEKIT_API_KEY,
      apiSecret: env.LIVEKIT_API_SECRET,
    }),
  );
}
