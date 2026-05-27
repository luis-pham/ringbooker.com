import {
  AudioFrame,
  AudioSource,
  AudioStream,
  LocalAudioTrack,
  Room,
  RoomEvent,
  TrackKind,
  TrackPublishOptions,
  TrackSource,
  type LocalTrackPublication,
  type RemoteTrack,
} from '@livekit/rtc-node';

import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { createRealtimeVoiceBridge } from '@/src/agent/realtime/providers/factory';
import { observeDurationMs } from '@/src/backend/observability/metrics';
import { withLogContext } from '@/src/backend/observability/logger';
import type { ToolError } from '@/src/backend/domain/types';

function toWebsocketUrl(input: string): string {
  if (input.startsWith('wss://') || input.startsWith('ws://')) return input;
  if (input.startsWith('https://')) return `wss://${input.slice('https://'.length)}`;
  if (input.startsWith('http://')) return `ws://${input.slice('http://'.length)}`;
  return input;
}

function resolveLiveKitUrl(input: RealtimeDispatchInput): string {
  const metadata = input.realtime.metadata as
    | {
        livekitRoomHttpUrl?: string;
      }
    | undefined;

  const fromMetadata = metadata?.livekitRoomHttpUrl;
  if (fromMetadata) return toWebsocketUrl(fromMetadata);
  return toWebsocketUrl(process.env.LIVEKIT_URL ?? '');
}

function resolveJoinToken(input: RealtimeDispatchInput): string | null {
  const metadata = input.realtime.metadata as
    | {
        dispatchPayload?: {
          transport?: {
            joinToken?: string;
          };
        };
      }
    | undefined;
  return metadata?.dispatchPayload?.transport?.joinToken ?? null;
}

async function waitForDisconnectOrTimeout(room: Room, timeoutMs: number): Promise<'disconnected' | 'timeout'> {
  return await new Promise<'disconnected' | 'timeout'>((resolve) => {
    let settled = false;
    const done = (value: 'disconnected' | 'timeout') => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    room.once(RoomEvent.Disconnected, () => {
      done('disconnected');
    });

    setTimeout(() => {
      done('timeout');
    }, timeoutMs);
  });
}

function resamplePcmLinear(input: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return input;
  if (fromRate <= 0 || toRate <= 0 || input.length === 0) return input;

  const ratio = toRate / fromRate;
  const outputLength = Math.max(1, Math.round(input.length * ratio));
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const srcPos = i / ratio;
    const srcIndex = Math.floor(srcPos);
    const srcNext = Math.min(srcIndex + 1, input.length - 1);
    const t = srcPos - srcIndex;
    const a = input[srcIndex] ?? 0;
    const b = input[srcNext] ?? a;
    output[i] = Math.max(-32768, Math.min(32767, Math.round(a + (b - a) * t)));
  }

  return output;
}

type StreamMetrics = {
  frames: number;
  samples: number;
  lastAtMs?: number;
  lastIntervalMs?: number;
  jitterAbsDiffSumMs: number;
  jitterSamples: number;
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function createStreamMetrics(): StreamMetrics {
  return {
    frames: 0,
    samples: 0,
    jitterAbsDiffSumMs: 0,
    jitterSamples: 0,
  };
}

function recordFrameMetrics(stream: StreamMetrics, nowMs: number, samples: number): void {
  stream.frames += 1;
  stream.samples += samples;
  if (stream.lastAtMs !== undefined) {
    const intervalMs = nowMs - stream.lastAtMs;
    if (stream.lastIntervalMs !== undefined) {
      stream.jitterAbsDiffSumMs += Math.abs(intervalMs - stream.lastIntervalMs);
      stream.jitterSamples += 1;
    }
    stream.lastIntervalMs = intervalMs;
  }
  stream.lastAtMs = nowMs;
}

function avgJitterMs(stream: StreamMetrics): number {
  if (stream.jitterSamples <= 0) return 0;
  return stream.jitterAbsDiffSumMs / stream.jitterSamples;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function resolveUplinkChunkMs(voiceProvider: string): number {
  const lowLatencyPreferred = parseBoolean(process.env.AGENT_REALTIME_LOW_LATENCY_PREFERRED, true);
  const defaultChunkMs = lowLatencyPreferred ? 20 : 40;
  const providerOverride =
    voiceProvider === 'openai_realtime'
      ? process.env.AGENT_OPENAI_UPLINK_CHUNK_MS
      : voiceProvider === 'gemini_live'
        ? process.env.AGENT_GEMINI_UPLINK_CHUNK_MS
        : undefined;
  const raw = Number(providerOverride ?? process.env.AGENT_REALTIME_UPLINK_CHUNK_MS ?? defaultChunkMs);
  if (!Number.isFinite(raw)) return defaultChunkMs;
  return Math.max(10, Math.min(120, raw));
}

function createUplinkAudioChunker(params: {
  sampleRate: number;
  targetChunkMs: number;
  onChunk: (pcm16: Int16Array, sampleRate: number) => void;
}) {
  const { sampleRate, targetChunkMs, onChunk } = params;
  const targetSamples = Math.max(1, Math.round((sampleRate * targetChunkMs) / 1000));
  let pending = new Int16Array(0);

  const emitChunk = (chunk: Int16Array) => {
    if (chunk.length <= 0) return;
    onChunk(chunk, sampleRate);
  };

  return {
    push(input: Int16Array) {
      if (input.length <= 0) return;
      const merged = new Int16Array(pending.length + input.length);
      merged.set(pending);
      merged.set(input, pending.length);
      pending = merged;

      while (pending.length >= targetSamples) {
        emitChunk(pending.slice(0, targetSamples));
        pending = pending.slice(targetSamples);
      }
    },
    flush() {
      if (pending.length <= 0) return;
      emitChunk(pending);
      pending = new Int16Array(0);
    },
  };
}

function createPcmChunkBuffer(params: { sampleRate: number; targetChunkMs: number }) {
  const { sampleRate, targetChunkMs } = params;
  const targetSamples = Math.max(1, Math.round((sampleRate * targetChunkMs) / 1000));
  let pending = new Int16Array(0);

  return {
    push(input: Int16Array): Int16Array[] {
      if (input.length <= 0) return [];
      const merged = new Int16Array(pending.length + input.length);
      merged.set(pending);
      merged.set(input, pending.length);
      pending = merged;

      const chunks: Int16Array[] = [];
      while (pending.length >= targetSamples) {
        chunks.push(pending.slice(0, targetSamples));
        pending = pending.slice(targetSamples);
      }
      return chunks;
    },
    flush(): Int16Array[] {
      if (pending.length <= 0) return [];
      const chunks = [pending];
      pending = new Int16Array(0);
      return chunks;
    },
  };
}

function resolveDownlinkChunkMs(voiceProvider: string): number {
  const lowLatencyPreferred = parseBoolean(process.env.AGENT_REALTIME_LOW_LATENCY_PREFERRED, true);
  const defaultChunkMs = lowLatencyPreferred ? 20 : 40;
  const providerOverride =
    voiceProvider === 'openai_realtime'
      ? process.env.AGENT_OPENAI_DOWNLINK_CHUNK_MS
      : voiceProvider === 'gemini_live'
        ? process.env.AGENT_GEMINI_DOWNLINK_CHUNK_MS
        : undefined;
  const raw = Number(providerOverride ?? process.env.AGENT_REALTIME_DOWNLINK_CHUNK_MS ?? defaultChunkMs);
  if (!Number.isFinite(raw)) return defaultChunkMs;
  return Math.max(10, Math.min(120, raw));
}

function toMonoPcm(frame: AudioFrame): Int16Array {
  const channels = Math.max(1, frame.channels);
  if (channels === 1) return frame.data;

  const samplesPerChannel = frame.samplesPerChannel;
  const mono = new Int16Array(samplesPerChannel);
  for (let sampleIndex = 0; sampleIndex < samplesPerChannel; sampleIndex += 1) {
    let accumulator = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      accumulator += frame.data[sampleIndex * channels + channel] ?? 0;
    }
    mono[sampleIndex] = Math.max(-32768, Math.min(32767, Math.trunc(accumulator / channels)));
  }
  return mono;
}

function buildToolStatusMessage(toolName: string): string {
  switch (toolName) {
    case 'validate_appointment_time':
      return '';
    case 'check_availability':
      return 'Checking availability now.';
    case 'create_booking':
      return 'Finalizing your booking now.';
    case 'reschedule_booking':
      return 'Checking the new appointment time now.';
    case 'transfer_to_user':
      return 'Connecting you to the user now.';
    case 'schedule_callback':
      return 'Scheduling your callback now.';
    default:
      return 'Working on that now.';
  }
}

function isLiveKitOutputInvalidState(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('InvalidState');
}

function resolveAudioSourceQueueMs(): number {
  const raw = Number(process.env.AGENT_LIVEKIT_AUDIO_SOURCE_QUEUE_MS ?? 1500);
  if (!Number.isFinite(raw)) return 1500;
  return Math.max(250, Math.min(4000, Math.round(raw)));
}

function extractInitialGreeting(systemPrompt: string): string {
  const welcomeLine = systemPrompt
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('WELCOME MESSAGE:'));
  const welcomeMessage = welcomeLine?.slice('WELCOME MESSAGE:'.length).trim();
  if (welcomeMessage) {
    return `System: The phone call has just connected. Greet the caller now using this welcome message naturally: "${welcomeMessage}"`;
  }
  return 'System: The phone call has just connected. Please warmly greet the caller and introduce yourself.';
}

function resolveOpenAIFallbackCommitDelayMs(): number {
  const raw = Number(process.env.AGENT_OPENAI_LOCAL_ENDPOINT_DELAY_MS ?? 220);
  if (!Number.isFinite(raw)) return 220;
  return Math.max(0, Math.min(2000, raw));
}

export async function runLiveKitRoomRuntime(
  input: RealtimeDispatchInput,
  options?: {
    onToolCall?: (input: { name: string; args: Record<string, unknown>; callId?: string }) => Promise<unknown | ToolError>;
    onToolCallStart?: (input: { name: string; callId?: string }) => Promise<void> | void;
    onUserTranscript?: (text: string) => Promise<void> | void;
    onAssistantTranscript?: (text: string) => Promise<void> | void;
  },
): Promise<void> {
  const livekitUrl = resolveLiveKitUrl(input);
  const joinToken = resolveJoinToken(input);
  if (!livekitUrl) {
    throw new Error('missing_livekit_url_for_worker_runtime');
  }
  if (!joinToken) {
    throw new Error('missing_join_token_for_worker_runtime');
  }

  const timeoutMs = Number(process.env.AGENT_WORKER_MAX_SESSION_MS ?? 30 * 60 * 1000);
  const room = new Room();
  const runtimeStartedAtMs = Date.now();
  let bridge: Awaited<ReturnType<typeof createRealtimeVoiceBridge>> = null;
  const outputSampleRate = Number(process.env.AGENT_GEMINI_OUTPUT_SAMPLE_RATE ?? 24000);
  const outputChannels = 1;
  const audioSourceQueueMs = resolveAudioSourceQueueMs();
  let agentAudioSource = new AudioSource(outputSampleRate, outputChannels, audioSourceQueueMs);
  let agentAudioTrack = LocalAudioTrack.createAudioTrack('rb.agent.audio', agentAudioSource);
  let agentAudioPublication: LocalTrackPublication | null = null;
  const inputStreams = new Map<string, ReadableStreamDefaultReader<AudioFrame>>();
  const metricsIntervalMsRaw = Number(process.env.AGENT_AUDIO_METRICS_INTERVAL_MS ?? 10_000);
  const metricsIntervalMs = Number.isFinite(metricsIntervalMsRaw) && metricsIntervalMsRaw > 0 ? metricsIntervalMsRaw : 10_000;
  const userSpeechEndHoldMsRaw = Number(process.env.AGENT_USER_SPEECH_END_HOLD_MS ?? 140);
  const userSpeechEndHoldMs =
    Number.isFinite(userSpeechEndHoldMsRaw) && userSpeechEndHoldMsRaw >= 20 ? userSpeechEndHoldMsRaw : 140;
  const callerToModelMetrics = createStreamMetrics();
  const modelToCallerMetrics = createStreamMetrics();
  const responseLatencySamplesMs: number[] = [];
  let resampledOutputFrames = 0;
  let resampledOutputSamples = 0;
  let modelCaptureTotalMs = 0;
  let modelCaptureSamples = 0;
  let outputCaptureAvailable = true;
  let outputCaptureFailureLogged = false;
  let outputTrackRecovery: Promise<boolean> | null = null;
  let lastModelAudioAtMs: number | null = null;
  let lastDetectedUserSpeechEndAtMs: number | null = null;
  let roomConnectedAtMs: number | null = null;
  let firstUserSpeechAtMs: number | null = null;
  let firstUserSpeechLogged = false;
  let firstUserSpeechEndLogged = false;
  let firstModelAudioChunkAtMs: number | null = null;
  let firstModelAudioChunkLogged = false;
  let firstModelAudioPlaybackAtMs: number | null = null;
  let firstModelAudioPlaybackLogged = false;
  let participantDisconnectedAtMs: number | null = null;
  let userSpeechEndTimer: ReturnType<typeof setTimeout> | null = null;
  let openAiTurnCommitTimer: ReturnType<typeof setTimeout> | null = null;
  let audioMetricsTimer: ReturnType<typeof setInterval> | null = null;
  const currentVoiceProvider =
    (input.realtime.metadata as { dispatchPayload?: { llm?: { provider?: string } } } | undefined)?.dispatchPayload?.llm
      ?.provider ?? 'none';
  const log = withLogContext({
    requestId: input.requestId,
    callId: input.realtime.sessionId,
    provider: 'livekit',
  });
  const publishOptions = new TrackPublishOptions();
  publishOptions.source = TrackSource.SOURCE_MICROPHONE;
  const initialGreetingPrompt = extractInitialGreeting(input.systemPrompt);
  const downlinkChunkBuffer = createPcmChunkBuffer({
    sampleRate: outputSampleRate,
    targetChunkMs: resolveDownlinkChunkMs(currentVoiceProvider),
  });

  const recreateAgentAudioOutput = async (reason: string, error?: unknown): Promise<boolean> => {
    if (outputTrackRecovery) {
      return await outputTrackRecovery;
    }

    outputTrackRecovery = (async () => {
      const localParticipant = room.localParticipant;
      if (!localParticipant) {
        log.warn({ roomName: input.roomName, reason }, 'livekit_output_recovery_skipped_no_participant');
        return false;
      }

      const previousPublication = agentAudioPublication;
      const previousTrack = agentAudioTrack;
      const previousSource = agentAudioSource;

      try {
        previousSource.clearQueue();
      } catch {
        // best effort cleanup
      }

      if (previousPublication?.sid) {
        await localParticipant.unpublishTrack(previousPublication.sid).catch(() => {
          // best effort cleanup
        });
      }

      await previousTrack.close().catch(() => {
        // best effort cleanup
      });
      await previousSource.close().catch(() => {
        // best effort cleanup
      });

      agentAudioSource = new AudioSource(outputSampleRate, outputChannels, audioSourceQueueMs);
      agentAudioTrack = LocalAudioTrack.createAudioTrack('rb.agent.audio', agentAudioSource);
      agentAudioPublication = await localParticipant.publishTrack(agentAudioTrack, publishOptions);
      outputCaptureAvailable = true;
      outputCaptureFailureLogged = false;

      log.warn(
        {
          roomName: input.roomName,
          reason,
          previousTrackSid: previousPublication?.sid ?? null,
          err: error,
        },
        'livekit_output_track_recreated',
      );

      return true;
    })();

    try {
      return await outputTrackRecovery;
    } finally {
      outputTrackRecovery = null;
    }
  };

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    log.info({ participantIdentity: participant.identity }, 'livekit_worker_participant_connected');
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    participantDisconnectedAtMs = Date.now();
    if (userSpeechEndTimer) {
      clearTimeout(userSpeechEndTimer);
      userSpeechEndTimer = null;
    }
    log.info({ participantIdentity: participant.identity }, 'livekit_worker_participant_disconnected');
  });

  try {
    await room.connect(livekitUrl, joinToken, {
      autoSubscribe: true,
      dynacast: false,
    });
    roomConnectedAtMs = Date.now();

    log.info({ roomName: input.roomName }, 'livekit_worker_connected_to_room');
    observeDurationMs('realtime_worker_stage_ms', roomConnectedAtMs - runtimeStartedAtMs, {
      transport: 'livekit',
      voiceProvider: currentVoiceProvider,
      stage: 'dispatch_to_room_connected',
    });

    if (!room.localParticipant) {
      throw new Error('livekit_local_participant_not_ready');
    }

    agentAudioPublication = await room.localParticipant.publishTrack(agentAudioTrack, publishOptions);
    audioMetricsTimer = setInterval(() => {
      const queuedDurationMs = Math.round(agentAudioSource.queuedDuration * 1000);
      const avgModelCaptureMs = modelCaptureSamples > 0 ? modelCaptureTotalMs / modelCaptureSamples : 0;
      const responseLatencyP50Ms = percentile(responseLatencySamplesMs, 50);
      const responseLatencyP95Ms = percentile(responseLatencySamplesMs, 95);
      log.info(
        {
          roomName: input.roomName,
          voiceProvider: currentVoiceProvider,
          callerToModelFrames: callerToModelMetrics.frames,
          callerToModelSamples: callerToModelMetrics.samples,
          callerToModelAvgJitterMs: Number(avgJitterMs(callerToModelMetrics).toFixed(2)),
          modelToCallerFrames: modelToCallerMetrics.frames,
          modelToCallerSamples: modelToCallerMetrics.samples,
          modelToCallerAvgJitterMs: Number(avgJitterMs(modelToCallerMetrics).toFixed(2)),
          modelOutputResampledFrames: resampledOutputFrames,
          modelOutputResampledSamples: resampledOutputSamples,
          modelCaptureAvgMs: Number(avgModelCaptureMs.toFixed(2)),
          outputQueueLatencyMs: queuedDurationMs,
          userSpeechToFirstAudioSamples: responseLatencySamplesMs.length,
          userSpeechToFirstAudioP50Ms: Number(responseLatencyP50Ms.toFixed(2)),
          userSpeechToFirstAudioP95Ms: Number(responseLatencyP95Ms.toFixed(2)),
        },
        'livekit_audio_metrics',
      );
      observeDurationMs('realtime_audio_queue_latency_ms', queuedDurationMs, {
        transport: 'livekit',
        voiceProvider: currentVoiceProvider,
      });
      observeDurationMs('realtime_audio_jitter_ms', avgJitterMs(callerToModelMetrics), {
        transport: 'livekit',
        voiceProvider: currentVoiceProvider,
        direction: 'caller_to_model',
      });
      observeDurationMs('realtime_audio_jitter_ms', avgJitterMs(modelToCallerMetrics), {
        transport: 'livekit',
        voiceProvider: currentVoiceProvider,
        direction: 'model_to_caller',
      });
      observeDurationMs('realtime_response_latency_ms', responseLatencyP50Ms, {
        transport: 'livekit',
        voiceProvider: currentVoiceProvider,
        percentile: 'p50',
      });
      observeDurationMs('realtime_response_latency_ms', responseLatencyP95Ms, {
        transport: 'livekit',
        voiceProvider: currentVoiceProvider,
        percentile: 'p95',
      });
    }, metricsIntervalMs);

    bridge = await createRealtimeVoiceBridge({
      room,
      dispatch: input,
      onToolCall: options?.onToolCall,
      onToolCallStart: async ({ name, callId }) => {
        if (options?.onToolCallStart) {
          await options.onToolCallStart({ name, callId });
        }
        const statusText = buildToolStatusMessage(name);
        if (statusText && room.localParticipant) {
          void room.localParticipant.sendText(statusText, {
            topic: 'rb.agent.status',
          });
        }
      },
      onUserTranscript: options?.onUserTranscript,
      onAssistantTranscript: options?.onAssistantTranscript,
      onModelAudioPcm: async ({ pcm16, sampleRate }) => {
        if (!outputCaptureAvailable) return;
        const nowMs = Date.now();
        if (!firstModelAudioChunkAtMs) {
          firstModelAudioChunkAtMs = nowMs;
          if (!firstModelAudioChunkLogged) {
            firstModelAudioChunkLogged = true;
            log.info(
              {
                roomName: input.roomName,
                sampleRate,
                pcmSamples: pcm16.length,
                dispatchToFirstModelAudioChunkMs: nowMs - runtimeStartedAtMs,
                roomConnectedToFirstModelAudioChunkMs: roomConnectedAtMs ? nowMs - roomConnectedAtMs : null,
                firstUserSpeechToFirstModelAudioChunkMs: firstUserSpeechAtMs ? nowMs - firstUserSpeechAtMs : null,
                userSpeechEndToFirstModelAudioChunkMs: lastDetectedUserSpeechEndAtMs
                  ? nowMs - lastDetectedUserSpeechEndAtMs
                  : null,
              },
              'livekit_first_model_audio_chunk_received',
            );
          }
          observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
            transport: 'livekit',
            voiceProvider: currentVoiceProvider,
            stage: 'dispatch_to_first_model_audio_chunk',
          });
          if (roomConnectedAtMs) {
            observeDurationMs('realtime_worker_stage_ms', nowMs - roomConnectedAtMs, {
              transport: 'livekit',
              voiceProvider: currentVoiceProvider,
              stage: 'room_connected_to_first_model_audio_chunk',
            });
          }
        }
        if (openAiTurnCommitTimer) {
          clearTimeout(openAiTurnCommitTimer);
          openAiTurnCommitTimer = null;
        }
        const modelTurnStartGapMs = 240;
        const isNewModelTurn = !lastModelAudioAtMs || nowMs - lastModelAudioAtMs >= modelTurnStartGapMs;
        if (isNewModelTurn && lastDetectedUserSpeechEndAtMs) {
          const responseLatencyMs = nowMs - lastDetectedUserSpeechEndAtMs;
          if (responseLatencyMs >= 0 && responseLatencyMs <= 60_000) {
            responseLatencySamplesMs.push(responseLatencyMs);
            if (responseLatencySamplesMs.length > 500) {
              responseLatencySamplesMs.shift();
            }
            observeDurationMs('realtime_response_latency_ms', responseLatencyMs, {
              transport: 'livekit',
              voiceProvider: currentVoiceProvider,
              percentile: 'sample',
            });
          }
          lastDetectedUserSpeechEndAtMs = null;
        }

        let pcmForOutput = pcm16;
        if (sampleRate !== outputSampleRate) {
          const resampled = resamplePcmLinear(pcm16, sampleRate, outputSampleRate);
          resampledOutputFrames += 1;
          resampledOutputSamples += resampled.length;
          pcmForOutput = resampled;
        }

        const framesToCapture = downlinkChunkBuffer.push(pcmForOutput);
        for (const frameChunk of framesToCapture) {
          const captureFrame = async () =>
            await agentAudioSource.captureFrame(
              new AudioFrame(frameChunk, outputSampleRate, outputChannels, frameChunk.length),
            );

          const captureStart = performance.now();
          try {
            await captureFrame();
          } catch (error) {
            if (isLiveKitOutputInvalidState(error)) {
              outputCaptureAvailable = false;
              if (!outputCaptureFailureLogged) {
                outputCaptureFailureLogged = true;
                log.warn(
                  {
                    roomName: input.roomName,
                    err: error,
                  },
                  'livekit_output_capture_failed',
                );
              }

              const recovered = await recreateAgentAudioOutput('capture_frame_invalid_state', error).catch((recoveryError) => {
                log.error(
                  {
                    roomName: input.roomName,
                    err: recoveryError,
                  },
                  'livekit_output_track_recovery_failed',
                );
                return false;
              });
              if (!recovered) return;

              try {
                await captureFrame();
              } catch (retryError) {
                outputCaptureAvailable = !isLiveKitOutputInvalidState(retryError);
                log.warn(
                  {
                    roomName: input.roomName,
                    err: retryError,
                  },
                  'livekit_output_capture_retry_failed',
                );
                return;
              }
            } else {
              if (!outputCaptureFailureLogged) {
                outputCaptureFailureLogged = true;
                log.warn(
                  {
                    roomName: input.roomName,
                    err: error,
                  },
                  'livekit_output_capture_failed',
                );
              }
              return;
            }
          }
          const captureElapsedMs = performance.now() - captureStart;
          modelCaptureTotalMs += captureElapsedMs;
          modelCaptureSamples += 1;
          recordFrameMetrics(modelToCallerMetrics, Date.now(), frameChunk.length);
        }
        lastModelAudioAtMs = nowMs;
        if (!firstModelAudioPlaybackAtMs) {
          firstModelAudioPlaybackAtMs = nowMs;
          if (!firstModelAudioPlaybackLogged) {
            firstModelAudioPlaybackLogged = true;
            log.info(
              {
                roomName: input.roomName,
                pcmSamples: pcmForOutput.length,
                dispatchToFirstModelPlaybackMs: nowMs - runtimeStartedAtMs,
                roomConnectedToFirstModelPlaybackMs: roomConnectedAtMs ? nowMs - roomConnectedAtMs : null,
                firstUserSpeechToFirstModelPlaybackMs: firstUserSpeechAtMs ? nowMs - firstUserSpeechAtMs : null,
                firstChunkToFirstPlaybackMs: firstModelAudioChunkAtMs ? nowMs - firstModelAudioChunkAtMs : null,
                userSpeechEndToFirstPlaybackMs: lastDetectedUserSpeechEndAtMs ? nowMs - lastDetectedUserSpeechEndAtMs : null,
              },
              'livekit_first_model_audio_played',
            );
          }
          observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
            transport: 'livekit',
            voiceProvider: currentVoiceProvider,
            stage: 'dispatch_to_first_model_playback',
          });
          if (roomConnectedAtMs) {
            observeDurationMs('realtime_worker_stage_ms', nowMs - roomConnectedAtMs, {
              transport: 'livekit',
              voiceProvider: currentVoiceProvider,
              stage: 'room_connected_to_first_model_playback',
            });
          }
        }
      },
    });

    if (!bridge) {
      log.warn(
        {
          roomName: input.roomName,
        },
        'realtime_voice_bridge_unavailable',
      );
    }

    room.on(RoomEvent.ChatMessage, (message, participant) => {
      if (!bridge) return;
      if (!participant) return;
      if (participant.identity === room.localParticipant?.identity) return;
      const text = message.message?.trim();
      if (!text) return;
      if (options?.onUserTranscript) {
        void options.onUserTranscript(text);
      }
      bridge.sendUserText(text);
    });

    let initialGreetingSent = false;
    const triggerInitialGreeting = () => {
      if (!bridge || initialGreetingSent) return;
      initialGreetingSent = true;
      log.info(
        {
          roomName: input.roomName,
          voiceProvider: currentVoiceProvider,
        },
        'livekit_initial_greeting_triggered',
      );
      setTimeout(() => {
        bridge?.sendUserText(initialGreetingPrompt);
      }, 300);
    };
    const attachInboundAudioTrack = (track: RemoteTrack, participant: { identity: string }) => {
      if (!bridge) return;
      triggerInitialGreeting();

      const activeBridge = bridge;
      if (participant.identity === room.localParticipant?.identity) return;
      if (track.kind !== TrackKind.KIND_AUDIO) return;
      if (track.sid && inputStreams.has(track.sid)) return;

      const stream = new AudioStream(track, {
        sampleRate: 16000,
        numChannels: 1,
        frameSizeMs: 20,
      });
      const reader = stream.getReader();
      const streamId = track.sid ?? `${participant.identity}:${Date.now()}`;
      inputStreams.set(streamId, reader);
      const uplinkChunkMs = resolveUplinkChunkMs(currentVoiceProvider);
      const uplinkChunker = createUplinkAudioChunker({
        sampleRate: 16000,
        targetChunkMs: uplinkChunkMs,
        onChunk: (pcm16, sampleRate) => {
          const actualChunkMs = (pcm16.length / sampleRate) * 1000;
          observeDurationMs('realtime_uplink_chunk_ms', actualChunkMs, {
            transport: 'livekit',
            voiceProvider: currentVoiceProvider,
          });
          activeBridge.sendUserAudioPcm({
            pcm16,
            sampleRate,
          });
        },
      });

      void (async () => {
        try {
          while (true) {
            const next = await reader.read();
            if (next.done || !next.value) break;
            const mono = toMonoPcm(next.value);
            const nowMs = Date.now();
            recordFrameMetrics(callerToModelMetrics, nowMs, mono.length);
            if (!firstUserSpeechAtMs) {
              firstUserSpeechAtMs = nowMs;
              if (!firstUserSpeechLogged) {
                firstUserSpeechLogged = true;
                log.info(
                  {
                    participantIdentity: participant.identity,
                    roomName: input.roomName,
                    dispatchToFirstUserSpeechMs: nowMs - runtimeStartedAtMs,
                    roomConnectedToFirstUserSpeechMs: roomConnectedAtMs ? nowMs - roomConnectedAtMs : null,
                  },
                  'livekit_first_user_speech_detected',
                );
              }
              observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
                transport: 'livekit',
                voiceProvider: currentVoiceProvider,
                stage: 'dispatch_to_first_user_speech',
              });
              if (roomConnectedAtMs) {
                observeDurationMs('realtime_worker_stage_ms', nowMs - roomConnectedAtMs, {
                  transport: 'livekit',
                  voiceProvider: currentVoiceProvider,
                  stage: 'room_connected_to_first_user_speech',
                });
              }
            }
            if (userSpeechEndTimer) {
              clearTimeout(userSpeechEndTimer);
              userSpeechEndTimer = null;
            }
            if (openAiTurnCommitTimer) {
              clearTimeout(openAiTurnCommitTimer);
              openAiTurnCommitTimer = null;
            }
            userSpeechEndTimer = setTimeout(() => {
              if (participantDisconnectedAtMs) {
                userSpeechEndTimer = null;
                return;
              }
              lastDetectedUserSpeechEndAtMs = Date.now();
              if (!firstUserSpeechEndLogged) {
                firstUserSpeechEndLogged = true;
                log.info(
                  {
                    participantIdentity: participant.identity,
                    roomName: input.roomName,
                    dispatchToFirstUserSpeechEndMs: lastDetectedUserSpeechEndAtMs - runtimeStartedAtMs,
                    roomConnectedToFirstUserSpeechEndMs: roomConnectedAtMs
                      ? lastDetectedUserSpeechEndAtMs - roomConnectedAtMs
                      : null,
                    firstUserSpeechToFirstSpeechEndMs: firstUserSpeechAtMs
                      ? lastDetectedUserSpeechEndAtMs - firstUserSpeechAtMs
                      : null,
                  },
                  'livekit_first_user_speech_ended',
                );
              }
              observeDurationMs('realtime_worker_stage_ms', lastDetectedUserSpeechEndAtMs - runtimeStartedAtMs, {
                transport: 'livekit',
                voiceProvider: currentVoiceProvider,
                stage: 'dispatch_to_first_user_speech_end',
              });
              if (currentVoiceProvider === 'openai_realtime' && bridge?.commitUserAudioTurn) {
                openAiTurnCommitTimer = setTimeout(() => {
                  if (participantDisconnectedAtMs) return;
                  log.info(
                    {
                      roomName: input.roomName,
                      voiceProvider: currentVoiceProvider,
                    },
                    'livekit_openai_local_endpoint_commit_triggered',
                  );
                  bridge?.commitUserAudioTurn?.();
                  openAiTurnCommitTimer = null;
                }, resolveOpenAIFallbackCommitDelayMs());
              }
              userSpeechEndTimer = null;
            }, userSpeechEndHoldMs);
            uplinkChunker.push(mono);
          }
        } catch (error) {
          log.warn(
            {
              err: error,
              participantIdentity: participant.identity,
              trackSid: track.sid,
            },
            'livekit_inbound_audio_stream_failed',
          );
        } finally {
          uplinkChunker.flush();
          inputStreams.delete(streamId);
          await reader.cancel().catch(() => {
            // best effort cleanup
          });
        }
      })();
    };

    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication, participant) => {
      attachInboundAudioTrack(track, participant);
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      if (participant.identity === room.localParticipant?.identity) return;
      triggerInitialGreeting();
    });

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      const streamId = track.sid;
      if (!streamId) return;
      const reader = inputStreams.get(streamId);
      if (!reader) return;
      inputStreams.delete(streamId);
      void reader.cancel().catch(() => {
        // best effort cleanup
      });
    });

    // Auto-subscribe can complete before TrackSubscribed handler attaches.
    // Attach readers for already-subscribed remote audio tracks as a safety net.
    for (const participant of room.remoteParticipants.values()) {
      if (participant.identity !== room.localParticipant?.identity) {
        triggerInitialGreeting();
      }
      for (const publication of participant.trackPublications.values()) {
        const subscribedTrack = publication.track;
        if (!subscribedTrack) continue;
        attachInboundAudioTrack(subscribedTrack, participant);
      }
    }

    const result = await waitForDisconnectOrTimeout(room, timeoutMs);
    if (result === 'timeout') {
      log.warn({ timeoutMs, roomName: input.roomName }, 'livekit_worker_session_timeout');
    }

    log.info({ roomName: input.roomName, result }, 'livekit_worker_session_finished');
  } finally {
    if (userSpeechEndTimer) {
      clearTimeout(userSpeechEndTimer);
      userSpeechEndTimer = null;
    }
    if (openAiTurnCommitTimer) {
      clearTimeout(openAiTurnCommitTimer);
      openAiTurnCommitTimer = null;
    }
    if (audioMetricsTimer) {
      clearInterval(audioMetricsTimer);
      audioMetricsTimer = null;
    }
    for (const reader of inputStreams.values()) {
      await reader.cancel().catch(() => {
        // best effort cleanup
      });
    }
    inputStreams.clear();

    bridge?.close();
    if (agentAudioPublication?.sid && room.localParticipant) {
      await room.localParticipant.unpublishTrack(agentAudioPublication.sid).catch(() => {
        // best effort cleanup
      });
    }
    await agentAudioTrack.close().catch(() => {
      // best effort cleanup
    });
    await agentAudioSource.close().catch(() => {
      // best effort cleanup
    });
    await room.disconnect().catch(() => {
      // best effort cleanup
    });
  }
}
