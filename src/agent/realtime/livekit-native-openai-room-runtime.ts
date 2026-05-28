import { voice as agentVoice, initializeLogger, llm as agentLlm } from '@livekit/agents';
import { AudioFrame, Room, RoomEvent, TrackKind } from '@livekit/rtc-node';

import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import type { RealtimeSessionMetadata } from '@/src/agent/realtime/types';
import {
  isDemoRealtimeMetadata,
  resolveShopPlanFromDispatchMetadata,
  shouldDefaultTranscriptionToVietnamese,
  shouldUseVietnameseFallbackGreeting,
  transcriptionPolicyFromDispatchInput,
} from '@/src/agent/realtime/livekit-language-policy';
import {
  compactRealtimeSystemInstruction,
  getOpenAiVietnameseBookingTranscriptionPrompt,
  normalizeOpenAiRealtimeVoice,
  openAiRealtimeVoiceForDemoVerticalSlug,
  renderFallbackGreeting,
  renderRealtimeGreetingInstructions,
} from '@/src/agent/prompts';
import { logger, withLogContext } from '@/src/backend/observability/logger';
import { observeDurationMs } from '@/src/backend/observability/metrics';
import { resolveProductionRealtimeTranscriptionDefaultLanguage } from '@/src/backend/prompts/production-language-policy';

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
  return compactRealtimeSystemInstruction(raw, {
    maxCharsRaw: process.env.AGENT_OPENAI_SYSTEM_PROMPT_MAX_CHARS,
    policyKind: 'native_openai',
  });
}

function resolveOpenAIModel(input: RealtimeDispatchInput): string | null {
  const fromMetadata = (input.realtime.metadata as { dispatchPayload?: { llm?: { model?: string } } } | undefined)
    ?.dispatchPayload?.llm?.model;
  return fromMetadata ?? process.env.AGENT_VOICE_MODEL ?? 'gpt-realtime';
}

function resolveOpenAIVoice(input?: RealtimeDispatchInput): string {
  const demoVertical = (
    input?.realtime.metadata as { dispatchPayload?: { demo?: { vertical?: string } } } | undefined
  )?.dispatchPayload?.demo?.vertical;

  if (demoVertical) return openAiRealtimeVoiceForDemoVerticalSlug(demoVertical);

  return normalizeOpenAiRealtimeVoice(process.env.AGENT_OPENAI_VOICE, 'marin');
}

function resolveOpenAIAudioSpeed(): number | undefined {
  const raw = process.env.AGENT_OPENAI_AUDIO_SPEED?.trim();
  if (!raw) return undefined;
  const speed = Number(raw);
  if (!Number.isFinite(speed)) return undefined;
  return Math.max(0.25, Math.min(4, speed));
}

function resolveOpenAIInputNoiseReduction(): { type: 'near_field' | 'far_field' } | null | undefined {
  const raw = process.env.AGENT_OPENAI_INPUT_NOISE_REDUCTION?.trim().toLowerCase();
  if (!raw) return { type: 'near_field' };
  if (raw === 'off' || raw === 'none' || raw === 'false' || raw === '0') return null;
  if (raw === 'near_field' || raw === 'far_field') return { type: raw };
  return { type: 'near_field' };
}

function resolveLiveKitOutputGain(): number {
  const raw = process.env.AGENT_LIVEKIT_OUTPUT_GAIN?.trim() || process.env.AGENT_OPENAI_OUTPUT_GAIN?.trim();
  if (!raw) return 1.4;
  const normalized = raw.toLowerCase();
  if (normalized === 'off' || normalized === 'none' || normalized === 'false' || normalized === '0') return 1;
  const gain = Number(raw);
  if (!Number.isFinite(gain)) return 1.4;
  return Math.max(0.25, Math.min(2, gain));
}

function applyOutputGain(frame: AudioFrame, gain: number): AudioFrame {
  if (gain === 1 || frame.data.length === 0) return frame;
  const amplified = new Int16Array(frame.data.length);
  for (let i = 0; i < frame.data.length; i += 1) {
    const sample = Math.round((frame.data[i] ?? 0) * gain);
    amplified[i] = Math.max(-32768, Math.min(32767, sample));
  }
  return new AudioFrame(amplified, frame.sampleRate, frame.channels, frame.samplesPerChannel, frame.userdata);
}

function resolveDefaultInputTranscriptionLanguage(input: RealtimeDispatchInput): string | undefined {
  const policy = transcriptionPolicyFromDispatchInput(input, () => {
    logger.warn(
      {
        requestId: input.requestId,
        roomName: input.roomName,
      },
      'shop_plan_missing_for_language_policy',
    );
  });
  if (policy.demoIsolated && shouldDefaultTranscriptionToVietnamese(policy)) return 'vi';
  return resolveProductionRealtimeTranscriptionDefaultLanguage(policy.shopPlan, policy.shopLanguages);
}

function shouldDefaultToVietnamese(input: RealtimeDispatchInput): boolean {
  return shouldDefaultTranscriptionToVietnamese(
    transcriptionPolicyFromDispatchInput(input, () => {
      logger.warn(
        {
          requestId: input.requestId,
          roomName: input.roomName,
        },
        'shop_plan_missing_for_language_policy',
      );
    }),
  );
}

function normalizeInputTranscriptionLanguage(value: string | undefined, defaultValue: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return defaultValue;
  const normalized = raw.toLowerCase();
  if (['auto', 'detect', 'none', 'off', 'false', '0'].includes(normalized)) return undefined;
  return raw;
}

function resolveOpenAIInputAudioTranscription(
  input: RealtimeDispatchInput,
): { model: string; language?: string; prompt?: string } | null {
  if (!parseBoolean(process.env.AGENT_OPENAI_INPUT_TRANSCRIPTION_ENABLED, true)) return null;

  const language = normalizeInputTranscriptionLanguage(
    process.env.AGENT_OPENAI_INPUT_TRANSCRIPTION_LANGUAGE ?? process.env.AGENT_OPENAI_LANGUAGE,
    resolveDefaultInputTranscriptionLanguage(input),
  );
  const prompt =
    process.env.AGENT_OPENAI_INPUT_TRANSCRIPTION_PROMPT?.trim() ||
    (language === 'vi' ? getOpenAiVietnameseBookingTranscriptionPrompt() : undefined);

  return {
    model: process.env.AGENT_OPENAI_INPUT_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe',
    ...(language ? { language } : {}),
    ...(prompt ? { prompt } : {}),
  };
}

function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function normalizePromptValue(value: string): string {
  return stripSurroundingQuotes(value.replace(/\s+/g, ' ').trim()).replace(/[.!?]+$/, '').trim();
}

function extractPromptLineValue(systemPrompt: string, labels: string[]): string | null {
  const normalizedLabels = labels.map((label) => `${label.toLowerCase()}:`);
  for (const line of systemPrompt.split(/\r?\n/)) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    const matchedLabel = normalizedLabels.find((label) => lower.startsWith(label));
    if (!matchedLabel) continue;
    const value = stripSurroundingQuotes(trimmed.slice(matchedLabel.length).trim());
    if (value) return value;
  }
  return null;
}

function extractShopNameFromSystemPrompt(systemPrompt: string): string | null {
  const explicitName = extractPromptLineValue(systemPrompt, ['SHOP NAME', 'SALON NAME', 'BUSINESS NAME']);
  if (explicitName) return normalizePromptValue(explicitName);

  const patterns = [
    /You are the AI receptionist for\s+(.+?)(?:\.|\n|$)/i,
    /You work at\s+(.+?)(?:,|\n|$)/i,
    /Treat the prospect's business name as\s+(.+?)(?:\.|\n|$)/i,
  ];
  for (const pattern of patterns) {
    const match = systemPrompt.match(pattern);
    const name = match?.[1] ? normalizePromptValue(match[1]) : null;
    if (name) return name;
  }

  return null;
}

function resolveGreetingText(input: RealtimeDispatchInput): string {
  const promptGreeting = extractPromptLineValue(input.systemPrompt, [
    'WELCOME MESSAGE',
    'INITIAL GREETING',
    'OPENING GREETING',
  ]);
  if (promptGreeting) return promptGreeting;

  const explicit = process.env.AGENT_OPENAI_INITIAL_GREETING_TEXT?.trim();
  if (explicit) return explicit;

  const metadata = input.realtime.metadata as Partial<RealtimeSessionMetadata> | undefined;
  const shopPlan = resolveShopPlanFromDispatchMetadata(metadata);
  const demoIsolated = isDemoRealtimeMetadata(metadata);
  const greetingLangRaw = process.env.AGENT_OPENAI_GREETING_LANGUAGE;
  const languageNormalized = greetingLangRaw?.trim().toLowerCase();
  const envRequestsVi = languageNormalized === 'vi' || languageNormalized === 'vietnamese';
  const starterOrUnknownProduction = shopPlan === 'starter' || (shopPlan === undefined && !demoIsolated);

  if (starterOrUnknownProduction && envRequestsVi) {
    logger.warn(
      { requestId: input.requestId, roomName: input.roomName },
      'greeting_language_env_ignored_starter_or_missing_plan',
    );
  }

  const transcriptionDefaultsVietnamese = shouldDefaultTranscriptionToVietnamese(
    transcriptionPolicyFromDispatchInput(input),
  );

  const shouldUseVietnamese = shouldUseVietnameseFallbackGreeting({
    shopPlan,
    demoIsolated,
    greetingLanguageEnv: greetingLangRaw,
    transcriptionDefaultsVietnamese,
  });
  const shopName = extractShopNameFromSystemPrompt(input.systemPrompt);

  if (shouldUseVietnamese) {
    return renderFallbackGreeting({ businessName: shopName, language: 'vi' });
  }
  return renderFallbackGreeting({ businessName: shopName, language: 'en' });
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

function resolveLiveKitInterruptionMode(): 'adaptive' | 'vad' | undefined {
  const raw = process.env.AGENT_LIVEKIT_INTERRUPTION_MODE?.trim().toLowerCase();
  if (raw === 'adaptive' || raw === 'vad') return raw;
  return undefined;
}

function resolveLiveKitAgentSessionOptions() {
  const falseInterruptionTimeoutRaw = process.env.AGENT_LIVEKIT_FALSE_INTERRUPTION_TIMEOUT_MS?.trim();
  const falseInterruptionTimeout =
    falseInterruptionTimeoutRaw?.toLowerCase() === 'off'
      ? undefined
      : Math.max(0, Math.round(parseNumber(falseInterruptionTimeoutRaw, 1200)));

  return {
    preemptiveGeneration: parseBoolean(process.env.AGENT_LIVEKIT_PREEMPTIVE_GENERATION, false),
    aecWarmupDuration: Math.max(0, Math.round(parseNumber(process.env.AGENT_LIVEKIT_AEC_WARMUP_MS, 3000))),
    turnHandling: {
      interruption: {
        enabled: parseBoolean(process.env.AGENT_LIVEKIT_INTERRUPTION_ENABLED, true),
        mode: resolveLiveKitInterruptionMode(),
        discardAudioIfUninterruptible: parseBoolean(
          process.env.AGENT_LIVEKIT_DISCARD_AUDIO_IF_UNINTERRUPTIBLE,
          true,
        ),
        minDuration: Math.max(0, Math.round(parseNumber(process.env.AGENT_LIVEKIT_INTERRUPTION_MIN_DURATION_MS, 800))),
        minWords: Math.max(0, Math.round(parseNumber(process.env.AGENT_LIVEKIT_INTERRUPTION_MIN_WORDS, 2))),
        falseInterruptionTimeout,
        resumeFalseInterruption: parseBoolean(process.env.AGENT_LIVEKIT_RESUME_FALSE_INTERRUPTION, false),
      },
    },
  };
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
  return 'info';
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

type OpenAIRealtimeModelDelegate = {
  model?: string;
  provider?: string;
  capabilities: ConstructorParameters<typeof agentLlm.RealtimeModel>[0];
  sampleRate?: number;
  numChannels?: number;
  inFrameSize?: number;
  outFrameSize?: number;
  close?: () => Promise<void>;
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
  /** Misnamed env: `true` = enable turn detection; mode is `semantic_vad` vs `server_vad` from `AGENT_OPENAI_TURN_DETECTION`. `false` = no turn detection. */
  const turnDetectionEnabled = parseBoolean(process.env.AGENT_OPENAI_SERVER_VAD_ENABLED, true);
  if (!turnDetectionEnabled) return null;

  const mode = process.env.AGENT_OPENAI_TURN_DETECTION?.trim().toLowerCase() === 'semantic_vad'
    ? 'semantic_vad'
    : 'server_vad';
  const createResponse = parseBoolean(process.env.AGENT_OPENAI_CREATE_RESPONSE, true);
  const interruptResponse = parseBoolean(process.env.AGENT_OPENAI_INTERRUPT_RESPONSE, true);

  if (mode === 'server_vad') {
    return {
      type: 'server_vad',
      threshold: Math.max(0, Math.min(1, parseNumber(process.env.AGENT_OPENAI_VAD_THRESHOLD, 0.45))),
      prefix_padding_ms: Math.max(0, Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_PREFIX_MS, 500))),
      silence_duration_ms: Math.max(1, Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_SILENCE_MS, 900))),
      create_response: createResponse,
      interrupt_response: interruptResponse,
    };
  }

  const eagerness = process.env.AGENT_OPENAI_SEMANTIC_VAD_EAGERNESS?.trim().toLowerCase();
  const normalizedEagerness =
    eagerness === 'low' || eagerness === 'medium' || eagerness === 'high' || eagerness === 'auto'
      ? eagerness
      : 'low';

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
  const openAiModel = model;
  const turnDetection = buildTurnDetectionConfig();
  const openAiVoice = resolveOpenAIVoice(input);
  const openAiAudioSpeed = resolveOpenAIAudioSpeed();
  const openAiInputNoiseReduction = resolveOpenAIInputNoiseReduction();
  const openAiInputAudioTranscription = resolveOpenAIInputAudioTranscription(input);
  const liveKitOutputGain = resolveLiveKitOutputGain();
  const runtimeStartedAtMs = options?.runtimeStartedAtMs ?? Date.now();
  const roomConnectedAtMs = options?.roomConnectedAtMs ?? Date.now();
  /** First OpenAI server event that indicates model audio stream (delta/done). */
  let firstOpenAiAudioStreamEventAtMs: number | null = null;
  let firstLiveKitAudioFrameCaptureStartedAtMs: number | null = null;
  let firstLiveKitAudioFrameCapturedAtMs: number | null = null;
  let firstUserSpeechAtMs: number | null = null;
  /** Timestamp when the first assistant conversation item was finalized (transcript complete — NOT when audio starts). */
  let firstAssistantItemAtMs: number | null = null;
  let callAnsweredAtMs: number | null = null;
  let sessionStartedAtMs: number | null = null;
  let outputReadyAtMs: number | null = null;
  let initialGreetingEnqueuedAtMs: number | null = null;
  let firstGreetingResponseCreateQueuedAtMs: number | null = null;
  let firstGreetingResponseCreatedAtMs: number | null = null;
  let latestUserSpeechStartedAtMs: number | null = null;
  let latestUserSpeechStoppedAtMs: number | null = null;
  let latestAgentStartedSpeakingAtMs: number | null = null;
  let latestAgentStoppedSpeakingAtMs: number | null = null;
  let currentAgentState: string | null = null;
  let currentUserState: string | null = null;
  let latestUserSpeechStartedDuringAgentSpeaking = false;
  let latestResponseCreateQueuedAtMs: number | null = null;
  let latestResponseCreatedAtMs: number | null = null;
  const responseIdsWithAudioStartedLogged = new Set<string>();
  /**
   * Latency phases per turn:
   *   Phase 1 — OpenAI:    speech_stopped  →  response.output_audio.delta  (model think time)
   *   Phase 2 — LiveKit:   response.output_audio.delta  →  first LK frame captured  (buffer + encode)
   *   Phase 3 — SIP:       first LK frame captured  →  caller hears  (outputQueueMs + network/SIP jitter — NOT measurable server-side)
   */
  /** Phase 1 anchor: timestamp of first OpenAI audio delta for the current in-flight response. Reset each response. */
  let latestResponseAudioOpenAiAtMs: number | null = null;
  /** Phase 2 result: timestamp of first LiveKit frame captured after latestResponseAudioOpenAiAtMs. Reset each response. */
  let latestResponseLiveKitFrameCapturedAtMs: number | null = null;
  /** Resolved outputQueueSizeMs — set when session starts, used in phase-3 estimate. */
  let outputQueueSizeMsResolved = 300;

  const timingSnapshot = (nowMs = Date.now()) => ({
    msSinceRuntimeStart: nowMs - runtimeStartedAtMs,
    msSinceRoomConnected: nowMs - roomConnectedAtMs,
    msSinceCallAnswered: callAnsweredAtMs ? nowMs - callAnsweredAtMs : null,
    msSinceSessionStarted: sessionStartedAtMs ? nowMs - sessionStartedAtMs : null,
    msSinceOutputReady: outputReadyAtMs ? nowMs - outputReadyAtMs : null,
    msSinceInitialGreetingEnqueued: initialGreetingEnqueuedAtMs ? nowMs - initialGreetingEnqueuedAtMs : null,
    msSinceFirstOpenAiAudioStreamEvent: firstOpenAiAudioStreamEventAtMs
      ? nowMs - firstOpenAiAudioStreamEventAtMs
      : null,
    msSinceFirstLiveKitAudioFrameCaptureStarted: firstLiveKitAudioFrameCaptureStartedAtMs
      ? nowMs - firstLiveKitAudioFrameCaptureStartedAtMs
      : null,
    msSinceFirstLiveKitAudioFrameCaptured: firstLiveKitAudioFrameCapturedAtMs
      ? nowMs - firstLiveKitAudioFrameCapturedAtMs
      : null,
    msSinceGreetingResponseCreateQueued: firstGreetingResponseCreateQueuedAtMs
      ? nowMs - firstGreetingResponseCreateQueuedAtMs
      : null,
    msSinceGreetingResponseCreated: firstGreetingResponseCreatedAtMs
      ? nowMs - firstGreetingResponseCreatedAtMs
      : null,
    msSinceLatestUserSpeechStarted: latestUserSpeechStartedAtMs ? nowMs - latestUserSpeechStartedAtMs : null,
    msSinceLatestUserSpeechStopped: latestUserSpeechStoppedAtMs ? nowMs - latestUserSpeechStoppedAtMs : null,
    msSinceLatestResponseCreateQueued: latestResponseCreateQueuedAtMs
      ? nowMs - latestResponseCreateQueuedAtMs
      : null,
    msSinceLatestResponseCreated: latestResponseCreatedAtMs ? nowMs - latestResponseCreatedAtMs : null,
  });

  observeDurationMs('realtime_worker_stage_ms', roomConnectedAtMs - runtimeStartedAtMs, {
    transport: 'livekit',
    voiceProvider: 'openai_realtime_native',
    stage: 'dispatch_to_room_connected',
  });

  log.info(
    {
      roomName: input.roomName,
      model,
      voice: openAiVoice,
      audioSpeed: openAiAudioSpeed ?? null,
      inputAudioNoiseReduction: openAiInputNoiseReduction ?? null,
      inputAudioTranscription: openAiInputAudioTranscription,
      liveKitOutputGain,
      turnDetection,
    },
    'livekit_native_openai_room_connected',
  );

  initializeLogger({ pretty: false, level: resolveLiveKitAgentLogLevel() });

  const openaiPlugin = await importOpenAIPlugin().catch((error) => {
    log.error({ err: error }, 'livekit_native_openai_plugin_load_failed');
    throw new Error('livekit_native_openai_plugin_missing');
  });

  const rawOpenAiRealtimeModel = new openaiPlugin.realtime.RealtimeModel({
    apiKey,
    model: openAiModel,
    voice: openAiVoice,
    speed: openAiAudioSpeed,
    inputAudioTranscription: openAiInputAudioTranscription,
    inputAudioNoiseReduction: openAiInputNoiseReduction,
    modalities: ['audio', 'text'],
    turnDetection,
  });

  const llmWithSessionFactory = rawOpenAiRealtimeModel as unknown as {
    session?: () => RealtimeEventEmitter;
  };
  const openAiBoundSessionFactory = llmWithSessionFactory.session?.bind(rawOpenAiRealtimeModel);
  log.info(
    {
      roomName: input.roomName,
      llmConstructorName:
        (rawOpenAiRealtimeModel as { constructor?: { name?: string } }).constructor?.name ?? 'unknown',
      typeofSession: typeof llmWithSessionFactory.session,
      llmInstanceofRealtimeModel: rawOpenAiRealtimeModel instanceof agentLlm.RealtimeModel,
      willPatchRealtimeSession: Boolean(openAiBoundSessionFactory),
    },
    'livekit_native_openai_llm_constructed',
  );

  function attachOpenAiRealtimeInstrumentation(realtimeSession: RealtimeEventEmitter): RealtimeEventEmitter {
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
        if (event.type === 'response.create') {
          const nowMs = Date.now();
          latestResponseCreateQueuedAtMs = nowMs;
          log.info(
            {
              roomName: input.roomName,
              eventId: event.event_id ?? null,
              hasInstructions: Boolean(event.response?.instructions),
              currentAgentState,
              currentUserState,
              userSpeechDurationMs:
                latestUserSpeechStartedAtMs && latestUserSpeechStoppedAtMs
                  ? latestUserSpeechStoppedAtMs - latestUserSpeechStartedAtMs
                  : null,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_response_create_queued_timing',
          );
        }
        if (
          event.type === 'response.create' &&
          initialGreetingEnqueuedAtMs &&
          !firstGreetingResponseCreateQueuedAtMs
        ) {
          const nowMs = Date.now();
          firstGreetingResponseCreateQueuedAtMs = nowMs;
          log.info(
            {
              roomName: input.roomName,
              eventId: event.event_id ?? null,
              hasInstructions: Boolean(event.response?.instructions),
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_greeting_response_create_queued',
          );
        }
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

        if (
          event.type === 'response.created' &&
          initialGreetingEnqueuedAtMs &&
          !firstGreetingResponseCreatedAtMs
        ) {
          const nowMs = Date.now();
          firstGreetingResponseCreatedAtMs = nowMs;
          log.info(
            {
              roomName: input.roomName,
              responseId: event.response_id ?? null,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_greeting_response_created',
          );
        }

        if (event.type === 'response.created') {
          const nowMs = Date.now();
          latestResponseCreatedAtMs = nowMs;
          log.info(
            {
              roomName: input.roomName,
              responseId: event.response_id ?? null,
              currentAgentState,
              currentUserState,
              userSpeechDurationMs:
                latestUserSpeechStartedAtMs && latestUserSpeechStoppedAtMs
                  ? latestUserSpeechStoppedAtMs - latestUserSpeechStartedAtMs
                  : null,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_response_created_timing',
          );
        }

        if (event.type === 'input_audio_buffer.speech_started') {
          const nowMs = Date.now();
          latestUserSpeechStartedAtMs = nowMs;
          latestUserSpeechStartedDuringAgentSpeaking = currentAgentState === 'speaking';
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              currentAgentState,
              currentUserState,
              startedDuringAgentSpeaking: latestUserSpeechStartedDuringAgentSpeaking,
              msSinceAgentStartedSpeaking: latestAgentStartedSpeakingAtMs
                ? nowMs - latestAgentStartedSpeakingAtMs
                : null,
              msSinceFirstModelAudio: firstAssistantItemAtMs ? nowMs - firstAssistantItemAtMs : null,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_user_speech_started_timing',
          );
        } else if (event.type === 'input_audio_buffer.speech_stopped') {
          const nowMs = Date.now();
          latestUserSpeechStoppedAtMs = nowMs;
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              currentAgentState,
              currentUserState,
              userSpeechDurationMs: latestUserSpeechStartedAtMs ? nowMs - latestUserSpeechStartedAtMs : null,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_user_speech_stopped_timing',
          );
        }

        const isAudioStreamEvent =
          event.type === 'response.output_audio.delta' ||
          event.type === 'response.output_audio.done' ||
          event.type === 'response.audio.delta' ||
          event.type === 'response.audio.done';
        if (isAudioStreamEvent && firstOpenAiAudioStreamEventAtMs === null) {
          const nowMs = Date.now();
          firstOpenAiAudioStreamEventAtMs = nowMs;
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              responseId: event.response_id ?? null,
              itemId: event.item_id ?? null,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_first_openai_audio_stream_event',
          );
        }

        const responseAudioKey = event.response_id ?? event.item_id ?? null;
        if (isAudioStreamEvent && responseAudioKey && !responseIdsWithAudioStartedLogged.has(responseAudioKey)) {
          const nowMs = Date.now();
          responseIdsWithAudioStartedLogged.add(responseAudioKey);
          // Phase 1 anchor: mark when OpenAI started streaming audio for this response
          latestResponseAudioOpenAiAtMs = nowMs;
          latestResponseLiveKitFrameCapturedAtMs = null;
          const openAiPhaseMs = latestUserSpeechStoppedAtMs ? nowMs - latestUserSpeechStoppedAtMs : null;
          log.info(
            {
              roomName: input.roomName,
              eventType: event.type,
              responseId: event.response_id ?? null,
              itemId: event.item_id ?? null,
              currentAgentState,
              currentUserState,
              userSpeechDurationMs:
                latestUserSpeechStartedAtMs && latestUserSpeechStoppedAtMs
                  ? latestUserSpeechStoppedAtMs - latestUserSpeechStartedAtMs
                  : null,
              // Phase 1 result: speech_stopped → first OpenAI audio delta (model think time + VAD silence window)
              openAiPhaseMs,
              ...timingSnapshot(nowMs),
            },
            'livekit_native_openai_response_audio_started_timing',
          );
        }

        const shouldLogAudioDeltas = parseBoolean(process.env.AGENT_OPENAI_LOG_AUDIO_DELTAS, false);
        const isAudioDeltaEvent =
          event.type === 'response.output_audio.delta' ||
          event.type === 'response.audio.delta';
        const isDetailed =
          event.type === 'session.updated' ||
          event.type === 'response.created' ||
          event.type === 'response.done' ||
          event.type === 'response.output_item.added' ||
          event.type === 'conversation.item.added' ||
          event.type === 'conversation.item.created' ||
          event.type === 'conversation.item.input_audio_transcription.completed' ||
          event.type === 'conversation.item.input_audio_transcription.failed' ||
          (shouldLogAudioDeltas && isAudioDeltaEvent) ||
          event.type === 'response.output_audio.done' ||
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
        } else if (parseBoolean(process.env.AGENT_OPENAI_LOG_OTHER_SERVER_EVENTS, false)) {
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
  }

  class LiveKitOpenAIRealtimeModelAdapter extends agentLlm.RealtimeModel {
    readonly sampleRate = (rawOpenAiRealtimeModel as OpenAIRealtimeModelDelegate).sampleRate;
    readonly numChannels = (rawOpenAiRealtimeModel as OpenAIRealtimeModelDelegate).numChannels;
    readonly inFrameSize = (rawOpenAiRealtimeModel as OpenAIRealtimeModelDelegate).inFrameSize;
    readonly outFrameSize = (rawOpenAiRealtimeModel as OpenAIRealtimeModelDelegate).outFrameSize;

    constructor(private readonly delegate: OpenAIRealtimeModelDelegate) {
      super(delegate.capabilities);
    }

    get model(): string {
      return this.delegate.model ?? openAiModel;
    }

    override get provider(): string {
      return this.delegate.provider ?? 'openai';
    }

    session(): agentLlm.RealtimeSession {
      if (!openAiBoundSessionFactory) {
        throw new Error('livekit_native_openai_realtime_session_factory_missing');
      }
      log.info(
        { roomName: input.roomName, sessionEntry: 'adapter' },
        'livekit_native_openai_realtime_session_factory_called',
      );
      return attachOpenAiRealtimeInstrumentation(openAiBoundSessionFactory()) as unknown as agentLlm.RealtimeSession;
    }

    async close(): Promise<void> {
      await this.delegate.close?.();
    }
  }

  let llm: agentLlm.RealtimeModel | typeof rawOpenAiRealtimeModel;
  if (openAiBoundSessionFactory) {
    llm = new LiveKitOpenAIRealtimeModelAdapter(rawOpenAiRealtimeModel as OpenAIRealtimeModelDelegate);
    log.info(
      {
        roomName: input.roomName,
        adapterInstanceofRealtimeModel: llm instanceof agentLlm.RealtimeModel,
      },
      'livekit_native_openai_llm_adapter_installed',
    );
  } else {
    log.error(
      {
        roomName: input.roomName,
        llmConstructorName:
          (rawOpenAiRealtimeModel as { constructor?: { name?: string } }).constructor?.name ?? 'unknown',
        typeofSession: typeof llmWithSessionFactory.session,
      },
      'livekit_native_openai_realtime_session_method_missing_openai_plugin_mismatch',
    );
    llm = rawOpenAiRealtimeModel;
  }

  /** Realtime session is not fully wired during Agent.onEnter; greeting runs after session.start() resolves. */
  class NativeOpenAICallAgent extends agentVoice.Agent {
    constructor() {
      super({
        instructions: compactSystemInstruction(input.systemPrompt),
      });
    }
  }

  const initialGreetingText = resolveGreetingText(input);
  const initialGreetingInstructions = renderRealtimeGreetingInstructions(initialGreetingText);
  log.info(
    {
      roomName: input.roomName,
      promptGreetingConfigured: Boolean(
        extractPromptLineValue(input.systemPrompt, ['WELCOME MESSAGE', 'INITIAL GREETING', 'OPENING GREETING']),
      ),
      promptShopName: extractShopNameFromSystemPrompt(input.systemPrompt),
      greetingLength: initialGreetingText.length,
    },
    'livekit_native_openai_initial_greeting_resolved',
  );

  const agent = new NativeOpenAICallAgent();

  const agentSessionOptions = resolveLiveKitAgentSessionOptions();
  log.info(
    {
      roomName: input.roomName,
      ...agentSessionOptions,
    },
    'livekit_native_openai_agent_session_options_resolved',
  );
  const session = new agentVoice.AgentSession({ llm, ...agentSessionOptions });
  const sessionLlm = (session as unknown as { llm?: unknown }).llm;
  log.info(
    {
      roomName: input.roomName,
      llmInstanceofRealtimeModel: llm instanceof agentLlm.RealtimeModel,
      sessionLlmConstructorName:
        (sessionLlm as { constructor?: { name?: string } } | undefined)?.constructor?.name ?? 'unknown',
      sessionLlmSameObject: sessionLlm === llm,
      sessionLlmHasSession: typeof (sessionLlm as { session?: unknown } | undefined)?.session,
      sessionLlmInstanceofRealtimeModel: sessionLlm instanceof agentLlm.RealtimeModel,
    },
    'livekit_native_openai_agent_session_constructed',
  );
  let boundParticipantIdentity: string | null = null;
  let answeredParticipantIdentity: string | null = null;
  let preAnswerShutdownRequested = false;
  let preAnswerShutdownReason: string | null = null;
  let resolveSessionClose: () => void = () => {};

  const bindRoomIoParticipant = (participantIdentity: string, source: string): void => {
    const roomIo = (session as unknown as { _roomIO?: { setParticipant?: (identity: string) => void } })._roomIO;
    if (typeof roomIo?.setParticipant !== 'function') return;
    roomIo.setParticipant(participantIdentity);
    log.info(
      {
        roomName: input.roomName,
        participantIdentity,
        source,
      },
      'livekit_native_openai_room_io_participant_bound',
    );
  };

  const installOutputGain = (): void => {
    const roomIo = (
      session as unknown as {
        _roomIO?: {
          audioOutput?: {
            captureFrame?: (frame: AudioFrame) => Promise<void>;
            __ringbookerOutputProcessingInstalled?: boolean;
          };
        };
      }
    )._roomIO;
    const audioOutput = roomIo?.audioOutput;
    if (!audioOutput?.captureFrame || audioOutput.__ringbookerOutputProcessingInstalled) return;

    const originalCaptureFrame = audioOutput.captureFrame.bind(audioOutput);
    audioOutput.captureFrame = async (frame: AudioFrame) => {
      const captureStartedAtMs = Date.now();
      const isFirstFrameGlobal = firstLiveKitAudioFrameCaptureStartedAtMs === null;
      const isFirstFrameForLatestResponse =
        latestResponseAudioOpenAiAtMs !== null && latestResponseLiveKitFrameCapturedAtMs === null;

      if (isFirstFrameGlobal) {
        firstLiveKitAudioFrameCaptureStartedAtMs = captureStartedAtMs;
        log.info(
          {
            roomName: input.roomName,
            gain: liveKitOutputGain,
            sampleRate: frame.sampleRate,
            channels: frame.channels,
            samplesPerChannel: frame.samplesPerChannel,
            frameSamples: frame.data.length,
            openAiAudioToLiveKitAudioFrameCaptureStartMs: firstOpenAiAudioStreamEventAtMs
              ? captureStartedAtMs - firstOpenAiAudioStreamEventAtMs
              : null,
            ...timingSnapshot(captureStartedAtMs),
          },
          'livekit_native_openai_first_livekit_audio_frame_capture_started',
        );
      }

      const processedFrame = liveKitOutputGain === 1 ? frame : applyOutputGain(frame, liveKitOutputGain);
      await originalCaptureFrame(processedFrame);
      const capturedAtMs = Date.now();

      if (isFirstFrameGlobal && firstLiveKitAudioFrameCapturedAtMs === null) {
        firstLiveKitAudioFrameCapturedAtMs = capturedAtMs;
        log.info(
          {
            roomName: input.roomName,
            gain: liveKitOutputGain,
            captureFrameDurationMs: capturedAtMs - captureStartedAtMs,
            openAiAudioToLiveKitAudioFrameCapturedMs: firstOpenAiAudioStreamEventAtMs
              ? capturedAtMs - firstOpenAiAudioStreamEventAtMs
              : null,
            liveKitAudioFrameCaptureStartToCapturedMs: firstLiveKitAudioFrameCaptureStartedAtMs
              ? capturedAtMs - firstLiveKitAudioFrameCaptureStartedAtMs
              : null,
            ...timingSnapshot(capturedAtMs),
          },
          'livekit_native_openai_first_livekit_audio_frame_captured',
        );
      }

      // Phase 2 per-turn: first LiveKit frame captured after the latest response's OpenAI audio started
      if (isFirstFrameForLatestResponse && latestResponseLiveKitFrameCapturedAtMs === null) {
        latestResponseLiveKitFrameCapturedAtMs = capturedAtMs;
        const liveKitPhaseMs = latestResponseAudioOpenAiAtMs
          ? capturedAtMs - latestResponseAudioOpenAiAtMs
          : null;
        log.info(
          {
            roomName: input.roomName,
            // Phase 2 result: first OpenAI audio delta → first LK frame enqueued (LiveKit buffer + encode time)
            liveKitPhaseMs,
            // Phase 3 lower bound: outputQueue is the minimum before SIP sends audio to caller
            outputQueueSizeMsConfig: outputQueueSizeMsResolved,
            sipPhaseNote: 'not_measurable_server_side',
            ...timingSnapshot(capturedAtMs),
          },
          'livekit_native_openai_response_livekit_phase_timing',
        );
      }
    };
    audioOutput.__ringbookerOutputProcessingInstalled = true;
    log.info(
      {
        roomName: input.roomName,
        gain: liveKitOutputGain,
      },
      'livekit_native_openai_output_capture_instrumentation_installed',
    );
    if (liveKitOutputGain === 1) return;
    log.info(
      {
        roomName: input.roomName,
        gain: liveKitOutputGain,
      },
      'livekit_native_openai_output_gain_installed',
    );
  };

  let sessionStarted = false;
  const startAgentSession = async (placement: 'pre_answer_warmup' | 'post_answer_fallback'): Promise<void> => {
    if (sessionStarted) return;
    const sessionStartBeginMs = Date.now();
    const outputQueueSizeMs = Math.max(
      100,
      Math.round(parseNumber(process.env.AGENT_LIVEKIT_OUTPUT_QUEUE_MS, 300)),
    );
    outputQueueSizeMsResolved = outputQueueSizeMs;
    log.info(
      {
        roomName: input.roomName,
        placement,
        participantIdentity: boundParticipantIdentity ?? null,
        outputQueueSizeMs,
        ...timingSnapshot(sessionStartBeginMs),
      },
      'livekit_native_openai_session_start_requested',
    );
    try {
      await session.start({
        agent,
        room,
        inputOptions: {
          participantIdentity: boundParticipantIdentity ?? undefined,
          closeOnDisconnect: true,
        },
        outputOptions: {
          queueSizeMs: outputQueueSizeMs,
        },
      });
      sessionStarted = true;
      sessionStartedAtMs = Date.now();
      installOutputGain();
      log.info(
        {
          roomName: input.roomName,
          placement,
          sessionStartDurationMs: sessionStartedAtMs - sessionStartBeginMs,
          msBeforeAnswer: callAnsweredAtMs ? null : Date.now() - sessionStartBeginMs,
          ...timingSnapshot(sessionStartedAtMs),
        },
        'livekit_native_openai_session_started',
      );
      if (preAnswerShutdownRequested) {
        log.info(
          {
            roomName: input.roomName,
            placement,
            shutdownReason: preAnswerShutdownReason,
          },
          'livekit_native_openai_session_shutdown_after_late_prewarm',
        );
        session.shutdown({ drain: false });
      }
    } catch (error) {
      log.error(
        {
          err: error,
          roomName: input.roomName,
          placement,
          sessionStartDurationMs: Date.now() - sessionStartBeginMs,
        },
        'livekit_native_openai_session_start_failed',
      );
      throw error;
    }
  };

  const enqueueInitialGreetingAfterSessionReady = (): void => {
    const nowMs = Date.now();
    initialGreetingEnqueuedAtMs = nowMs;
    const greetingHandle = session.generateReply({
      instructions: initialGreetingInstructions,
    });
    log.info(
      {
        roomName: input.roomName,
        speechHandleId: greetingHandle.id,
        placement: 'after_session_start',
        ...timingSnapshot(nowMs),
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
          firstModelAudioSeen: Boolean(firstAssistantItemAtMs),
          ...timingSnapshot(Date.now()),
        },
        'livekit_native_openai_initial_greeting_reply_done',
      );
    });
    const waitMs = Math.max(2000, Math.round(parseNumber(process.env.AGENT_OPENAI_GREETING_AUDIO_WAIT_MS, 8000)));
    setTimeout(() => {
      if (firstAssistantItemAtMs) return;
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
  let rejectAnsweredParticipant!: (error: Error) => void;
  const answeredParticipantPromise = new Promise<string>((resolve, reject) => {
    resolveAnsweredParticipant = resolve;
    rejectAnsweredParticipant = reject;
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
    callAnsweredAtMs ??= Date.now();
    const nowMs = Date.now();
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
        ...timingSnapshot(nowMs),
      },
      'livekit_native_openai_call_answered',
    );
    if (!answeredParticipantResolved) {
      answeredParticipantResolved = true;
      resolveAnsweredParticipant(participant.identity);
    }
  };

  const markParticipantEndedBeforeAnswer = (
    participant: {
      identity: string;
      attributes?: Record<string, string>;
      info?: { kind?: number };
    },
    source: string,
  ) => {
    if (callAnsweredAtMs || answeredParticipantResolved || !isSipParticipant(participant)) return;

    preAnswerShutdownRequested = true;
    preAnswerShutdownReason = `${source}:${getSipCallStatus(participant) ?? 'unknown'}`;
    answeredParticipantResolved = true;
    log.info(
      {
        roomName: input.roomName,
        participantIdentity: participant.identity,
        source,
        sipCallStatus: getSipCallStatus(participant),
        sessionStarted,
      },
      'livekit_native_openai_call_ended_before_answer',
    );
    rejectAnsweredParticipant(new Error('livekit_native_openai_call_ended_before_answer'));
    if (sessionStarted) {
      session.shutdown({ drain: false });
    }
    resolveSessionClose();
    void room.disconnect().catch(() => {});
  };

  session.on(agentVoice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
    log.info(
      {
        roomName: input.roomName,
        transcript: ev.transcript ?? null,
        rawUserTranscript: ev.transcript ?? null,
        normalizedUserText: ev.transcript ? normalizePromptValue(ev.transcript) : null,
        transcriptionModel: openAiInputAudioTranscription?.model ?? null,
        languageHint: openAiInputAudioTranscription?.language ?? null,
        isFinal: ev.isFinal,
        currentAgentState,
        currentUserState,
        msSinceUserSpeechStarted: latestUserSpeechStartedAtMs ? Date.now() - latestUserSpeechStartedAtMs : null,
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
          ...timingSnapshot(nowMs),
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
      if (!firstAssistantItemAtMs) {
        firstAssistantItemAtMs = nowMs;
        // NOTE: this fires when the FULL response transcript is finalized, not when audio starts.
        // For audio-start timing, use livekit_native_openai_response_audio_started_timing (openAiPhaseMs)
        // and livekit_native_openai_response_livekit_phase_timing (liveKitPhaseMs).
        log.info(
          {
            roomName: input.roomName,
            dispatchToFirstAssistantItemMs: nowMs - runtimeStartedAtMs,
            roomConnectedToFirstAssistantItemMs: nowMs - roomConnectedAtMs,
            callAnsweredToFirstAssistantItemMs: callAnsweredAtMs ? nowMs - callAnsweredAtMs : null,
            initialGreetingEnqueuedToFirstAssistantItemMs: initialGreetingEnqueuedAtMs
              ? nowMs - initialGreetingEnqueuedAtMs
              : null,
            openAiAudioStreamToFirstAssistantItemMs: firstOpenAiAudioStreamEventAtMs
              ? nowMs - firstOpenAiAudioStreamEventAtMs
              : null,
            firstUserSpeechToFirstAssistantItemMs: firstUserSpeechAtMs ? nowMs - firstUserSpeechAtMs : null,
            ...timingSnapshot(nowMs),
          },
          'livekit_native_openai_first_assistant_item_finalized',
        );
        observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
          transport: 'livekit',
          voiceProvider: 'openai_realtime_native',
          stage: 'dispatch_to_first_assistant_item',
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
    const nowMs = Date.now();
    currentUserState = ev.newState;
    log.info(
      {
        roomName: input.roomName,
        oldState: ev.oldState,
        newState: ev.newState,
        ...timingSnapshot(nowMs),
      },
      'livekit_native_openai_user_state_changed',
    );
  });

  session.on(agentVoice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
    const nowMs = Date.now();
    currentAgentState = ev.newState;
    if (ev.newState === 'speaking') {
      latestAgentStartedSpeakingAtMs = nowMs;
    }
    if (ev.oldState === 'speaking' && ev.newState !== 'speaking') {
      latestAgentStoppedSpeakingAtMs = nowMs;
      if (latestUserSpeechStartedAtMs) {
        log.info(
          {
            roomName: input.roomName,
            oldState: ev.oldState,
            newState: ev.newState,
            startedDuringAgentSpeaking: latestUserSpeechStartedDuringAgentSpeaking,
            userSpeechStartToAgentStopSpeakingMs: nowMs - latestUserSpeechStartedAtMs,
            agentSpeakingDurationMs: latestAgentStartedSpeakingAtMs ? nowMs - latestAgentStartedSpeakingAtMs : null,
            ...timingSnapshot(nowMs),
          },
          latestUserSpeechStartedDuringAgentSpeaking
            ? 'livekit_native_openai_interruption_timing'
            : 'livekit_native_openai_assistant_turn_completion_timing',
        );
        latestUserSpeechStartedDuringAgentSpeaking = false;
      }
    }
    log.info(
      {
        roomName: input.roomName,
        oldState: ev.oldState,
        newState: ev.newState,
        msSinceUserSpeechStarted: latestUserSpeechStartedAtMs ? nowMs - latestUserSpeechStartedAtMs : null,
        msSinceAgentStartedSpeaking: latestAgentStartedSpeakingAtMs ? nowMs - latestAgentStartedSpeakingAtMs : null,
        msSinceAgentStoppedSpeaking: latestAgentStoppedSpeakingAtMs ? nowMs - latestAgentStoppedSpeakingAtMs : null,
        ...timingSnapshot(nowMs),
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
        currentAgentState,
        currentUserState,
        msSinceUserSpeechStarted: latestUserSpeechStartedAtMs ? Date.now() - latestUserSpeechStartedAtMs : null,
        msSinceAgentStartedSpeaking: latestAgentStartedSpeakingAtMs ? Date.now() - latestAgentStartedSpeakingAtMs : null,
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

  const sessionClosePromise = new Promise<void>((resolve) => {
    resolveSessionClose = resolve;
  });

  session.once(agentVoice.AgentSessionEventTypes.Close, (ev) => {
      if (ev.error) {
        log.error(
          {
            err: ev.error,
            reason: ev.reason,
            activeCallDurationMs: callAnsweredAtMs ? Date.now() - callAnsweredAtMs : null,
            firstModelAudioSeen: Boolean(firstAssistantItemAtMs),
            firstUserSpeechSeen: Boolean(firstUserSpeechAtMs),
          },
          'livekit_native_openai_session_closed_with_error',
        );
      } else {
        log.info(
          {
            reason: ev.reason,
            activeCallDurationMs: callAnsweredAtMs ? Date.now() - callAnsweredAtMs : null,
            firstModelAudioSeen: Boolean(firstAssistantItemAtMs),
            firstUserSpeechSeen: Boolean(firstUserSpeechAtMs),
          },
          'livekit_native_openai_session_closed',
        );
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
      const sipCallStatus = getSipCallStatus(participant);
      log.info(
        {
          roomName: input.roomName,
          participantIdentity: participant.identity,
          sipCallStatus,
          isLocal: participant.identity === room.localParticipant?.identity,
          activeCallDurationMs: callAnsweredAtMs ? Date.now() - callAnsweredAtMs : null,
          firstModelAudioSeen: Boolean(firstAssistantItemAtMs),
          firstUserSpeechSeen: Boolean(firstUserSpeechAtMs),
        },
        'livekit_native_openai_participant_disconnected',
      );
      markParticipantEndedBeforeAnswer(participant, 'participant_disconnected');
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
        if (participant.attributes['sip.callStatus'] === 'hangup') {
          markParticipantEndedBeforeAnswer(participant, 'participant_attributes_changed');
        }
      }
    });

  room.on(RoomEvent.LocalTrackSubscribed, (track) => {
      const nowMs = Date.now();
      log.info(
        {
          trackName: track.name,
          trackSid: track.sid,
          ...timingSnapshot(nowMs),
        },
        'livekit_native_openai_local_track_subscribed',
      );
      if (track.name !== 'roomio_audio') return;
      outputReadyAtMs ??= nowMs;
      log.info(
        {
          roomName: input.roomName,
          trackName: track.name,
          trackSid: track.sid,
          ...timingSnapshot(nowMs),
        },
        'livekit_native_openai_output_ready',
      );
    });

  const forceResolveOutputSubscription = parseBoolean(
    process.env.AGENT_LIVEKIT_FORCE_RESOLVE_OUTPUT_SUBSCRIPTION,
    true,
  );
  const subscriptionForceResolveMs = Math.max(
    100,
    Math.round(parseNumber(process.env.AGENT_LIVEKIT_FORCE_RESOLVE_OUTPUT_SUBSCRIPTION_MS, 250)),
  );
  room.on(RoomEvent.LocalTrackPublished, (publication) => {
      log.info(
        {
          roomName: input.roomName,
          trackName: publication.track?.name ?? null,
          trackSid: publication.track?.sid ?? null,
          source: publication.source,
          forceResolveOutputSubscription,
          ...timingSnapshot(Date.now()),
        },
        'livekit_native_openai_local_track_published',
      );
      if (!forceResolveOutputSubscription) return;
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

  let preAnswerSessionStartError: unknown;
  const shouldPrewarmBeforeAnswer = parseBoolean(process.env.AGENT_OPENAI_PREWARM_BEFORE_ANSWER, true);
  const preAnswerSessionStartPromise = shouldPrewarmBeforeAnswer
    ? startAgentSession('pre_answer_warmup').catch((error) => {
        preAnswerSessionStartError = error;
      })
    : Promise.resolve();

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
  bindRoomIoParticipant(answeredIdentity, 'call_answered_before_greeting');

  log.info(
    {
      roomName: input.roomName,
      participantIdentity: boundParticipantIdentity,
      prewarmEnabled: shouldPrewarmBeforeAnswer,
      sessionStarted,
      ...timingSnapshot(Date.now()),
    },
    'livekit_native_openai_binding_participant_identity',
  );

  await preAnswerSessionStartPromise;
  if (preAnswerSessionStartError) {
    throw preAnswerSessionStartError;
  }
  if (!sessionStarted) {
    await startAgentSession('post_answer_fallback');
  }
  bindRoomIoParticipant(answeredIdentity, 'call_answered_after_session_start');
  log.info(
    {
      roomName: input.roomName,
      participantIdentity: answeredIdentity,
      sessionStarted,
      ...timingSnapshot(Date.now()),
    },
    'livekit_native_openai_ready_to_enqueue_initial_greeting',
  );
  enqueueInitialGreetingAfterSessionReady();

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

  log.info(
    {
      roomName: input.roomName,
      answeredParticipantIdentity,
      sessionStartedAtMs,
      outputReadyAtMs,
      // ── Greeting latency breakdown (call answered → caller hears first word) ──────────────────
      // Phase 1 (OpenAI): greeting enqueued → first OpenAI audio delta
      greetingOpenAiPhaseMs:
        initialGreetingEnqueuedAtMs && firstOpenAiAudioStreamEventAtMs
          ? firstOpenAiAudioStreamEventAtMs - initialGreetingEnqueuedAtMs
          : null,
      // Phase 2 (LiveKit): first OpenAI audio delta → first LK frame enqueued
      greetingLiveKitPhaseMs:
        firstOpenAiAudioStreamEventAtMs && firstLiveKitAudioFrameCapturedAtMs
          ? firstLiveKitAudioFrameCapturedAtMs - firstOpenAiAudioStreamEventAtMs
          : null,
      // Phase 3 (SIP): lower bound only — outputQueueMs + network/SIP jitter (not measurable server-side)
      greetingSipPhaseLowerBoundMs: outputQueueSizeMsResolved,
      greetingSipPhaseNote: 'actual_sip_delay_not_measurable_server_side',
      // Total measurable: call answered → first LK frame captured (excludes SIP phase)
      callAnsweredToFirstLiveKitFrameMs:
        callAnsweredAtMs && firstLiveKitAudioFrameCapturedAtMs
          ? firstLiveKitAudioFrameCapturedAtMs - callAnsweredAtMs
          : null,
      // ── Per-turn latency: see livekit_native_openai_response_audio_started_timing (openAiPhaseMs)
      //    and livekit_native_openai_response_livekit_phase_timing (liveKitPhaseMs) ──────────────
      // ── Misc ─────────────────────────────────────────────────────────────────────────────────
      callAnsweredToOutputReadyMs:
        callAnsweredAtMs && outputReadyAtMs ? outputReadyAtMs - callAnsweredAtMs : null,
      callAnsweredToInitialGreetingEnqueuedMs:
        callAnsweredAtMs && initialGreetingEnqueuedAtMs ? initialGreetingEnqueuedAtMs - callAnsweredAtMs : null,
      // firstAssistantItemAtMs = when first assistant transcript finalized (NOT audio start — use greetingOpenAiPhaseMs)
      callAnsweredToFirstAssistantItemMs:
        callAnsweredAtMs && firstAssistantItemAtMs ? firstAssistantItemAtMs - callAnsweredAtMs : null,
      activeCallDurationMs: callAnsweredAtMs ? Date.now() - callAnsweredAtMs : null,
      firstAssistantItemSeen: Boolean(firstAssistantItemAtMs),
      firstLiveKitAudioFrameCapturedSeen: Boolean(firstLiveKitAudioFrameCapturedAtMs),
      firstUserSpeechSeen: Boolean(firstUserSpeechAtMs),
    },
    'livekit_native_openai_session_finished',
  );
}
