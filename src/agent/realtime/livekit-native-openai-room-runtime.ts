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
    await runLiveKitNativeOpenAIConnectedRoomRuntime(input, room, {
      log,
      runtimeStartedAtMs,
      roomConnectedAtMs,
    });
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
  let initialGreetingSent = false;
  let outputReady = false;
  let pendingGreetingReason: string | null = null;
  let pendingGreetingParticipantIdentity: string | null = null;
  let firstUserSpeechAtMs: number | null = null;
  let firstModelAudioAtMs: number | null = null;

  const enqueueInitialGreeting = (reason: string, participantIdentity?: string | null) => {
    log.info(
      {
        roomName: input.roomName,
        reason,
        participantIdentity: participantIdentity ?? null,
      },
      'livekit_native_openai_triggering_initial_greeting',
    );
    setTimeout(() => {
      try {
        log.info(
          {
            roomName: input.roomName,
            reason,
            participantIdentity: participantIdentity ?? null,
          },
          'livekit_native_openai_initial_greeting_say_started',
        );
        const greetingHandle = session.generateReply({
          instructions:
            'The phone call has just connected. Immediately greet the caller in one short friendly sentence, introduce yourself as the booking assistant, then ask one short follow-up question about how you can help.',
        });
        log.info(
          {
            roomName: input.roomName,
            reason,
            participantIdentity: participantIdentity ?? null,
            speechHandleId: greetingHandle.id,
            },
            'livekit_native_openai_initial_greeting_reply_enqueued',
          );
        setTimeout(() => {
          if (firstModelAudioAtMs) return;
          log.warn(
            {
              roomName: input.roomName,
              reason,
              participantIdentity: participantIdentity ?? null,
              speechHandleId: greetingHandle.id,
              outputReady,
            },
            'livekit_native_openai_speech_handle_wait_timeout',
          );
        }, 2000);
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
        setTimeout(() => {
          if (firstModelAudioAtMs) return;
          log.warn(
            {
              roomName: input.roomName,
              reason,
              participantIdentity: participantIdentity ?? null,
            },
            'livekit_native_openai_initial_greeting_fallback_regenerate_reply',
          );
          try {
            const fallbackHandle = session.generateReply({
              instructions:
                'The phone call is already connected and the caller has not heard anything yet. Greet the caller right now in one short sentence and ask how you can help.',
            });
            log.info(
              {
                roomName: input.roomName,
                reason,
                participantIdentity: participantIdentity ?? null,
                speechHandleId: fallbackHandle.id,
              },
              'livekit_native_openai_initial_greeting_fallback_enqueued',
            );
          } catch (fallbackError) {
            log.error(
              {
                err: fallbackError,
                reason,
                participantIdentity: participantIdentity ?? null,
              },
              'livekit_native_openai_initial_greeting_fallback_failed',
            );
          }
        }, 1500);
      } catch (error) {
        log.error({ err: error, reason }, 'livekit_native_openai_failed_to_trigger_initial_greeting');
      }
    }, 500);
  };

  const triggerInitialGreeting = (reason: string, participantIdentity?: string | null) => {
    if (initialGreetingSent) return;
    if (!outputReady) {
      pendingGreetingReason = reason;
      pendingGreetingParticipantIdentity = participantIdentity ?? null;
      log.info(
        {
          roomName: input.roomName,
          reason,
          participantIdentity: participantIdentity ?? null,
        },
        'livekit_native_openai_initial_greeting_deferred_until_output_ready',
      );
      return;
    }

    initialGreetingSent = true;
    enqueueInitialGreeting(reason, participantIdentity);
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
      log.info({ participantIdentity: participant.identity }, 'livekit_native_openai_participant_connected');
    });

  room.on(RoomEvent.LocalTrackSubscribed, (track) => {
      log.info({ trackName: track.name, trackSid: track.sid }, 'livekit_native_openai_local_track_subscribed');
      if (track.name !== 'roomio_audio') return;
      outputReady = true;
      log.info(
        {
          roomName: input.roomName,
          trackName: track.name,
          trackSid: track.sid,
        },
        'livekit_native_openai_output_ready',
      );
      if (!initialGreetingSent && pendingGreetingReason) {
        const deferredReason = pendingGreetingReason;
        const deferredParticipantIdentity = pendingGreetingParticipantIdentity;
        pendingGreetingReason = null;
        pendingGreetingParticipantIdentity = null;
        initialGreetingSent = true;
        log.info(
          {
            roomName: input.roomName,
            reason: deferredReason,
            participantIdentity: deferredParticipantIdentity,
            trackName: track.name,
            trackSid: track.sid,
          },
          'livekit_native_openai_initial_greeting_released_after_output_ready',
        );
        enqueueInitialGreeting(deferredReason, deferredParticipantIdentity);
      }
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

  room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (participant.identity === room.localParticipant?.identity) return;
      log.info(
        {
          participantIdentity: participant.identity,
          trackKind: track.kind,
          trackSid: track.sid,
        },
        'livekit_native_openai_track_subscribed',
      );
      if (track.kind !== TrackKind.KIND_AUDIO) return;
      triggerInitialGreeting('track_subscribed', participant.identity);
    });

  await session.start({ agent, room });

  log.info({ roomName: input.roomName }, 'livekit_native_openai_session_started');

  for (const participant of room.remoteParticipants.values()) {
      if (participant.identity === room.localParticipant?.identity) continue;
      let hasAudioTrack = false;
      for (const publication of participant.trackPublications.values()) {
        if (publication.track?.kind === TrackKind.KIND_AUDIO) {
          hasAudioTrack = true;
          break;
        }
      }
      if (hasAudioTrack) {
        triggerInitialGreeting('post_start_existing_audio_track', participant.identity);
        break;
      }
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
