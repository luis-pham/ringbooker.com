import { voice as agentVoice, initializeLogger } from '@livekit/agents';
import { Room, RoomEvent, TrackKind } from '@livekit/rtc-node';

import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { withLogContext } from '@/src/backend/observability/logger';
import { observeDurationMs } from '@/src/backend/observability/metrics';

function toWebsocketUrl(url: string): string {
  if (url.startsWith('wss://') || url.startsWith('ws://')) return url;
  if (url.startsWith('https://')) return `wss://${url.slice('https://'.length)}`;
  if (url.startsWith('http://')) return `ws://${url.slice('http://'.length)}`;
  return url;
}

function resolveLiveKitUrl(input: RealtimeDispatchInput): string {
  const fromMeta = (input.realtime.metadata as { livekitRoomHttpUrl?: string } | undefined)?.livekitRoomHttpUrl;
  return toWebsocketUrl(fromMeta ?? process.env.LIVEKIT_URL ?? '');
}

function resolveJoinToken(input: RealtimeDispatchInput): string | null {
  return (
    (
      input.realtime.metadata as
        | { dispatchPayload?: { transport?: { joinToken?: string } } }
        | undefined
    )?.dispatchPayload?.transport?.joinToken ?? null
  );
}

function compactSystemInstruction(raw: string): string {
  const compacted = raw.replace(/\s+/g, ' ').trim();
  const maxCharsRaw = Number(process.env.AGENT_OPENAI_SYSTEM_PROMPT_MAX_CHARS ?? 7000);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw >= 1000 ? maxCharsRaw : 7000;
  const constrainedPolicy =
    '\n\nHARD POLICY: Only use data from this call context and tool outputs. If out-of-scope, refuse briefly and offer callback or transfer.';
  if (compacted.length <= maxChars) return `${compacted}${constrainedPolicy}`;
  return `${compacted.slice(0, maxChars)}…${constrainedPolicy}`;
}

function resolveOpenAIModel(input: RealtimeDispatchInput): string | null {
  const fromMetadata = (input.realtime.metadata as { dispatchPayload?: { llm?: { model?: string } } } | undefined)
    ?.dispatchPayload?.llm?.model;
  return fromMetadata ?? process.env.AGENT_VOICE_MODEL ?? 'gpt-realtime';
}

function resolveOpenAIVoice(): string {
  return process.env.AGENT_OPENAI_VOICE?.trim() || 'marin';
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/** For debug logs only; avoid huge payloads in production unless AGENT_OPENAI_LOG_ALL_SERVER_EVENTS. */
function truncateForLog(value: unknown, maxLen: number): string {
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  } catch {
    return '[unserializable]';
  }
}

function resolveLiveKitAgentLogLevel(): 'debug' | 'info' | 'warn' | 'error' {
  const explicit = process.env.AGENT_LIVEKIT_LOG_LEVEL?.trim().toLowerCase();
  if (explicit === 'debug' || explicit === 'info' || explicit === 'warn' || explicit === 'error') {
    return explicit;
  }
  return parseBoolean(process.env.LK_OPENAI_DEBUG, false) ? 'debug' : 'warn';
}

function getSipCallStatus(participant: {
  attributes?: Record<string, string>;
  info?: { kind?: number };
}): string | null {
  return participant.attributes?.['sip.callStatus'] ?? null;
}

function isSipParticipant(participant: {
  attributes?: Record<string, string>;
  info?: { kind?: number };
}): boolean {
  return Boolean(participant.attributes?.['sip.callID'] || participant.attributes?.['sip.callStatus']);
}

function isAnsweredSipParticipant(participant: {
  attributes?: Record<string, string>;
  info?: { kind?: number };
}): boolean {
  return getSipCallStatus(participant) === 'active';
}

function importOpenAIPlugin(): Promise<{
  realtime: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RealtimeModel: new (options: any) => any;
  };
}> {
  return new Function("return import('@livekit/agents-plugin-openai')")() as Promise<{
    realtime: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      RealtimeModel: new (options: any) => any;
    };
  }>;
}

type RealtimeEventEmitter = {
  on?: (event: string, listener: (payload: unknown) => void) => void;
};

type RealtimeSessionLike = RealtimeEventEmitter & {
  updateInstructions?: (instructions: string) => Promise<unknown>;
  updateChatCtx?: (chatCtx: unknown) => Promise<unknown>;
  generateReply?: (instructions?: string) => Promise<unknown>;
};

function buildTurnDetectionConfig(): {
  type: 'semantic_vad';
  eagerness?: 'auto' | 'low' | 'medium' | 'high';
  create_response: boolean;
  interrupt_response: boolean;
} | {
  type: 'server_vad';
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  create_response: boolean;
  interrupt_response: boolean;
} | null {
  const enabled = parseBoolean(process.env.AGENT_OPENAI_SERVER_VAD_ENABLED, true);
  if (!enabled) return null;

  const mode = process.env.AGENT_OPENAI_TURN_DETECTION?.trim().toLowerCase() === 'server_vad'
    ? 'server_vad'
    : 'semantic_vad';
  const createResponse = parseBoolean(process.env.AGENT_OPENAI_CREATE_RESPONSE, true);
  const interruptResponse = parseBoolean(process.env.AGENT_OPENAI_INTERRUPT_RESPONSE, true);

  if (mode === 'server_vad') {
    return {
      type: 'server_vad',
      threshold: Math.max(0, Math.min(1, parseNumber(process.env.AGENT_OPENAI_VAD_THRESHOLD, 0.5))),
      prefix_padding_ms: Math.max(0, Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_PREFIX_MS, 300))),
      silence_duration_ms: Math.max(1, Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_SILENCE_MS, 200))),
      create_response: createResponse,
      interrupt_response: interruptResponse,
    };
  }

  const eagerness = process.env.AGENT_OPENAI_SEMANTIC_VAD_EAGERNESS?.trim().toLowerCase();
  const normalizedEagerness =
    eagerness === 'low' || eagerness === 'medium' || eagerness === 'high' || eagerness === 'auto'
      ? eagerness
      : 'medium';

  return {
    type: 'semantic_vad',
    eagerness: normalizedEagerness,
    create_response: createResponse,
    interrupt_response: interruptResponse,
  };
}

export async function runLiveKitNativeOpenAIRuntime(input: RealtimeDispatchInput): Promise<void> {
  const log = withLogContext({
    requestId: input.requestId,
    callId: input.realtime.sessionId,
    provider: 'livekit_native_openai',
  });

  const livekitUrl = resolveLiveKitUrl(input);
  const joinToken = resolveJoinToken(input);
  if (!livekitUrl) throw new Error('missing_livekit_url_for_native_openai_runtime');
  if (!joinToken) throw new Error('missing_join_token_for_native_openai_runtime');

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = resolveOpenAIModel(input);
  if (!apiKey || !model) throw new Error('missing_openai_api_key_or_model_for_native_runtime');
  const turnDetection = buildTurnDetectionConfig();

  const runtimeStartedAtMs = Date.now();
  const room = new Room();

  try {
    log.info({ roomName: input.roomName, livekitHost: new URL(livekitUrl).host }, 'livekit_native_openai_room_connect_started');
    const connectBeginMs = Date.now();
    await room.connect(livekitUrl, joinToken, { autoSubscribe: true, dynacast: false });
    const roomConnectedAtMs = Date.now();
    log.info(
      {
        roomName: input.roomName,
        connectDurationMs: roomConnectedAtMs - connectBeginMs,
        msSinceRuntimeStart: roomConnectedAtMs - runtimeStartedAtMs,
      },
      'livekit_native_openai_room_connect_succeeded',
    );
    await runLiveKitNativeOpenAIConnectedRoomRuntime(input, room, {
      log,
      runtimeStartedAtMs,
      roomConnectedAtMs,
    });
  } catch (error) {
    log.error(
      {
        err: error,
        roomName: input.roomName,
        livekitHost: (() => {
          try {
            return new URL(livekitUrl).host;
          } catch {
            return null;
          }
        })(),
      },
      'livekit_native_openai_room_runtime_failed',
    );
    throw error;
  } finally {
    await room.disconnect().catch(() => {});
  }
}

export async function runLiveKitNativeOpenAIConnectedRoomRuntime(
  input: RealtimeDispatchInput,
  room: Room,
  options?: {
    runtimeStartedAtMs?: number;
    roomConnectedAtMs?: number;
    log?: ReturnType<typeof withLogContext>;
  },
): Promise<void> {
  const log =
    options?.log ??
    withLogContext({
      requestId: input.requestId,
      callId: input.realtime.sessionId,
      provider: 'livekit_native_openai',
    });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = resolveOpenAIModel(input);
  if (!apiKey || !model) throw new Error('missing_openai_api_key_or_model_for_native_runtime');
  const turnDetection = buildTurnDetectionConfig();
  const runtimeStartedAtMs = options?.runtimeStartedAtMs ?? Date.now();
  const roomConnectedAtMs = options?.roomConnectedAtMs ?? Date.now();
  /** First OpenAI server event that indicates model audio stream (delta/done). */
  let firstOpenAiAudioStreamEventAtMs: number | null = null;

  observeDurationMs('realtime_worker_stage_ms', roomConnectedAtMs - runtimeStartedAtMs, {
    transport: 'livekit',
    voiceProvider: 'openai_realtime_native',
    stage: 'dispatch_to_room_connected',
  });

  log.info(
    {
      roomName: input.roomName,
      model,
      voice: resolveOpenAIVoice(),
      turnDetection,
    },
    'livekit_native_openai_room_connected',
  );

  initializeLogger({ pretty: false, level: resolveLiveKitAgentLogLevel() });

  const openaiPlugin = await importOpenAIPlugin().catch((error) => {
    log.error({ err: error }, 'livekit_native_openai_plugin_load_failed');
    throw new Error('livekit_native_openai_plugin_missing');
  });

  const llm = new openaiPlugin.realtime.RealtimeModel({
    apiKey,
    model,
    voice: resolveOpenAIVoice(),
    modalities: ['audio', 'text'],
    turnDetection,
  });

  const llmWithSessionFactory = llm as unknown as {
    session?: () => RealtimeEventEmitter;
  };
  const originalSessionFactory = llmWithSessionFactory.session?.bind(llm);
  if (originalSessionFactory) {
    llmWithSessionFactory.session = () => {
      log.info({ roomName: input.roomName }, 'livekit_native_openai_realtime_session_factory_called');
      const realtimeSession = originalSessionFactory();
      const realtimeSessionWithEvents = realtimeSession as RealtimeSessionLike;

      log.info({ roomName: input.roomName }, 'livekit_native_openai_realtime_session_created');

      const originalUpdateInstructions = realtimeSessionWithEvents.updateInstructions?.bind(realtimeSession);
      if (originalUpdateInstructions) {
        realtimeSessionWithEvents.updateInstructions = async (instructions: string) => {
          log.info(
            {
              roomName: input.roomName,
              instructionLength: instructions.length,
            },
            'livekit_native_openai_realtime_update_instructions_started',
          );
          try {
            const result = await originalUpdateInstructions(instructions);
            log.info({ roomName: input.roomName }, 'livekit_native_openai_realtime_update_instructions_finished');
            return result;
          } catch (error) {
            log.error(
              {
                err: error,
                roomName: input.roomName,
              },
              'livekit_native_openai_realtime_update_instructions_failed',
            );
            throw error;
          }
        };
      }

      const originalUpdateChatCtx = realtimeSessionWithEvents.updateChatCtx?.bind(realtimeSession);
      if (originalUpdateChatCtx) {
        realtimeSessionWithEvents.updateChatCtx = async (chatCtx: unknown) => {
          const itemCount = Array.isArray((chatCtx as { items?: unknown[] } | null | undefined)?.items)
            ? ((chatCtx as { items?: unknown[] }).items?.length ?? 0)
            : null;
          log.info(
            {
              roomName: input.roomName,
              itemCount,
            },
            'livekit_native_openai_realtime_update_chat_ctx_started',
          );
          try {
            const result = await originalUpdateChatCtx(chatCtx);
            log.info(
              {
                roomName: input.roomName,
                itemCount,
              },
              'livekit_native_openai_realtime_update_chat_ctx_finished',
            );
            return result;
          } catch (error) {
            log.error(
              {
                err: error,
                roomName: input.roomName,
                itemCount,
              },
              'livekit_native_openai_realtime_update_chat_ctx_failed',
            );
            throw error;
          }
        };
      }

      const originalGenerateReply = realtimeSessionWithEvents.generateReply?.bind(realtimeSession);
      if (originalGenerateReply) {
        realtimeSessionWithEvents.generateReply = async (instructions?: string) => {
          log.info(
            {
              roomName: input.roomName,
              hasInstructions: Boolean(instructions),
            },
            'livekit_native_openai_realtime_generate_reply_started',
          );
          try {
            const result = await originalGenerateReply(instructions);
            log.info(
              {
                roomName: input.roomName,
                hasInstructions: Boolean(instructions),
              },
              'livekit_native_openai_realtime_generate_reply_finished',
            );
            return result;
          } catch (error) {
            log.error(
              {
                err: error,
                roomName: input.roomName,
                hasInstructions: Boolean(instructions),
              },
              'livekit_native_openai_realtime_generate_reply_failed',
            );
            throw error;
          }
        };
      }

      realtimeSessionWithEvents.on?.('openai_client_event_queued', (payload: unknown) => {
        const event = payload as { type?: string; event_id?: string; response?: { instructions?: string } };
        if (!event?.type) return;
        if (
          event.type === 'session.update' ||
          event.type === 'response.create' ||
          event.type === 'input_audio_buffer.commit' ||
          event.type === 'input_audio_buffer.clear'
        ) {
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              eventId: event.event_id ?? null,
              hasInstructions:
                event.type === 'response.create' ? Boolean(event.response?.instructions) : undefined,
            },
            'livekit_native_openai_client_event_queued',
          );
        }
      });

      realtimeSessionWithEvents.on?.('openai_server_event_received', (payload: unknown) => {
        const event = payload as {
          type?: string;
          response_id?: string;
          item_id?: string;
          error?: { type?: string; code?: string; message?: string };
        };
        if (parseBoolean(process.env.AGENT_OPENAI_LOG_ALL_SERVER_EVENTS, false)) {
          log.info(
            {
              roomName: input.roomName,
              payload: truncateForLog(payload, 8000),
            },
            'livekit_native_openai_server_event_raw',
          );
        }
        if (!event?.type) {
          log.warn(
            { roomName: input.roomName, payload: truncateForLog(payload, 2000) },
            'livekit_native_openai_server_event_missing_type',
          );
          return;
        }

        const isAudioStreamEvent =
          event.type === 'response.output_audio.delta' ||
          event.type === 'response.output_audio.done' ||
          event.type === 'response.audio.delta' ||
          event.type === 'response.audio.done';
        if (isAudioStreamEvent && firstOpenAiAudioStreamEventAtMs === null) {
          firstOpenAiAudioStreamEventAtMs = Date.now();
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              msSinceRoomConnected: Date.now() - roomConnectedAtMs,
              msSinceRuntimeStart: Date.now() - runtimeStartedAtMs,
            },
            'livekit_native_openai_first_openai_audio_stream_event',
          );
        }

        const isDetailed =
          event.type === 'session.updated' ||
          event.type === 'response.created' ||
          event.type === 'response.done' ||
          event.type === 'response.output_item.added' ||
          event.type === 'conversation.item.added' ||
          event.type === 'conversation.item.created' ||
          event.type === 'conversation.item.input_audio_transcription.completed' ||
          event.type === 'conversation.item.input_audio_transcription.failed' ||
          event.type === 'response.output_audio.delta' ||
          event.type === 'response.output_audio.done' ||
          event.type === 'response.audio.delta' ||
          event.type === 'response.audio.done' ||
          event.type === 'input_audio_buffer.speech_started' ||
          event.type === 'input_audio_buffer.speech_stopped' ||
          event.type === 'error';

        if (isDetailed) {
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              responseId: event.response_id ?? null,
              itemId: event.item_id ?? null,
              error: event.error ?? null,
            },
            'livekit_native_openai_server_event_received',
          );
        } else if (event.error || event.type === 'error' || event.type.includes('error')) {
          log.error(
            {
              roomName: input.roomName,
              eventType: event.type,
              error: event.error ?? null,
              payload: truncateForLog(payload, 2000),
            },
            'livekit_native_openai_server_event_error_shape',
          );
        } else {
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
            },
            'livekit_native_openai_server_event_other',
          );
        }
      });

      realtimeSessionWithEvents.on?.('error', (payload: unknown) => {
        log.error({ err: payload, roomName: input.roomName }, 'livekit_native_openai_realtime_session_error');
      });

      log.info({ roomName: input.roomName }, 'livekit_native_openai_realtime_openai_hooks_attached');

      return realtimeSession;
    };
  }

  /** Realtime session is not fully wired during Agent.onEnter; greeting runs after session.start() resolves. */
  class NativeOpenAICallAgent extends agentVoice.Agent {
    constructor() {
      super({
        instructions: compactSystemInstruction(input.systemPrompt),
      });
    }
  }

  const initialGreetingInstructions =
    'Greet the caller now in one short friendly sentence, introduce yourself as the booking assistant, then ask one short follow-up question about how you can help.';

  const agent = new NativeOpenAICallAgent();

  const session = new agentVoice.AgentSession({ llm });
  let boundParticipantIdentity: string | null = null;
  let answeredParticipantIdentity: string | null = null;
  let firstUserSpeechAtMs: number | null = null;
  let firstModelAudioAtMs: number | null = null;

  const enqueueInitialGreetingAfterSessionReady = (): void => {
    const greetingHandle = session.generateReply({
      instructions: initialGreetingInstructions,
    });
    log.info(
      {
        roomName: input.roomName,
        speechHandleId: greetingHandle.id,
        placement: 'after_session_start',
      },
      'livekit_native_openai_initial_greeting_reply_enqueued',
    );
    greetingHandle.addDoneCallback((handle) => {
      log.info(
        {
          roomName: input.roomName,
          speechHandleId: handle.id,
          interrupted: handle.interrupted,
          done: handle.done(),
          chatItemCount: handle.chatItems.length,
        },
        'livekit_native_openai_initial_greeting_reply_done',
      );
    });
    const waitMs = Math.max(2000, Math.round(parseNumber(process.env.AGENT_OPENAI_GREETING_AUDIO_WAIT_MS, 8000)));
    setTimeout(() => {
      if (firstModelAudioAtMs) return;
      log.warn(
        {
          roomName: input.roomName,
          speechHandleId: greetingHandle.id,
          waitMs,
        },
        'livekit_native_openai_speech_handle_wait_timeout',
      );
    }, waitMs);
  };

  let resolveAnsweredParticipant!: (participantIdentity: string) => void;
  const answeredParticipantPromise = new Promise<string>((resolve) => {
    resolveAnsweredParticipant = resolve;
  });
  let answeredParticipantResolved = false;

  const markParticipantAnswered = (
    participant: {
      identity: string;
      attributes?: Record<string, string>;
      info?: { kind?: number };
    },
    source: string,
  ) => {
    if (!isAnsweredSipParticipant(participant)) return;
    answeredParticipantIdentity = participant.identity;
    if (!boundParticipantIdentity) {
      boundParticipantIdentity = participant.identity;
    }
    log.info(
      {
        roomName: input.roomName,
        participantIdentity: participant.identity,
        source,
        sipCallStatus: getSipCallStatus(participant),
      },
      'livekit_native_openai_call_answered',
    );
    if (!answeredParticipantResolved) {
      answeredParticipantResolved = true;
      resolveAnsweredParticipant(participant.identity);
    }
  };

  session.on(agentVoice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
      log.info(
        {
          roomName: input.roomName,
          transcript: ev.transcript ?? null,
          isFinal: ev.isFinal,
        },
        'livekit_native_openai_user_input_transcribed',
      );
      if (!ev.isFinal || !ev.transcript) return;
      const nowMs = Date.now();

      if (!firstUserSpeechAtMs) {
        firstUserSpeechAtMs = nowMs;
        log.info(
          {
            roomName: input.roomName,
            dispatchToFirstUserSpeechMs: nowMs - runtimeStartedAtMs,
            roomConnectedToFirstUserSpeechMs: nowMs - roomConnectedAtMs,
          },
          'livekit_native_openai_first_user_speech_detected',
        );
        observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
          transport: 'livekit',
          voiceProvider: 'openai_realtime_native',
          stage: 'dispatch_to_first_user_speech',
        });
      }
    });

  session.on(agentVoice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      log.info(
        {
          roomName: input.roomName,
          role: ev.item.role,
          itemId: 'id' in ev.item ? (ev.item as { id?: string }).id ?? null : null,
          text:
            'textContent' in ev.item && typeof (ev.item as { textContent?: string }).textContent === 'string'
              ? (ev.item as { textContent: string }).textContent.slice(0, 200)
              : null,
        },
        'livekit_native_openai_conversation_item_added',
      );
      if (ev.item.role !== 'assistant') return;
      const nowMs = Date.now();
      if (!firstModelAudioAtMs) {
        firstModelAudioAtMs = nowMs;
        log.info(
          {
            roomName: input.roomName,
            dispatchToFirstModelAudioMs: nowMs - runtimeStartedAtMs,
            roomConnectedToFirstModelAudioMs: nowMs - roomConnectedAtMs,
            firstUserSpeechToFirstModelAudioMs: firstUserSpeechAtMs ? nowMs - firstUserSpeechAtMs : null,
          },
          'livekit_native_openai_first_model_audio',
        );
        observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
          transport: 'livekit',
          voiceProvider: 'openai_realtime_native',
          stage: 'dispatch_to_first_model_audio',
        });
      }
    });

  session.on(agentVoice.AgentSessionEventTypes.Error, (ev) => {
    log.error({ err: ev.error }, 'livekit_native_openai_session_error');
  });

  session.on(agentVoice.AgentSessionEventTypes.SpeechCreated, (ev) => {
    log.info(
      {
        roomName: input.roomName,
        source: ev.source,
        userInitiated: ev.userInitiated,
        speechHandleId: ev.speechHandle.id,
      },
      'livekit_native_openai_speech_created',
    );
  });

  session.on(agentVoice.AgentSessionEventTypes.UserStateChanged, (ev) => {
    log.info(
      {
        roomName: input.roomName,
        oldState: ev.oldState,
        newState: ev.newState,
      },
      'livekit_native_openai_user_state_changed',
    );
  });

  session.on(agentVoice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
    log.info(
      {
        roomName: input.roomName,
        oldState: ev.oldState,
        newState: ev.newState,
      },
      'livekit_native_openai_agent_state_changed',
    );
  });

  session.on(agentVoice.AgentSessionEventTypes.OverlappingSpeech, (ev) => {
    log.warn(
      {
        roomName: input.roomName,
        detectedAt: ev.detectedAt,
        isInterruption: ev.isInterruption,
        totalDurationInS: ev.totalDurationInS,
        predictionDurationInS: ev.predictionDurationInS,
        probability: ev.probability,
        numRequests: ev.numRequests,
      },
      'livekit_native_openai_overlapping_speech',
    );
  });

  session.on(agentVoice.AgentSessionEventTypes.MetricsCollected, (ev) => {
    log.info(
      {
        roomName: input.roomName,
        metrics: ev.metrics,
      },
      'livekit_native_openai_metrics_collected',
    );
  });

  session.on(agentVoice.AgentSessionEventTypes.SessionUsageUpdated, (ev) => {
    log.info(
      {
        roomName: input.roomName,
        usage: ev.usage,
      },
      'livekit_native_openai_session_usage_updated',
    );
  });

  let resolveSessionClose!: () => void;
  const sessionClosePromise = new Promise<void>((resolve) => {
    resolveSessionClose = resolve;
  });

  session.once(agentVoice.AgentSessionEventTypes.Close, (ev) => {
      if (ev.error) {
        log.error({ err: ev.error, reason: ev.reason }, 'livekit_native_openai_session_closed_with_error');
      } else {
        log.info({ reason: ev.reason }, 'livekit_native_openai_session_closed');
      }
      resolveSessionClose();
    });

  room.once(RoomEvent.Disconnected, () => resolveSessionClose());

  room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.identity === room.localParticipant?.identity) return;
      log.info(
        {
          participantIdentity: participant.identity,
          participantKind: participant.info.kind,
          sipCallStatus: getSipCallStatus(participant),
        },
        'livekit_native_openai_participant_connected',
      );
      markParticipantAnswered(participant, 'participant_connected');
    });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      log.info(
        {
          roomName: input.roomName,
          participantIdentity: participant.identity,
          sipCallStatus: getSipCallStatus(participant),
          isLocal: participant.identity === room.localParticipant?.identity,
        },
        'livekit_native_openai_participant_disconnected',
      );
    });

  room.on(RoomEvent.ParticipantAttributesChanged, (changedAttributes, participant) => {
      if (participant.identity === room.localParticipant?.identity) return;
      log.info(
        {
          participantIdentity: participant.identity,
          changedAttributes,
          sipCallStatus: participant.attributes['sip.callStatus'] ?? null,
        },
        'livekit_native_openai_participant_attributes_changed',
      );
      if ('sip.callStatus' in changedAttributes) {
        markParticipantAnswered(participant, 'participant_attributes_changed');
      }
    });

  room.on(RoomEvent.LocalTrackSubscribed, (track) => {
      log.info({ trackName: track.name, trackSid: track.sid }, 'livekit_native_openai_local_track_subscribed');
      if (track.name !== 'roomio_audio') return;
      log.info(
        {
          roomName: input.roomName,
          trackName: track.name,
          trackSid: track.sid,
        },
        'livekit_native_openai_output_ready',
      );
    });

  const subscriptionForceResolveMs = 1500;
  room.on(RoomEvent.LocalTrackPublished, (publication) => {
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pub = publication as any;
        if (typeof pub.resolveFirstSubscription === 'function') {
          log.info({ trackName: publication.track?.name }, 'livekit_native_openai_force_resolving_track_subscription');
          pub.resolveFirstSubscription();
        }
      }, subscriptionForceResolveMs);
    });

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (participant.identity === room.localParticipant?.identity) return;
      log.info(
        {
          participantIdentity: participant.identity,
          participantKind: participant.info.kind,
          trackKind: track.kind,
          trackSid: track.sid,
          trackSource: publication.source,
        },
        'livekit_native_openai_track_subscribed',
      );
      if (track.kind !== TrackKind.KIND_AUDIO) return;
      if (!boundParticipantIdentity) {
        boundParticipantIdentity = participant.identity;
      }
    });

  for (const participant of room.remoteParticipants.values()) {
    if (participant.identity === room.localParticipant?.identity) continue;
    if (!boundParticipantIdentity) {
      boundParticipantIdentity = participant.identity;
    }
    if (isSipParticipant(participant)) {
      markParticipantAnswered(participant, 'existing_remote_participant');
    }
  }

  log.info({ roomName: input.roomName }, 'livekit_native_openai_waiting_for_call_answer');
  const answeredParticipantTimeoutMs = Math.max(
    5_000,
    Math.round(parseNumber(process.env.AGENT_LIVEKIT_OUTBOUND_ANSWER_TIMEOUT_MS, 45_000)),
  );
  const answeredIdentity = await Promise.race([
    answeredParticipantPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('livekit_native_openai_call_answer_timeout')), answeredParticipantTimeoutMs),
    ),
  ]);
  boundParticipantIdentity = answeredIdentity;

  log.info(
    {
      roomName: input.roomName,
      participantIdentity: boundParticipantIdentity,
    },
    'livekit_native_openai_binding_participant_identity',
  );

  const sessionStartBeginMs = Date.now();
  try {
    await session.start({
      agent,
      room,
      inputOptions: {
        participantIdentity: boundParticipantIdentity ?? undefined,
        closeOnDisconnect: true,
      },
    });
    log.info(
      {
        roomName: input.roomName,
        sessionStartDurationMs: Date.now() - sessionStartBeginMs,
      },
      'livekit_native_openai_session_started',
    );
    enqueueInitialGreetingAfterSessionReady();
  } catch (error) {
    log.error(
      {
        err: error,
        roomName: input.roomName,
        sessionStartDurationMs: Date.now() - sessionStartBeginMs,
      },
      'livekit_native_openai_session_start_failed',
    );
    throw error;
  }

  const timeoutMs = Number(process.env.AGENT_WORKER_MAX_SESSION_MS ?? 30 * 60 * 1000);
  const timeoutHandle = setTimeout(() => {
      log.warn({ timeoutMs, roomName: input.roomName }, 'livekit_native_openai_session_timeout');
      resolveSessionClose();
      void room.disconnect().catch(() => {});
    }, timeoutMs);

  try {
    await sessionClosePromise;
  } finally {
    clearTimeout(timeoutHandle);
  }

  log.info({ roomName: input.roomName }, 'livekit_native_openai_session_finished');
}
