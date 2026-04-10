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
  return fromMetadata ?? process.env.AGENT_VOICE_MODEL ?? 'gpt-realtime-mini';
}

function resolveOpenAIVoice(): string {
  return process.env.AGENT_OPENAI_VOICE?.trim() || 'alloy';
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
    await room.connect(livekitUrl, joinToken, { autoSubscribe: true, dynacast: false });
    const roomConnectedAtMs = Date.now();

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

    initializeLogger({ pretty: false, level: 'warn' });

    const openaiPlugin = await importOpenAIPlugin().catch((error) => {
      log.error({ err: error }, 'livekit_native_openai_plugin_load_failed');
      throw new Error('livekit_native_openai_plugin_missing');
    });

    const llm = new openaiPlugin.realtime.RealtimeModel({
      apiKey,
      model,
      voice: resolveOpenAIVoice(),
      instructions: compactSystemInstruction(input.systemPrompt),
      modalities: ['audio', 'text'],
      inputAudioFormat: 'pcm16',
      outputAudioFormat: 'pcm16',
      turnDetection,
    });

    const agent = new agentVoice.Agent({
      instructions: compactSystemInstruction(input.systemPrompt),
    });

    const session = new agentVoice.AgentSession({ llm });

    let firstUserSpeechAtMs: number | null = null;
    let firstModelAudioAtMs: number | null = null;

    session.on(agentVoice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
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

    room.on(RoomEvent.LocalTrackSubscribed, (track) => {
      log.info({ trackName: track.name, trackSid: track.sid }, 'livekit_native_openai_local_track_subscribed');
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

    let initialGreetingSent = false;
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind !== TrackKind.KIND_AUDIO || initialGreetingSent) return;
      initialGreetingSent = true;
      log.info({ participantIdentity: participant.identity }, 'livekit_native_openai_triggering_initial_greeting');
      setTimeout(() => {
        try {
          session.generateReply({
            userInput: 'System: The phone call has just connected. Please warmly greet the caller and introduce yourself.',
          });
        } catch (error) {
          log.error({ err: error }, 'livekit_native_openai_failed_to_trigger_initial_greeting');
        }
      }, 500);
    });

    await session.start({ agent, room });

    log.info({ roomName: input.roomName }, 'livekit_native_openai_session_started');

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
  } finally {
    await room.disconnect().catch(() => {});
  }
}
