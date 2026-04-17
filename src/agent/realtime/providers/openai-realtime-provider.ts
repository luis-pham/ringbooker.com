import WebSocket from 'ws';

import type {
  CreateRealtimeVoiceBridgeParams,
  RealtimeVoiceBridge,
} from '@/src/agent/realtime/providers/types';
import { REALTIME_TOOL_DEFINITIONS } from '@/src/agent/realtime/shared-tool-definitions';
import { compactRealtimeSystemInstruction, normalizePromptWhitespace } from '@/src/agent/prompts';
import { withLogContext } from '@/src/backend/observability/logger';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';

const DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS = 18000;
const DEFAULT_MAX_TOOL_RESPONSE_CHARS = 3000;
const DEFAULT_OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime';

type OpenAIRealtimeServerEvent =
  | {
      type: 'response.created' | 'response.done';
      response?: {
        id?: string;
      };
    }
  | {
      type: 'conversation.item.input_audio_transcription.completed';
      transcript?: string;
    }
  | {
      type: 'response.output_audio.delta';
      delta?: string;
    }
  | {
      type: 'response.output_audio_transcript.delta';
      delta?: string;
    }
  | {
      type: 'response.output_audio_transcript.done';
      transcript?: string;
    }
  | {
      type: 'response.function_call_arguments.done';
      name?: string;
      call_id?: string;
      arguments?: string;
    }
  | {
      type: 'error';
      error?: {
        message?: string;
        type?: string;
        code?: string;
      };
    }
  | {
      type: string;
      [key: string]: unknown;
    };

function normalizeWhitespace(text: string): string {
  return normalizePromptWhitespace(text);
}

function compactSystemInstruction(raw: string): string {
  return compactRealtimeSystemInstruction(raw, {
    maxCharsRaw:
      process.env.AGENT_OPENAI_SYSTEM_PROMPT_MAX_CHARS ?? process.env.AGENT_GEMINI_SYSTEM_PROMPT_MAX_CHARS,
    defaultMaxChars: DEFAULT_MAX_SYSTEM_INSTRUCTION_CHARS,
  });
}

function compactToolOutput(value: unknown): string {
  const maxCharsRaw = Number(process.env.AGENT_OPENAI_TOOL_OUTPUT_MAX_CHARS ?? process.env.AGENT_GEMINI_TOOL_OUTPUT_MAX_CHARS ?? DEFAULT_MAX_TOOL_RESPONSE_CHARS);
  const maxChars = Number.isFinite(maxCharsRaw) && maxCharsRaw >= 500 ? maxCharsRaw : DEFAULT_MAX_TOOL_RESPONSE_CHARS;
  let serialized = '';
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = JSON.stringify({ output: String(value) });
  }
  if (serialized.length <= maxChars) return serialized;
  return JSON.stringify({
    output: `${serialized.slice(0, maxChars)}…`,
    truncated: true,
  });
}

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

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseSampleRate(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseOpenAIRealtimeUrl(model: string): string {
  const base = process.env.OPENAI_REALTIME_URL?.trim() || DEFAULT_OPENAI_REALTIME_URL;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}model=${encodeURIComponent(model)}`;
}

function parseTurnDetectionMode(value: string | undefined): 'server_vad' | 'semantic_vad' {
  return value?.trim().toLowerCase() === 'semantic_vad' ? 'semantic_vad' : 'server_vad';
}

function parseSemanticVadEagerness(value: string | undefined): 'low' | 'medium' | 'high' | 'auto' {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'auto') {
    return normalized;
  }
  return 'high';
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

async function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.off('open', handleOpen);
      socket.off('error', handleError);
      socket.off('close', handleClose);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const handleClose = () => {
      cleanup();
      reject(new Error('openai_realtime_socket_closed_before_open'));
    };
    socket.once('open', handleOpen);
    socket.once('error', handleError);
    socket.once('close', handleClose);
  });
}

export async function createOpenAIRealtimeVoiceBridge(
  params: CreateRealtimeVoiceBridgeParams,
): Promise<RealtimeVoiceBridge | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model =
    (params.dispatch.realtime.metadata as { dispatchPayload?: { llm?: { model?: string } } } | undefined)?.dispatchPayload?.llm
      ?.model ??
    process.env.AGENT_VOICE_MODEL?.trim() ??
    'gpt-realtime';
  if (!apiKey || !model) return null;

  const log = withLogContext({
    requestId: params.dispatch.requestId,
    callId: params.dispatch.realtime.sessionId,
    provider: 'openai_realtime',
  });
  const systemInstruction = compactSystemInstruction(params.dispatch.systemPrompt);
  const outputSampleRate = parseSampleRate(process.env.AGENT_OPENAI_OUTPUT_SAMPLE_RATE, 24000);
  const inputTranscriptionModel = process.env.AGENT_OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe';
  const enableInputTranscription = parseBoolean(process.env.AGENT_OPENAI_INPUT_TRANSCRIPTION_ENABLED, true);
  /** Misnamed env: `true` = send `turn_detection` (semantic or server per `AGENT_OPENAI_TURN_DETECTION`); `false` = `turn_detection: null` (VAD off). */
  const turnDetectionEnabled = parseBoolean(process.env.AGENT_OPENAI_SERVER_VAD_ENABLED, true);
  const turnDetectionMode = parseTurnDetectionMode(process.env.AGENT_OPENAI_TURN_DETECTION);
  const vadSilenceMs = parseSampleRate(process.env.AGENT_OPENAI_VAD_SILENCE_MS, 120);
  const vadPrefixMs = parseSampleRate(process.env.AGENT_OPENAI_VAD_PREFIX_MS, 120);
  const vadIdleMs = parseSampleRate(process.env.AGENT_OPENAI_VAD_IDLE_TIMEOUT_MS, 5000);
  const semanticVadEagerness = parseSemanticVadEagerness(process.env.AGENT_OPENAI_SEMANTIC_VAD_EAGERNESS);
  const voice = process.env.AGENT_OPENAI_VOICE?.trim() || 'alloy';
  const websocketUrl = parseOpenAIRealtimeUrl(model);
  const socket = new WebSocket(websocketUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
      ...(process.env.OPENAI_ORGANIZATION ? { 'OpenAI-Organization': process.env.OPENAI_ORGANIZATION } : {}),
      ...(process.env.OPENAI_PROJECT ? { 'OpenAI-Project': process.env.OPENAI_PROJECT } : {}),
    },
  });

  let closed = false;
  let toolCallQueue = Promise.resolve();
  let lastUserTranscript = '';
  let lastAssistantTranscript = '';
  let responsePending = false;

  const sendEvent = (payload: Record<string, unknown>) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  };

  socket.on('message', (raw) => {
    let event: OpenAIRealtimeServerEvent;
    try {
      event = JSON.parse(raw.toString('utf-8')) as OpenAIRealtimeServerEvent;
    } catch (error) {
      log.warn({ err: error }, 'openai_realtime_event_parse_failed');
      return;
    }

    switch (event.type) {
      case 'response.created': {
        responsePending = true;
        log.info({ responseId: asString((event as { response?: { id?: unknown } }).response?.id) }, 'openai_realtime_response_created');
        return;
      }
      case 'response.done': {
        responsePending = false;
        log.info({ responseId: asString((event as { response?: { id?: unknown } }).response?.id) }, 'openai_realtime_response_done');
        return;
      }
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = asString(event.transcript)?.trim();
        if (!transcript || transcript === lastUserTranscript) return;
        lastUserTranscript = transcript;
        if (params.onUserTranscript) {
          void params.onUserTranscript(transcript);
        }
        return;
      }
      case 'response.output_audio.delta': {
        const delta = asString(event.delta);
        if (!delta || !params.onModelAudioPcm) return;
        responsePending = false;
        void params.onModelAudioPcm({
          pcm16: base64ToInt16(delta),
          sampleRate: outputSampleRate,
        });
        return;
      }
      case 'response.output_audio_transcript.delta': {
        const delta = asString(event.delta)?.trim();
        if (!delta) return;
        lastAssistantTranscript = `${lastAssistantTranscript}${delta}`;
        return;
      }
      case 'response.output_audio_transcript.done': {
        const transcript = asString(event.transcript)?.trim() || lastAssistantTranscript.trim();
        lastAssistantTranscript = '';
        if (!transcript) return;
        if (params.onAssistantTranscript) {
          void params.onAssistantTranscript(transcript);
        }
        void params.room.localParticipant?.sendText(transcript, {
          topic: 'rb.agent.text',
        });
        return;
      }
      case 'response.function_call_arguments.done': {
        const onToolCall = params.onToolCall;
        const toolEventName = asString(event.name);
        if (!onToolCall || !toolEventName) return;
        toolCallQueue = toolCallQueue
          .then(async () => {
            const toolName = toolEventName.trim();
            const callId = asString(event.call_id) ?? undefined;
            let args: Record<string, unknown> = {};
            try {
              const rawArgs = asString(event.arguments);
              args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
            } catch {
              args = {};
            }

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
              observeDurationMs('toolcall_duration_ms', durationMs, {
                toolName,
                outcome: 'success',
                provider: 'openai_realtime',
              });
              incrementMetric('toolcall_total', {
                toolName,
                outcome: 'success',
                provider: 'openai_realtime',
              });
              log.info({ toolName, callId, durationMs, ok: true }, 'openai_realtime_tool_call_completed');
              sendEvent({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: compactToolOutput(output),
                },
              });
              sendEvent({
                type: 'response.create',
              });
            } catch (error) {
              const durationMs = Date.now() - toolStartedAt;
              observeDurationMs('toolcall_duration_ms', durationMs, {
                toolName,
                outcome: 'failed',
                provider: 'openai_realtime',
              });
              incrementMetric('toolcall_total', {
                toolName,
                outcome: 'failed',
                provider: 'openai_realtime',
              });
              log.warn({ toolName, callId, durationMs, ok: false, err: error }, 'openai_realtime_tool_call_failed');
              sendEvent({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: callId,
                  output: compactToolOutput({
                    error: {
                      message: error instanceof Error ? error.message : 'tool_execution_failed',
                    },
                  }),
                },
              });
              sendEvent({
                type: 'response.create',
              });
            }
          })
          .catch((error) => {
            log.error({ err: error }, 'openai_realtime_tool_call_queue_failed');
            incrementMetric('toolcall_queue_failed_total', {
              provider: 'openai_realtime',
            });
          });
        return;
      }
      case 'error': {
        responsePending = false;
        log.error({ error: event.error }, 'openai_realtime_session_error');
        return;
      }
      default:
        return;
    }
  });

  socket.on('error', (error) => {
    log.error({ err: error }, 'openai_realtime_socket_error');
  });

  socket.on('close', (code, reason) => {
    closed = true;
    responsePending = false;
    log.info(
      {
        code,
        reason: reason.toString('utf-8'),
      },
      'openai_realtime_session_closed',
    );
  });

  await waitForOpen(socket);

  sendEvent({
    type: 'session.update',
    session: {
      instructions: systemInstruction,
      modalities: ['audio', 'text'],
      voice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      ...(enableInputTranscription
        ? {
            input_audio_transcription: {
              model: inputTranscriptionModel,
            },
          }
        : {}),
      turn_detection: turnDetectionEnabled
        ? turnDetectionMode === 'semantic_vad'
          ? {
              type: 'semantic_vad',
              create_response: true,
              interrupt_response: true,
              eagerness: semanticVadEagerness,
            }
          : {
              type: 'server_vad',
              create_response: true,
              interrupt_response: true,
              prefix_padding_ms: vadPrefixMs,
              silence_duration_ms: vadSilenceMs,
              idle_timeout_ms: vadIdleMs,
            }
        : null,
      tool_choice: 'auto',
      tools: REALTIME_TOOL_DEFINITIONS.map((tool) => ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  });

  log.info({ model, websocketUrl }, 'openai_realtime_session_opened');

  return {
    provider: 'openai_realtime',
    sendUserText: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || closed) return;
      log.info({ textPreview: trimmed.slice(0, 180) }, 'openai_realtime_send_user_text');
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: trimmed }],
        },
      });
      sendEvent({
        type: 'response.create',
      });
    },
    sendUserAudioPcm: ({ pcm16 }) => {
      if (closed) return;
      sendEvent({
        type: 'input_audio_buffer.append',
        audio: int16ToBase64(pcm16),
      });
    },
    commitUserAudioTurn: () => {
      if (closed || responsePending) return;
      responsePending = true;
      log.info({}, 'openai_realtime_user_audio_turn_committed');
      sendEvent({
        type: 'input_audio_buffer.commit',
      });
      sendEvent({
        type: 'response.create',
      });
    },
    close: () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    },
  };
}
