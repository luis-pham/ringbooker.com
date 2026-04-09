import {
  ActivityHandling,
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  ThinkingLevel,
  TurnCoverage,
  type FunctionDeclaration,
} from '@google/genai';
import type { Room } from '@livekit/rtc-node';

import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import type {
  CreateRealtimeVoiceBridgeParams,
  RealtimeToolCallInput,
  RealtimeVoiceBridge,
} from '@/src/agent/realtime/providers/types';
import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';
import { withLogContext } from '@/src/backend/observability/logger';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';

const DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS = 7000;
const DEFAULT_MAX_TOOL_RESPONSE_CHARS = 3000;

const TOOL_DECLARATIONS: FunctionDeclaration[] = REALTIME_TOOL_DEFINITIONS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.parameters,
}));

function int16ToBase64(input: Int16Array): string {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return Buffer.from(bytes).toString('base64');
}

function base64ToInt16(input: string): Int16Array {
  const buffer = Buffer.from(input, 'base64');
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const alignedLength = Math.floor(bytes.byteLength / 2);
  const view = new Int16Array(alignedLength);
  for (let i = 0; i < alignedLength; i += 1) {
    const lo = bytes[i * 2] ?? 0;
    const hi = bytes[i * 2 + 1] ?? 0;
    view[i] = (hi << 8) | lo;
  }
  return view;
}

function parsePcmRateFromMimeType(mimeType: string | undefined): number | null {
  if (!mimeType) return null;
  const lower = mimeType.toLowerCase();
  if (!lower.startsWith('audio/pcm')) return null;
  const match = lower.match(/rate=(\d+)/);
  if (!match) return 24000;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : 24000;
}

function parseThinkingLevel(value: string | undefined): ThinkingLevel {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'high') return ThinkingLevel.HIGH;
  if (normalized === 'medium') return ThinkingLevel.MEDIUM;
  if (normalized === 'low') return ThinkingLevel.LOW;
  return ThinkingLevel.MINIMAL;
}

function parseStartSensitivity(value: string | undefined): StartSensitivity {
  return value?.trim().toLowerCase() === 'high' ? StartSensitivity.START_SENSITIVITY_HIGH : StartSensitivity.START_SENSITIVITY_LOW;
}

function parseEndSensitivity(value: string | undefined): EndSensitivity {
  return value?.trim().toLowerCase() === 'high' ? EndSensitivity.END_SENSITIVITY_HIGH : EndSensitivity.END_SENSITIVITY_LOW;
}

function parseLatencyPreset(value: string | undefined): 'balanced' | 'ultra_low_latency' {
  return value?.trim().toLowerCase() === 'ultra_low_latency' ? 'ultra_low_latency' : 'balanced';
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function compactSystemInstruction(raw: string): string {
  const maxCharsRaw = Number(process.env.AGENT_GEMINI_SYSTEM_PROMPT_MAX_CHARS ?? DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw >= 1000 ? maxCharsRaw : DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS;
  const constrainedPolicy =
    '\n\nHARD POLICY: Only use data from this call context and tool outputs. If out-of-scope, refuse briefly and offer callback/transfer.';
  const compacted = normalizeWhitespace(raw);
  if (compacted.length <= maxChars) return `${compacted}${constrainedPolicy}`;
  return `${compacted.slice(0, maxChars)}…${constrainedPolicy}`;
}

function compactToolOutput(value: unknown): unknown {
  const maxCharsRaw = Number(process.env.AGENT_GEMINI_TOOL_OUTPUT_MAX_CHARS ?? DEFAULT_MAX_TOOL_RESPONSE_CHARS);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw >= 500 ? maxCharsRaw : DEFAULT_MAX_TOOL_RESPONSE_CHARS;
  const maxArrayItems = 20;
  const maxObjectKeys = 30;

  const prune = (input: unknown, depth = 0): unknown => {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') {
      const cleaned = normalizeWhitespace(input);
      return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}…` : cleaned;
    }
    if (typeof input === 'number' || typeof input === 'boolean') return input;
    if (Array.isArray(input)) {
      const sliced = input.slice(0, maxArrayItems).map((item) => prune(item, depth + 1));
      if (input.length > maxArrayItems) {
        sliced.push(`[truncated:${input.length - maxArrayItems}]`);
      }
      return sliced;
    }
    if (typeof input === 'object') {
      if (depth >= 4) return '[truncated:depth]';
      const entries = Object.entries(input as Record<string, unknown>).slice(0, maxObjectKeys);
      const out: Record<string, unknown> = {};
      for (const [key, val] of entries) {
        out[key] = prune(val, depth + 1);
      }
      const totalKeys = Object.keys(input as Record<string, unknown>).length;
      if (totalKeys > maxObjectKeys) {
        out.__truncatedKeys = totalKeys - maxObjectKeys;
      }
      return out;
    }
    return String(input);
  };

  const pruned = prune(value);
  const serialized = JSON.stringify(pruned);
  if (!serialized || serialized.length <= maxChars) return pruned;
  return {
    output: `${serialized.slice(0, maxChars)}…`,
    truncated: true,
  };
}

export async function createGeminiLiveVoiceBridge(
  params: CreateRealtimeVoiceBridgeParams,
): Promise<RealtimeVoiceBridge | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const model =
    (params.dispatch.realtime.metadata as { dispatchPayload?: { llm?: { model?: string } } } | undefined)?.dispatchPayload?.llm
      ?.model ?? process.env.AGENT_GEMINI_MODEL;

  if (!apiKey || !model) return null;

  const log = withLogContext({
    requestId: params.dispatch.requestId,
    callId: params.dispatch.realtime.sessionId,
    provider: 'gemini_live',
  });

  const ai = new GoogleGenAI({ apiKey });
  const systemInstruction = compactSystemInstruction(params.dispatch.systemPrompt);
  const room = params.room;
  let toolCallQueue = Promise.resolve();
  let lastUserTranscript = '';
  let lastAssistantTranscript = '';
  const latencyPreset = parseLatencyPreset(process.env.AGENT_GEMINI_LATENCY_PRESET);
  const presetDefaults =
    latencyPreset === 'ultra_low_latency'
      ? {
          thinkingLevel: ThinkingLevel.MINIMAL,
          startSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
          endSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
          vadPrefixMs: 10,
          vadSilenceMs: 60,
        }
      : {
          thinkingLevel: ThinkingLevel.MINIMAL,
          startSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
          endSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
          vadPrefixMs: 20,
          vadSilenceMs: 100,
        };

  const thinkingLevel = process.env.AGENT_GEMINI_THINKING_LEVEL
    ? parseThinkingLevel(process.env.AGENT_GEMINI_THINKING_LEVEL)
    : presetDefaults.thinkingLevel;
  const startSensitivity = process.env.AGENT_GEMINI_VAD_START_SENSITIVITY
    ? parseStartSensitivity(process.env.AGENT_GEMINI_VAD_START_SENSITIVITY)
    : presetDefaults.startSensitivity;
  const endSensitivity = process.env.AGENT_GEMINI_VAD_END_SENSITIVITY
    ? parseEndSensitivity(process.env.AGENT_GEMINI_VAD_END_SENSITIVITY)
    : presetDefaults.endSensitivity;
  const vadPrefixMsRaw = Number(process.env.AGENT_GEMINI_VAD_PREFIX_MS ?? presetDefaults.vadPrefixMs);
  const vadSilenceMsRaw = Number(process.env.AGENT_GEMINI_VAD_SILENCE_MS ?? presetDefaults.vadSilenceMs);
  const vadPrefixMs = Number.isFinite(vadPrefixMsRaw) && vadPrefixMsRaw >= 0 ? vadPrefixMsRaw : 20;
  const vadSilenceMs = Number.isFinite(vadSilenceMsRaw) && vadSilenceMsRaw > 0 ? vadSilenceMsRaw : 100;
  const enableContextCompression = parseBoolean(process.env.AGENT_GEMINI_CONTEXT_COMPRESSION_ENABLED, true);

  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      thinkingConfig: {
        thinkingLevel,
      },
      realtimeInputConfig: {
        activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        turnCoverage: TurnCoverage.TURN_INCLUDES_ONLY_ACTIVITY,
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: startSensitivity,
          endOfSpeechSensitivity: endSensitivity,
          prefixPaddingMs: vadPrefixMs,
          silenceDurationMs: vadSilenceMs,
        },
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      ...(enableContextCompression
        ? {
            contextWindowCompression: {
              slidingWindow: {},
            },
          }
        : {}),
      ...(params.onToolCall ? { tools: [{ functionDeclarations: TOOL_DECLARATIONS }] } : {}),
    },
    callbacks: {
      onopen: () => {
        log.info({ model }, 'gemini_live_session_opened');
      },
      onmessage: (event) => {
        const userTranscriptCandidates = [
          (event.serverContent as { inputTranscription?: { text?: string } } | undefined)?.inputTranscription?.text,
          (event.serverContent as { inputTranscript?: { text?: string } } | undefined)?.inputTranscript?.text,
          (event as { inputTranscription?: { text?: string } } | undefined)?.inputTranscription?.text,
        ];
        for (const candidate of userTranscriptCandidates) {
          const transcript = candidate?.trim();
          if (!transcript) continue;
          if (transcript === lastUserTranscript) continue;
          lastUserTranscript = transcript;
          if (params.onUserTranscript) {
            void params.onUserTranscript(transcript);
          }
          break;
        }

        const text = event.text?.trim();
        if (text) {
          if (text !== lastAssistantTranscript && params.onAssistantTranscript) {
            lastAssistantTranscript = text;
            void params.onAssistantTranscript(text);
          }
          void room.localParticipant?.sendText(text, {
            topic: 'rb.agent.text',
          });
        }

        const parts = event.serverContent?.modelTurn?.parts ?? [];
        for (const part of parts) {
          const inlineData = part.inlineData;
          const audioBase64 = inlineData?.data;
          const sampleRate = parsePcmRateFromMimeType(inlineData?.mimeType);
          if (!audioBase64 || !sampleRate || !params.onModelAudioPcm) continue;
          void params.onModelAudioPcm({
            pcm16: base64ToInt16(audioBase64),
            sampleRate,
          });
        }

        const functionCalls = event.toolCall?.functionCalls ?? [];
        const onToolCall = params.onToolCall;
        if (functionCalls.length === 0 || !onToolCall) return;

        toolCallQueue = toolCallQueue
          .then(async () => {
            const responses = [];
            for (const call of functionCalls) {
              const toolName = call.name?.trim();
              if (!toolName) continue;
              const callId = call.id;
              const args = (call.args ?? {}) as Record<string, unknown>;
              if (params.onToolCallStart) {
                await params.onToolCallStart({
                  name: toolName,
                  callId,
                });
              }

              const toolStartedAt = Date.now();
              try {
                const output = await onToolCall({
                  name: toolName,
                  args,
                  callId,
                });
                const durationMs = Date.now() - toolStartedAt;
                log.info(
                  {
                    toolName,
                    callId,
                    durationMs,
                    ok: true,
                  },
                  'gemini_live_tool_call_completed',
                );
                observeDurationMs('toolcall_duration_ms', durationMs, {
                  toolName,
                  outcome: 'success',
                  provider: 'gemini_live',
                });
                incrementMetric('toolcall_total', {
                  toolName,
                  outcome: 'success',
                  provider: 'gemini_live',
                });
                responses.push({
                  id: callId,
                  name: toolName,
                  response: { output: compactToolOutput(output) },
                });
              } catch (error) {
                const durationMs = Date.now() - toolStartedAt;
                log.warn(
                  {
                    toolName,
                    callId,
                    durationMs,
                    ok: false,
                    err: error,
                  },
                  'gemini_live_tool_call_failed',
                );
                observeDurationMs('toolcall_duration_ms', durationMs, {
                  toolName,
                  outcome: 'failed',
                  provider: 'gemini_live',
                });
                incrementMetric('toolcall_total', {
                  toolName,
                  outcome: 'failed',
                  provider: 'gemini_live',
                });
                responses.push({
                  id: callId,
                  name: toolName,
                  response: {
                    error: {
                      message: error instanceof Error ? error.message : 'tool_execution_failed',
                    },
                  },
                });
              }
            }

            if (responses.length > 0) {
              session.sendToolResponse({
                functionResponses: responses,
              });
            }
          })
          .catch((error) => {
            log.error(
              {
                err: error,
              },
              'gemini_live_tool_call_queue_failed',
            );
            incrementMetric('toolcall_queue_failed_total', {
              provider: 'gemini_live',
            });
          });
      },
      onerror: (errorEvent) => {
        log.error(
          {
            err: errorEvent.error,
          },
          'gemini_live_session_error',
        );
      },
      onclose: () => {
        log.info({ model }, 'gemini_live_session_closed');
      },
    },
  });

  return {
    provider: 'gemini_live',
    sendUserText: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text: trimmed }],
          },
        ],
        turnComplete: true,
      });
    },
    sendUserAudioPcm: (input) => {
      session.sendRealtimeInput({
        audio: {
          data: int16ToBase64(input.pcm16),
          mimeType: `audio/pcm;rate=${input.sampleRate}`,
        },
      });
    },
    close: () => {
      session.close();
    },
  };
}

export async function createGeminiLiveTextBridge(
  params: {
    room: Room;
    dispatch: RealtimeDispatchInput;
    onModelAudioPcm?: (params: { pcm16: Int16Array; sampleRate: number }) => Promise<void> | void;
    onToolCall?: (input: RealtimeToolCallInput) => Promise<unknown> | unknown;
    onToolCallStart?: (input: { name: string; callId?: string }) => Promise<void> | void;
    onUserTranscript?: (text: string) => Promise<void> | void;
  },
): Promise<RealtimeVoiceBridge | null> {
  return await createGeminiLiveVoiceBridge(params);
}
