/**
 * LiveKit Native Gemini Room Runtime
 *
 * Replaces the custom PCM bridge (livekit-room-runtime.ts + gemini-live-text-bridge.ts)
 * with the @livekit/agents framework + @livekit/agents-plugin-google RealtimeModel.
 *
 * This eliminates:
 * - Manual AudioSource / captureFrame path and its InvalidState recovery
 * - Manual PCM uplink/downlink chunking
 * - Custom Gemini Live WebSocket PCM bridge
 *
 * Audio routing (room ↔ Gemini) is handled natively by the AgentSession.
 */

import {
  ActivityHandling,
  Modality,
  TurnCoverage,
  type RealtimeInputConfig,
  EndSensitivity,
  StartSensitivity,
  ThinkingLevel,
} from '@google/genai';
import { beta } from '@livekit/agents-plugin-google';
import { voice as agentVoice, llm } from '@livekit/agents';
import { Room, RoomEvent } from '@livekit/rtc-node';

import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';
import { withLogContext } from '@/src/backend/observability/logger';
import { observeDurationMs } from '@/src/backend/observability/metrics';
import type { ToolError } from '@/src/backend/domain/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS = 7000;
const DEFAULT_MAX_TOOL_RESPONSE_CHARS = 3000;
const CONSTRAINED_POLICY =
  '\n\nHARD POLICY: Only use data from this call context and tool outputs. If out-of-scope, refuse briefly and offer callback/transfer.';

// ─── Utility: system prompt ─────────────────────────────────────────────────

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function compactSystemInstruction(raw: string): string {
  const maxCharsRaw = Number(process.env.AGENT_GEMINI_SYSTEM_PROMPT_MAX_CHARS ?? DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw >= 1000 ? maxCharsRaw : DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS;
  const compacted = normalizeWhitespace(raw);
  if (compacted.length <= maxChars) return `${compacted}${CONSTRAINED_POLICY}`;
  return `${compacted.slice(0, maxChars)}…${CONSTRAINED_POLICY}`;
}

// ─── Utility: voice resolution ──────────────────────────────────────────────

function resolveGeminiVoice(systemPrompt: string): string {
  const envVoice = process.env.AGENT_GEMINI_VOICE?.trim();
  if (envVoice) return envVoice;
  const match = systemPrompt.match(/(?:^|\n)VOICE STYLE:\s*([^\n]+)/i);
  const promptVoice = match?.[1]?.trim();
  if (promptVoice && promptVoice.toLowerCase() !== 'not provided') return promptVoice;
  return 'Puck';
}

// ─── Utility: model resolution ──────────────────────────────────────────────

function resolveGeminiModel(input: RealtimeDispatchInput): string | null {
  const fromMetadata = (input.realtime.metadata as { dispatchPayload?: { llm?: { model?: string } } } | undefined)
    ?.dispatchPayload?.llm?.model;
  return fromMetadata ?? process.env.AGENT_GEMINI_MODEL ?? null;
}

// ─── Utility: VAD / realtimeInputConfig ─────────────────────────────────────

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const n = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(n)) return true;
  if (['0', 'false', 'no', 'off'].includes(n)) return false;
  return defaultValue;
}

function parseThinkingLevel(value: string | undefined): ThinkingLevel {
  const n = value?.trim().toLowerCase();
  if (n === 'high') return ThinkingLevel.HIGH;
  if (n === 'medium') return ThinkingLevel.MEDIUM;
  if (n === 'low') return ThinkingLevel.LOW;
  return ThinkingLevel.MINIMAL;
}

function parseStartSensitivity(value: string | undefined): StartSensitivity {
  return value?.trim().toLowerCase() === 'high'
    ? StartSensitivity.START_SENSITIVITY_HIGH
    : StartSensitivity.START_SENSITIVITY_LOW;
}

function parseEndSensitivity(value: string | undefined): EndSensitivity {
  return value?.trim().toLowerCase() === 'high'
    ? EndSensitivity.END_SENSITIVITY_HIGH
    : EndSensitivity.END_SENSITIVITY_LOW;
}

function buildRealtimeInputConfig(): RealtimeInputConfig {
  const latencyPreset = process.env.AGENT_GEMINI_LATENCY_PRESET?.trim().toLowerCase() === 'ultra_low_latency'
    ? 'ultra_low_latency'
    : 'balanced';

  const presetDefaults =
    latencyPreset === 'ultra_low_latency'
      ? { startSens: StartSensitivity.START_SENSITIVITY_HIGH, endSens: EndSensitivity.END_SENSITIVITY_HIGH, prefix: 10, silence: 60 }
      : { startSens: StartSensitivity.START_SENSITIVITY_LOW, endSens: EndSensitivity.END_SENSITIVITY_LOW, prefix: 20, silence: 100 };

  const startSens = process.env.AGENT_GEMINI_VAD_START_SENSITIVITY
    ? parseStartSensitivity(process.env.AGENT_GEMINI_VAD_START_SENSITIVITY)
    : presetDefaults.startSens;
  const endSens = process.env.AGENT_GEMINI_VAD_END_SENSITIVITY
    ? parseEndSensitivity(process.env.AGENT_GEMINI_VAD_END_SENSITIVITY)
    : presetDefaults.endSens;
  const prefixMs = Math.max(0, Number(process.env.AGENT_GEMINI_VAD_PREFIX_MS ?? presetDefaults.prefix));
  const silenceMs = Math.max(1, Number(process.env.AGENT_GEMINI_VAD_SILENCE_MS ?? presetDefaults.silence));

  return {
    activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
    turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
    automaticActivityDetection: {
      disabled: false,
      startOfSpeechSensitivity: startSens,
      endOfSpeechSensitivity: endSens,
      prefixPaddingMs: prefixMs,
      silenceDurationMs: silenceMs,
    },
  };
}

// ─── Utility: compact tool output ───────────────────────────────────────────

function compactToolOutput(value: unknown): unknown {
  const maxCharsRaw = Number(process.env.AGENT_GEMINI_TOOL_OUTPUT_MAX_CHARS ?? DEFAULT_MAX_TOOL_RESPONSE_CHARS);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw >= 500 ? maxCharsRaw : DEFAULT_MAX_TOOL_RESPONSE_CHARS;

  const prune = (input: unknown, depth = 0): unknown => {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') {
      const cleaned = normalizeWhitespace(input);
      return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}…` : cleaned;
    }
    if (typeof input === 'number' || typeof input === 'boolean') return input;
    if (Array.isArray(input)) {
      const sliced = input.slice(0, 20).map((item) => prune(item, depth + 1));
      if (input.length > 20) sliced.push(`[truncated:${input.length - 20}]`);
      return sliced;
    }
    if (typeof input === 'object') {
      if (depth >= 4) return '[truncated:depth]';
      const entries = Object.entries(input as Record<string, unknown>).slice(0, 30);
      const out: Record<string, unknown> = {};
      for (const [k, v] of entries) out[k] = prune(v, depth + 1);
      return out;
    }
    return String(input);
  };

  const pruned = prune(value);
  const serialized = JSON.stringify(pruned);
  if (!serialized || serialized.length <= maxChars) return pruned;
  return { output: `${serialized.slice(0, maxChars)}…`, truncated: true };
}

// ─── Utility: extract text from ChatContent ─────────────────────────────────

function extractTextFromChatContent(content: unknown[]): string {
  return content
    .map((c) => {
      if (typeof c === 'string') return c;
      if (c && typeof c === 'object') {
        if ('transcript' in c && typeof (c as { transcript?: unknown }).transcript === 'string') {
          return (c as { transcript: string }).transcript;
        }
        if ('text' in c && typeof (c as { text?: unknown }).text === 'string') {
          return (c as { text: string }).text;
        }
      }
      return '';
    })
    .join('');
}

// ─── Utility: build tool status message ─────────────────────────────────────

function buildToolStatusMessage(toolName: string): string {
  switch (toolName) {
    case 'check_availability': return 'Checking availability now.';
    case 'create_booking': return 'Finalizing your booking now.';
    case 'reschedule_booking': return 'Checking the new appointment time now.';
    case 'transfer_to_user': return 'Connecting you to the user now.';
    case 'schedule_callback': return 'Scheduling your callback now.';
    default: return 'Working on that now.';
  }
}

// ─── Utility: URL / token ───────────────────────────────────────────────────

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

function resolveAllowedTools(input: RealtimeDispatchInput): string[] | null {
  return (
    (
      input.realtime.metadata as
        | { dispatchPayload?: { toolPolicy?: { allowedTools?: string[] } } }
        | undefined
    )?.dispatchPayload?.toolPolicy?.allowedTools ?? null
  );
}

function resolveBlockMessage(input: RealtimeDispatchInput): string {
  return (
    (
      input.realtime.metadata as
        | { dispatchPayload?: { toolPolicy?: { blockMessage?: string } } }
        | undefined
    )?.dispatchPayload?.toolPolicy?.blockMessage ?? 'This live demo cannot perform live booking actions.'
  );
}

// ─── Build @livekit/agents ToolContext ───────────────────────────────────────

type ToolCallHandler = (input: { name: string; args: Record<string, unknown>; callId?: string }) => Promise<unknown | ToolError>;
type ToolCallStartHandler = (input: { name: string; callId?: string }) => Promise<void> | void;

// Bypass overload resolution for llm.tool() — REALTIME_TOOL_DEFINITIONS use plain JSON schema
// objects which satisfy JSONSchema7 at runtime but TypeScript can't infer the type constraint.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MakeFunctionTool = (opts: {
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parameters: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (args: any, opts: llm.ToolOptions) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}) => llm.FunctionTool<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeFunctionTool = llm.tool as unknown as MakeFunctionTool;

function buildToolContext(params: {
  room: Room;
  onToolCall?: ToolCallHandler;
  onToolCallStart?: ToolCallStartHandler;
  allowedTools: string[] | null;
  blockMessage: string;
  log: ReturnType<typeof withLogContext>;
}): llm.ToolContext {
  const { room, onToolCall, onToolCallStart, allowedTools, blockMessage, log } = params;
  const tools: llm.ToolContext = {};

  for (const def of REALTIME_TOOL_DEFINITIONS) {
    const toolName = def.name;
    tools[toolName] = makeFunctionTool({
      description: def.description,
      parameters: def.parameters,
      execute: async (args: Record<string, unknown>, opts: llm.ToolOptions) => {
        const callId = opts.toolCallId;

        // Notify tool call start
        if (onToolCallStart) {
          await onToolCallStart({ name: toolName, callId });
        }

        // Send status text to room
        const statusText = buildToolStatusMessage(toolName);
        if (statusText && room.localParticipant) {
          void room.localParticipant.sendText(statusText, { topic: 'rb.agent.status' });
        }

        // Enforce allowed tools policy
        if (Array.isArray(allowedTools) && !allowedTools.includes(toolName)) {
          return { error: blockMessage, code: 'RATE_LIMITED', retryable: false };
        }

        if (!onToolCall) {
          return { error: 'No tool handler configured.', code: 'NOT_FOUND', retryable: false };
        }

        const startedAt = Date.now();
        try {
          const output = await onToolCall({ name: toolName, args, callId });
          const durationMs = Date.now() - startedAt;
          log.info({ toolName, callId, durationMs, ok: true }, 'native_gemini_tool_call_completed');
          return compactToolOutput(output);
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          log.warn({ toolName, callId, durationMs, ok: false, err: error }, 'native_gemini_tool_call_failed');
          return {
            error: error instanceof Error ? error.message : 'tool_execution_failed',
            code: 'INTERNAL_ERROR',
            retryable: false,
          };
        }
      },
    });
  }

  return tools;
}

// ─── Main runtime ────────────────────────────────────────────────────────────

export async function runLiveKitNativeGeminiRuntime(
  input: RealtimeDispatchInput,
  options?: {
    onToolCall?: ToolCallHandler;
    onToolCallStart?: ToolCallStartHandler;
    onUserTranscript?: (text: string) => Promise<void> | void;
    onAssistantTranscript?: (text: string) => Promise<void> | void;
  },
): Promise<void> {
  const log = withLogContext({
    requestId: input.requestId,
    callId: input.realtime.sessionId,
    provider: 'livekit_native_gemini',
  });

  const livekitUrl = resolveLiveKitUrl(input);
  const joinToken = resolveJoinToken(input);
  if (!livekitUrl) throw new Error('missing_livekit_url_for_native_gemini_runtime');
  if (!joinToken) throw new Error('missing_join_token_for_native_gemini_runtime');

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const model = resolveGeminiModel(input);
  if (!apiKey || !model) throw new Error('missing_gemini_api_key_or_model_for_native_runtime');

  const voiceName = resolveGeminiVoice(input.systemPrompt);
  const instructions = compactSystemInstruction(input.systemPrompt);
  const realtimeInputConfig = buildRealtimeInputConfig();
  const thinkingLevel = parseThinkingLevel(process.env.AGENT_GEMINI_THINKING_LEVEL);
  const enableContextCompression = parseBoolean(process.env.AGENT_GEMINI_CONTEXT_COMPRESSION_ENABLED, true);
  const allowedTools = resolveAllowedTools(input);
  const blockMessage = resolveBlockMessage(input);
  const timeoutMs = Number(process.env.AGENT_WORKER_MAX_SESSION_MS ?? 30 * 60 * 1000);
  const runtimeStartedAtMs = Date.now();

  const room = new Room();

  try {
    await room.connect(livekitUrl, joinToken, { autoSubscribe: true, dynacast: false });
    const roomConnectedAtMs = Date.now();

    observeDurationMs('realtime_worker_stage_ms', roomConnectedAtMs - runtimeStartedAtMs, {
      transport: 'livekit',
      voiceProvider: 'gemini_live_native',
      stage: 'dispatch_to_room_connected',
    });

    log.info(
      { roomName: input.roomName, model, voice: voiceName },
      'livekit_native_gemini_room_connected',
    );

    // Build tool context (needs room ref for status text)
    const toolContext = buildToolContext({
      room,
      onToolCall: options?.onToolCall,
      onToolCallStart: options?.onToolCallStart,
      allowedTools,
      blockMessage,
      log,
    });

    // Create the Gemini RealtimeModel via @livekit/agents-plugin-google
    const realtimeModel = new beta.realtime.RealtimeModel({
      model,
      apiKey,
      voice: voiceName,
      modalities: [Modality.AUDIO],
      instructions,
      realtimeInputConfig,
      thinkingConfig: { thinkingLevel },
      ...(enableContextCompression ? { contextWindowCompression: { slidingWindow: {} } } : {}),
      inputAudioTranscription: {},  // Enable input transcription
      outputAudioTranscription: {}, // Enable output transcription
    });

    // Create the agent with tools
    const agent = new agentVoice.Agent({
      instructions,
      llm: realtimeModel,
      tools: toolContext,
    });

    // Create session
    const session = new agentVoice.AgentSession({});

    // ── Transcript events ────────────────────────────────────────────────────
    let firstUserSpeechAtMs: number | null = null;

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
          'livekit_native_first_user_speech_detected',
        );
        observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
          transport: 'livekit',
          voiceProvider: 'gemini_live_native',
          stage: 'dispatch_to_first_user_speech',
        });
      }

      if (options?.onUserTranscript) {
        void options.onUserTranscript(ev.transcript);
      }
    });

    let firstModelAudioAtMs: number | null = null;

    session.on(agentVoice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
      if (ev.item.role === 'assistant') {
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
            'livekit_native_first_model_audio',
          );
          observeDurationMs('realtime_worker_stage_ms', nowMs - runtimeStartedAtMs, {
            transport: 'livekit',
            voiceProvider: 'gemini_live_native',
            stage: 'dispatch_to_first_model_audio',
          });
        }

        const text = extractTextFromChatContent(ev.item.content);
        if (text && options?.onAssistantTranscript) {
          void options.onAssistantTranscript(text);
        }

        // Mirror assistant text to room text channel
        if (text && room.localParticipant) {
          void room.localParticipant.sendText(text, { topic: 'rb.agent.text' });
        }
      }
    });

    session.on(agentVoice.AgentSessionEventTypes.Error, (ev) => {
      log.error({ err: ev.error }, 'livekit_native_gemini_session_error');
    });

    // ── Wait-for-close setup ─────────────────────────────────────────────────
    // session.start() is NON-BLOCKING: it sets up RoomIO and returns immediately.
    // We must wait for the `Close` event (fired by closeImplInner after caller
    // hangs up → SIP participant disconnects → RoomIO._closeSoon() → Close event).
    // Register listener BEFORE start() to avoid missing early-close race.
    let resolveSessionClose!: () => void;
    const sessionClosePromise = new Promise<void>((resolve) => {
      resolveSessionClose = resolve;
    });
    session.once(agentVoice.AgentSessionEventTypes.Close, (ev) => {
      if (ev.error) {
        log.error({ err: ev.error, reason: ev.reason }, 'livekit_native_gemini_session_closed_with_error');
      } else {
        log.info({ reason: ev.reason }, 'livekit_native_gemini_session_closed');
      }
      resolveSessionClose();
    });
    // Fallback: if room itself disconnects (e.g. room deleted by server),
    // resolve so worker doesn't hang.
    room.once(RoomEvent.Disconnected, () => resolveSessionClose());

    // ── Start session (non-blocking setup) ───────────────────────────────────
    await session.start({ agent, room });

    // ── Timeout guard ────────────────────────────────────────────────────────
    const timeoutHandle = setTimeout(() => {
      log.warn({ timeoutMs, roomName: input.roomName }, 'livekit_native_gemini_session_timeout');
      resolveSessionClose();          // Unblock the wait below
      void room.disconnect().catch(() => {});
    }, timeoutMs);

    // ── Block until caller hangs up (Close event) or timeout ─────────────────
    try {
      await sessionClosePromise;
    } finally {
      clearTimeout(timeoutHandle);
    }

    log.info({ roomName: input.roomName }, 'livekit_native_gemini_session_finished');
  } finally {
    await room.disconnect().catch(() => {});
  }
}
