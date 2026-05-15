import WebSocket from 'ws';

import { getSipShopToolNameSet } from '@/src/agent/sip/sip-tool-definitions';
import { getEnv } from '@/src/backend/config/env';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';
import { logger } from '@/src/backend/observability/logger';
import { buildDirectWebDemoClientSecretAudioInput } from '@/src/backend/webhooks/openai-sip-accept-payload';

function compactToolOutput(output: string): string {
  return output.length > 8000 ? `${output.slice(0, 8000)}…` : output;
}

export type OpenAiRealtimeSipSidebandParams =
  | {
      variant: 'demo';
      callId: string;
      apiKey: string;
      /** When false, only connect briefly then close (smoke / reduced surface). */
      enableToolLoop: boolean;
      /** Explicit first-turn instruction so SIP demo speaks before caller audio. */
      initialResponseInstructions?: string | null;
      /** When set, used for accepted-to-first-response timing. */
      acceptedAtMs?: number;
      /** Called when the sideband WS closes (call ended or dropped) — used to cancel duration timers. */
      onEnded?: () => void;
    }
  | {
      variant: 'shop';
      callId: string;
      apiKey: string;
      executeBusinessTool: (toolName: string, argsJson: string) => Promise<string>;
      /** One short greeting instruction for first `response.create` (shop welcome or default). */
      initialResponseInstructions?: string | null;
      /** When set, used for `openai_accepted_to_initial_response_ms` after first greeting send. */
      acceptedAtMs?: number;
      /** Called for each completed transcript segment (AI speech or caller speech). Fire-and-forget. */
      onTranscript?: (speaker: 'caller' | 'assistant', text: string) => void;
    };

/**
 * Sideband: connect to Realtime WS for an accepted SIP call on the same `call_id`.
 * OpenAI Realtime SIP does not speak until a client sends `response.create` on this socket
 * (see Realtime SIP guide — WebSocket monitor section).
 * Demo: handles `demo_noop` only. Shop: runs shared booking tools via `executeBusinessTool`.
 *
 * SIP demo accept sets `audio.input.turn_detection.create_response: false` so VAD does not answer before the
 * sideband `response.create` greeting; after that greeting finishes we must send `session.update` (same as
 * browser direct demo) or user speech never triggers assistant turns.
 */
export function startOpenAiRealtimeSipSideband(params: OpenAiRealtimeSipSidebandParams): void {
  const greetingDelayMs = getEnv().OPENAI_SIP_SIDEBAND_GREETING_DELAY_MS ?? 100;
  const timeoutMs = params.variant === 'shop' ? 25 * 60_000 : 45_000;
  const url = `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(params.callId)}`;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
  });

  const t = setTimeout(() => {
    try {
      ws.terminate();
    } catch {
      /* ignore */
    }
  }, timeoutMs);

  let initialResponseSent = false;
  let vadResumeAfterWelcomeSent = false;
  let sawUserSpeechBeforeInitial = false;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;

  const needsDemoVadResumeAfterWelcome =
    params.variant === 'demo' && params.enableToolLoop;

  function cancelInitialTimer(): void {
    if (initialTimer) {
      clearTimeout(initialTimer);
      initialTimer = null;
    }
  }

  function trySendInitialResponse(): void {
    const instructions = params.initialResponseInstructions?.trim();
    if (initialResponseSent) return;
    if (params.variant === 'shop' && sawUserSpeechBeforeInitial) {
      return;
    }
    logger.info(
      { callId: params.callId, variant: params.variant, hasInstructions: Boolean(instructions) },
      'openai_sip_initial_response_create_started',
    );
    try {
      ws.send(
        JSON.stringify({
          type: 'response.create',
          ...(instructions ? { response: { instructions } } : {}),
        }),
      );
      initialResponseSent = true;
      logger.info({ callId: params.callId, variant: params.variant }, 'openai_sip_initial_response_create_sent');
      incrementMetric('initial_response_create_total', { outcome: 'sent' });
      if (typeof params.acceptedAtMs === 'number') {
        observeDurationMs('openai_accepted_to_initial_response_ms', Date.now() - params.acceptedAtMs, {});
      }
    } catch (err) {
      logger.warn({ err, callId: params.callId, variant: params.variant }, 'openai_sip_initial_response_failed');
      incrementMetric('initial_response_create_total', { outcome: 'failed' });
    }
  }

  function maybeResumeDemoVadAfterWelcome(fromEvent: string): void {
    if (!needsDemoVadResumeAfterWelcome || !initialResponseSent || vadResumeAfterWelcomeSent) return;
    if (ws.readyState !== WebSocket.OPEN) return;

    const { turnDetectionAfterWelcome: td } = buildDirectWebDemoClientSecretAudioInput();
    if (!td || typeof td !== 'object' || Array.isArray(td)) {
      logger.info({ callId: params.callId, fromEvent }, 'openai_sip_demo_vad_resume_skipped_no_turn_detection');
      return;
    }
    if (td.create_response !== true) {
      logger.info(
        { callId: params.callId, fromEvent, create_response: td.create_response },
        'openai_sip_demo_vad_resume_skipped_create_response_off',
      );
      return;
    }

    vadResumeAfterWelcomeSent = true;
    try {
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            audio: {
              input: {
                turn_detection: td,
              },
            },
          },
        }),
      );
      logger.info(
        { callId: params.callId, fromEvent, vadType: (td as { type?: string }).type },
        'openai_sip_demo_vad_resume_sent',
      );
    } catch (err) {
      vadResumeAfterWelcomeSent = false;
      logger.warn({ err, callId: params.callId, fromEvent }, 'openai_sip_demo_vad_resume_send_failed');
    }
  }

  ws.on('open', () => {
    logger.info(
      { callId: params.callId, variant: params.variant },
      params.variant === 'shop' ? 'openai_sip_sideband_connected' : 'openai_sip_sideband_ws_open',
    );
    if (params.variant === 'demo') {
      if (!params.enableToolLoop) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      // Brief pause after WS open so SIP media/session can settle (see OPENAI_SIP_SIDEBAND_GREETING_DELAY_MS).
      initialTimer = setTimeout(() => {
        initialTimer = null;
        trySendInitialResponse();
      }, greetingDelayMs);
      return;
    }

    initialTimer = setTimeout(() => {
      initialTimer = null;
      trySendInitialResponse();
    }, greetingDelayMs);
  });

  ws.on('message', (data) => {
    let evt: { type?: string; name?: string; call_id?: string; arguments?: string; transcript?: string };
    try {
      evt = JSON.parse(String(data)) as typeof evt;
    } catch {
      return;
    }

    if (params.variant === 'shop' && evt.type === 'input_audio_buffer.speech_started' && !initialResponseSent) {
      sawUserSpeechBeforeInitial = true;
      cancelInitialTimer();
      logger.info({ callId: params.callId }, 'openai_sip_initial_response_skipped_user_speaking');
      incrementMetric('initial_response_create_total', { outcome: 'skipped_speaking' });
    }

    if (
      needsDemoVadResumeAfterWelcome &&
      (evt.type === 'response.done' || evt.type === 'output_audio_buffer.stopped')
    ) {
      maybeResumeDemoVadAfterWelcome(evt.type ?? 'unknown');
    }

    // Capture completed transcript segments.
    {
      const transcript = typeof evt.transcript === 'string' ? evt.transcript.trim() : '';
      const speaker: 'assistant' | 'caller' | null =
        evt.type === 'response.audio_transcript.done'
          ? 'assistant'
          : evt.type === 'conversation.item.input_audio_transcription.completed'
            ? 'caller'
            : null;
      if (transcript && speaker) {
        // Shop calls persist the full transcript via the callback.
        if (params.variant === 'shop' && params.onTranscript) {
          params.onTranscript(speaker, transcript);
        }
        // Demo calls: log segment metadata only (no PII text) so the transcript pipeline is observable.
        if (params.variant === 'demo') {
          logger.info(
            { callId: params.callId, speaker, segmentChars: transcript.length },
            'openai_sip_demo_transcript_segment',
          );
        }
      }
    }

    if (evt.type !== 'response.function_call_arguments.done') return;

    if (params.variant === 'demo') {
      if (!params.enableToolLoop) return;
      if (evt.name !== 'demo_noop') return;
      const callIdTool = typeof evt.call_id === 'string' ? evt.call_id : undefined;
      if (!callIdTool) return;

      const payload = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callIdTool,
          output: compactToolOutput(JSON.stringify({ ok: true, echo: 'demo_noop_ack' })),
        },
      };
      try {
        ws.send(JSON.stringify(payload));
        ws.send(JSON.stringify({ type: 'response.create' }));
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_tool_reply_failed');
      }
      return;
    }

    const toolName = evt.name;
    if (!toolName || !getSipShopToolNameSet().has(toolName)) return;
    const callIdTool = typeof evt.call_id === 'string' ? evt.call_id : undefined;
    if (!callIdTool) return;

    const argsJson = typeof evt.arguments === 'string' ? evt.arguments : '{}';
    void (async () => {
      let output: string;
      try {
        output = await params.executeBusinessTool(toolName, argsJson);
      } catch (err) {
        logger.warn({ err, callId: params.callId, toolName }, 'openai_sip_shop_tool_handler_failed');
        output = JSON.stringify({ error: 'Tool execution failed. Please try again.' });
      }
      const payload = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callIdTool,
          output: compactToolOutput(output),
        },
      };
      try {
        ws.send(JSON.stringify(payload));
        ws.send(JSON.stringify({ type: 'response.create' }));
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_shop_tool_reply_failed');
      }
    })();
  });

  ws.on('error', (err) => {
    logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_ws_error');
  });

  ws.on('close', () => {
    cancelInitialTimer();
    clearTimeout(t);
    logger.info({ callId: params.callId }, 'openai_sip_sideband_ws_close');
    if (params.variant === 'demo') params.onEnded?.();
  });
}
