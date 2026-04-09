import { withLogContext } from '@/src/backend/observability/logger';
import { parseRealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { runLiveKitRoomRuntime } from '@/src/agent/realtime/livekit-room-runtime';
import { createInboundAgentSession, type AgentToolName } from '@/src/agent/runtime/session';
import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import type { ToolError } from '@/src/backend/domain/types';

function decodePayloadFromEnv(): unknown {
  const encoded = process.env.RB_DISPATCH_PAYLOAD_BASE64;
  if (!encoded) return null;

  try {
    return JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
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
  }).catch(() => {
    // Best effort status callback: worker should not crash due to telemetry failure.
  });
}

async function main() {
  const parsed = parseRealtimeDispatchInput(decodePayloadFromEnv());
  if (!parsed) {
    throw new Error('invalid_or_missing_rb_dispatch_payload');
  }

  const log = withLogContext({
    requestId: parsed.requestId,
    callId: parsed.realtime.sessionId,
    provider: 'livekit',
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

  const toolNames: AgentToolName[] = [
    'check_availability',
    'create_booking',
    'reschedule_booking',
    'get_shop_info',
    'transfer_to_user',
    'schedule_callback',
  ];
  const isToolName = (value: string): value is AgentToolName => toolNames.includes(value as AgentToolName);
  const allowedTools =
    (parsed.realtime.metadata as { dispatchPayload?: { toolPolicy?: { allowedTools?: string[] } } } | undefined)?.dispatchPayload
      ?.toolPolicy?.allowedTools ?? null;
  const toolBlockMessage =
    (parsed.realtime.metadata as { dispatchPayload?: { toolPolicy?: { blockMessage?: string } } } | undefined)?.dispatchPayload
      ?.toolPolicy?.blockMessage ?? 'This live demo cannot perform live booking actions.';
  const seenTranscriptLines = new Set<string>();

  const persistTranscript = async (speaker: 'caller' | 'assistant', text: string) => {
    if (!shopId || !runtime.callLogsRepository) return;
    const cleaned = text.trim();
    if (!cleaned) return;
    const dedupeKey = `${speaker}:${cleaned}`;
    if (seenTranscriptLines.has(dedupeKey)) return;
    seenTranscriptLines.add(dedupeKey);
    await runtime.callLogsRepository.appendTranscriptByRequestId({
      shopId,
      requestId: parsed.requestId,
      speaker,
      text: cleaned,
      occurredAt: new Date(),
    });
  };

  const updateDemoLiveState = async (
    state:
      | 'preparing'
      | 'caller_speaking'
      | 'ai_agent_speaking'
      | 'thinking'
      | 'looking_up_info'
      | 'completed'
      | 'failed'
      | null,
  ) => {
    if (!shopId || !runtime.callLogsRepository) return;
    await runtime.callLogsRepository.updateDemoLiveStateByRequestId({
      shopId,
      requestId: parsed.requestId,
      state,
    });
  };

  await postDispatchStatus({
    requestId: parsed.requestId,
    roomName: parsed.roomName,
    sessionId: parsed.realtime.sessionId,
    shopId,
    status: 'received',
  });
  await updateDemoLiveState('preparing');

  // This entrypoint is intentionally process-isolated so production can swap in
  // a full LiveKit Agents JS runtime implementation without API-worker coupling.
  log.info(
    {
      roomName: parsed.roomName,
      mode: parsed.realtime.mode,
      transportProvider:
        (parsed.realtime.metadata as { dispatchPayload?: { transport?: { provider?: string } } })?.dispatchPayload?.transport
          ?.provider ?? 'unknown',
    },
    'agent_worker_entry_received_dispatch',
  );

  await postDispatchStatus({
    requestId: parsed.requestId,
    roomName: parsed.roomName,
    sessionId: parsed.realtime.sessionId,
    shopId,
    status: 'agent_joined',
  });

  if (parsed.realtime.mode !== 'livekit_realtime') {
    throw new Error(`unsupported_realtime_mode_for_worker_entry:${parsed.realtime.mode}`);
  }
  await runLiveKitRoomRuntime(parsed, {
    onUserTranscript: async (text) => {
      await updateDemoLiveState('caller_speaking');
      await persistTranscript('caller', text);
      if (!inboundSession) return;
      await inboundSession.prefetchFromUtterance(text);
      await updateDemoLiveState('thinking');
    },
    onAssistantTranscript: async (text) => {
      await updateDemoLiveState('ai_agent_speaking');
      await persistTranscript('assistant', text);
    },
    onToolCallStart: ({ name }) => {
      log.info({ toolName: name }, 'agent_tool_call_started');
      void updateDemoLiveState('looking_up_info');
    },
    onToolCall: async ({ name, args }) => {
      if (!inboundSession) {
        return {
          error: 'Shop not found for this destination number.',
          code: 'NOT_FOUND',
          retryable: false,
        } satisfies ToolError;
      }

      if (!isToolName(name)) {
        return {
          error: `Unknown tool: ${name}`,
          code: 'NOT_FOUND',
          retryable: false,
        } satisfies ToolError;
      }

      if (Array.isArray(allowedTools) && !allowedTools.includes(name)) {
        return {
          error: toolBlockMessage,
          code: 'RATE_LIMITED',
          retryable: false,
        } satisfies ToolError;
      }

      try {
        return await inboundSession.runTool(name, args);
      } finally {
        await updateDemoLiveState('thinking');
      }
    },
  });

  if (inboundSession) {
    log.info(
      {
        shopId: inboundSession.shop.id,
        ...inboundSession.getPrefetchMetrics(),
      },
      'agent_session_prefetch_metrics',
    );
  }

  if (shopId && runtime.callLogsRepository) {
    await updateDemoLiveState('completed');
    await runtime.callLogsRepository.updateTranscriptStatusByRequestId({
      shopId,
      requestId: parsed.requestId,
      status: 'completed',
    });
  }

  await postDispatchStatus({
    requestId: parsed.requestId,
    roomName: parsed.roomName,
    sessionId: parsed.realtime.sessionId,
    shopId,
    status: 'completed',
  });
}

main().catch((error) => {
  const log = withLogContext({
    provider: 'livekit',
  });
  const parsed = parseRealtimeDispatchInput(decodePayloadFromEnv());
  const runtime = getBackendRuntime();
  const failedShopId =
    (parsed?.realtime.metadata as { shopId?: string } | undefined)?.shopId ??
    (parsed?.realtime.metadata as { dispatchPayload?: { context?: { shopId?: string } } } | undefined)?.dispatchPayload?.context
      ?.shopId;
  if (parsed && failedShopId) {
    void runtime.callLogsRepository?.updateDemoLiveStateByRequestId({
      shopId: failedShopId,
      requestId: parsed.requestId,
      state: 'failed',
    });
    void runtime.callLogsRepository?.updateTranscriptStatusByRequestId({
      shopId: failedShopId,
      requestId: parsed.requestId,
      status: 'failed',
    });
  }
  log.error(
    {
      err: error,
    },
    'agent_worker_entry_failed',
  );
  void postDispatchStatus({
    requestId: process.env.RB_DISPATCH_REQUEST_ID ?? 'unknown',
    roomName: process.env.RB_DISPATCH_ROOM_NAME ?? 'unknown',
    sessionId: process.env.RB_DISPATCH_SESSION_ID ?? 'unknown',
    status: 'failed',
    error: error instanceof Error ? error.message : 'unknown_error',
  });
  process.exit(1);
});
