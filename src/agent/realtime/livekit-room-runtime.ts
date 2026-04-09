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
  let bridge: Awaited<ReturnType<typeof createRealtimeVoiceBridge>> = null;
  const outputSampleRate = Number(process.env.AGENT_GEMINI_OUTPUT_SAMPLE_RATE ?? 24000);
  const outputChannels = 1;
  const agentAudioSource = new AudioSource(outputSampleRate, outputChannels);
  const agentAudioTrack = LocalAudioTrack.createAudioTrack('rb.agent.audio', agentAudioSource);
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
  let lastModelAudioAtMs: number | null = null;
  let lastDetectedUserSpeechEndAtMs: number | null = null;
  let userSpeechEndTimer: ReturnType<typeof setTimeout> | null = null;
  let audioMetricsTimer: ReturnType<typeof setInterval> | null = null;
  const currentVoiceProvider =
    (input.realtime.metadata as { dispatchPayload?: { llm?: { provider?: string } } } | undefined)?.dispatchPayload?.llm
      ?.provider ?? 'none';
  const log = withLogContext({
    requestId: input.requestId,
    callId: input.realtime.sessionId,
    provider: 'livekit',
  });

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    log.info({ participantIdentity: participant.identity }, 'livekit_worker_participant_connected');
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    log.info({ participantIdentity: participant.identity }, 'livekit_worker_participant_disconnected');
  });

  try {
    await room.connect(livekitUrl, joinToken, {
      autoSubscribe: true,
      dynacast: false,
    });

    log.info({ roomName: input.roomName }, 'livekit_worker_connected_to_room');

    if (!room.localParticipant) {
      throw new Error('livekit_local_participant_not_ready');
    }

    const publishOptions = new TrackPublishOptions();
    publishOptions.source = TrackSource.SOURCE_MICROPHONE;
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

        const captureStart = performance.now();
        try {
          await agentAudioSource.captureFrame(
            new AudioFrame(pcmForOutput, outputSampleRate, outputChannels, pcmForOutput.length),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes('InvalidState')) {
            outputCaptureAvailable = false;
          }
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
        const captureElapsedMs = performance.now() - captureStart;
        modelCaptureTotalMs += captureElapsedMs;
        modelCaptureSamples += 1;
        lastModelAudioAtMs = nowMs;
        recordFrameMetrics(modelToCallerMetrics, nowMs, pcmForOutput.length);
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

    const attachInboundAudioTrack = (track: RemoteTrack, participant: { identity: string }) => {
      if (!bridge) return;
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
            if (userSpeechEndTimer) {
              clearTimeout(userSpeechEndTimer);
              userSpeechEndTimer = null;
            }
            userSpeechEndTimer = setTimeout(() => {
              lastDetectedUserSpeechEndAtMs = Date.now();
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
