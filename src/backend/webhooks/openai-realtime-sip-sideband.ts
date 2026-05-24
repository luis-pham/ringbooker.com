import WebSocket from 'ws';

import { getSipShopToolNameSet } from '@/src/agent/sip/sip-tool-definitions';
import { getEnv } from '@/src/backend/config/env';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';
import { logger } from '@/src/backend/observability/logger';
import { buildDirectWebDemoClientSecretAudioInput } from '@/src/backend/webhooks/openai-sip-accept-payload';
import {
  BRIDGE_READY_FALLBACK_MS,
  queueGreetingUntilBridgeReady,
} from '@/src/backend/webhooks/openai-sip-bridge-greeting-coordinator';

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
      /** Called for each completed transcript segment (AI speech or caller speech). Fire-and-forget. */
      onTranscript?: (speaker: 'caller' | 'assistant', text: string) => void;
      /**
       * Called when the AI invokes the `end_call` tool and the goodbye audio buffer has stopped.
       * Caller is responsible for issuing the hangup (Telnyx) so the call terminates cleanly.
       */
      onEndCall?: () => void;
    }
  | {
      variant: 'shop';
      callId: string;
      apiKey: string;
      executeBusinessTool: (toolName: string, argsJson: string) => Promise<string>;
      /** One short greeting instruction for first `response.create` (shop welcome or default). */
      initialResponseInstructions?: string | null;
      /**
       * Production Call Control path: delay first greeting until Telnyx confirms parent ↔ OpenAI bridge readiness.
       * Demo/TeXML calls do not set this gate.
       */
      initialResponseBridgeGate?: {
        parentCallControlId: string;
        openaiLegCallControlId: string;
        rbCallId?: string | null;
        shopId?: string | null;
        fallbackMs?: number;
      };
      /** When set, used for `openai_accepted_to_initial_response_ms` after first greeting send. */
      acceptedAtMs?: number;
      /** Called for each completed transcript segment (AI speech or caller speech). Fire-and-forget. */
      onTranscript?: (speaker: 'caller' | 'assistant', text: string) => void;
      /** Called when the WS successfully opens (useful for reconnect attempt tracking). */
      onConnected?: () => void;
      /**
       * Called when the WS closes with an unexpected code (not 1000/1001) after at least one
       * successful open — signals that the AI session dropped mid-call rather than ended cleanly.
       */
      onWsDropped?: (closeCode: number) => void;
      /**
       * If set, inject a wrap-up system message into the AI session at this offset from WS open.
       * Uses `conversation.item.create` + `response.create` so it doesn't replace the full prompt.
       */
      softLimitMs?: number;
      softLimitInstruction?: string;
      /**
       * If set, call `onHardLimit` at this offset from WS open.
       * Caller is responsible for playing a goodbye message and hanging up.
       */
      hardLimitMs?: number;
      onHardLimit?: () => void;
      /**
       * Called when the AI invokes the `end_call` tool and the goodbye audio buffer has stopped.
       * Caller is responsible for issuing the hangup command (after this fires, audio is done).
       */
      onEndCall?: () => void;
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
const SOFT_LIMIT_WRAP_UP_INSTRUCTION =
  "You must now wrap up the call politely. Say something like: 'Is there anything else I can help you with before we finish?'";

export function startOpenAiRealtimeSipSideband(
  params: OpenAiRealtimeSipSidebandParams,
  /** @internal test-only: override URL / timing so tests can point at a local server without real env */
  _options?: { wsUrlOverride?: string; greetingDelayMs?: number },
): void {
  const greetingDelayMs = _options?.greetingDelayMs ?? getEnv().OPENAI_SIP_SIDEBAND_GREETING_DELAY_MS ?? 100;
  const timeoutMs = params.variant === 'shop' ? 25 * 60_000 : 45_000;
  const url = _options?.wsUrlOverride ?? `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(params.callId)}`;
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

  let wsOpened = false;
  let softLimitTimer: ReturnType<typeof setTimeout> | null = null;
  let hardLimitTimer: ReturnType<typeof setTimeout> | null = null;
  let initialResponseSent = false;
  let vadResumeAfterWelcomeSent = false;
  let sawUserSpeechBeforeInitial = false;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set when AI calls end_call; next output_audio_buffer.stopped triggers onEndCall. */
  let pendingHangupAfterAudio = false;
  /** Fallback: fire onEndCall after this many ms if output_audio_buffer.stopped never arrives. */
  let pendingHangupFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  function fireOnEndCall(): void {
    if (pendingHangupFallbackTimer) { clearTimeout(pendingHangupFallbackTimer); pendingHangupFallbackTimer = null; }
    pendingHangupAfterAudio = false;
    params.onEndCall?.();
  }

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

  function queueOrSendInitialResponse(): void {
    if (params.variant !== 'shop' || !params.initialResponseBridgeGate) {
      trySendInitialResponse();
      return;
    }

    const instructions = params.initialResponseInstructions?.trim();
    queueGreetingUntilBridgeReady({
      ...params.initialResponseBridgeGate,
      pendingGreetingPayload: { instructions: instructions ?? null },
      fallbackMs: params.initialResponseBridgeGate.fallbackMs ?? BRIDGE_READY_FALLBACK_MS,
      sendGreeting: trySendInitialResponse,
    });
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
    wsOpened = true;
    logger.info(
      { callId: params.callId, variant: params.variant },
      params.variant === 'shop' ? 'openai_sip_sideband_connected' : 'openai_sip_sideband_ws_open',
    );

    if (params.variant === 'shop') {
      params.onConnected?.();

      if (params.softLimitMs) {
        softLimitTimer = setTimeout(() => {
          softLimitTimer = null;
          if (ws.readyState !== WebSocket.OPEN) return;
          const instruction = params.softLimitInstruction?.trim() || SOFT_LIMIT_WRAP_UP_INSTRUCTION;
          try {
            ws.send(
              JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'system',
                  content: [{ type: 'input_text', text: instruction }],
                },
              }),
            );
            ws.send(JSON.stringify({ type: 'response.create' }));
            logger.info({ callId: params.callId }, 'openai_sip_shop_soft_limit_instruction_injected');
          } catch (err) {
            logger.warn({ err, callId: params.callId }, 'openai_sip_shop_soft_limit_inject_failed');
          }
        }, params.softLimitMs);
      }

      if (params.hardLimitMs) {
        hardLimitTimer = setTimeout(() => {
          hardLimitTimer = null;
          logger.warn({ callId: params.callId }, 'openai_sip_shop_hard_limit_reached');
          params.onHardLimit?.();
        }, params.hardLimitMs);
      }
    }

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
      queueOrSendInitialResponse();
    }, greetingDelayMs);
  });

  ws.on('message', (data) => {
    let evt: { type?: string; name?: string; call_id?: string; arguments?: string; transcript?: string };
    try {
      evt = JSON.parse(String(data)) as typeof evt;
    } catch {
      return;
    }

    if (
      params.variant === 'shop' &&
      !params.initialResponseBridgeGate &&
      evt.type === 'input_audio_buffer.speech_started' &&
      !initialResponseSent
    ) {
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

    // Fire onEndCall once the goodbye audio finishes playing.
    if (pendingHangupAfterAudio && evt.type === 'output_audio_buffer.stopped') {
      fireOnEndCall();
    }

    // Capture completed transcript segments.
    {
      const transcript = typeof evt.transcript === 'string' ? evt.transcript.trim() : '';
      // GA Realtime emits `response.output_audio_transcript.done`; the legacy
      // `response.audio_transcript.done` is kept as a fallback for beta-mode sessions.
      const speaker: 'assistant' | 'caller' | null =
        evt.type === 'response.output_audio_transcript.done' || evt.type === 'response.audio_transcript.done'
          ? 'assistant'
          : evt.type === 'conversation.item.input_audio_transcription.completed'
            ? 'caller'
            : null;
      if (transcript && speaker) {
        // Both shop and demo calls persist the full transcript via the callback.
        params.onTranscript?.(speaker, transcript);
      }
    }

    if (evt.type !== 'response.function_call_arguments.done') return;

    if (params.variant === 'demo') {
      if (!params.enableToolLoop) return;
      const callIdTool = typeof evt.call_id === 'string' ? evt.call_id : undefined;
      if (!callIdTool) return;

      // end_call: acknowledge, arm the hangup trigger, skip response.create.
      if (evt.name === 'end_call') {
        try {
          ws.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callIdTool,
                output: compactToolOutput(JSON.stringify({ ok: true })),
              },
            }),
          );
          logger.info({ callId: params.callId }, 'openai_sip_demo_end_call_tool_acknowledged');
        } catch (err) {
          logger.warn({ err, callId: params.callId }, 'openai_sip_demo_end_call_ack_failed');
        }
        if (params.onEndCall) {
          pendingHangupAfterAudio = true;
          pendingHangupFallbackTimer = setTimeout(fireOnEndCall, 5_000);
        }
        return;
      }

      if (evt.name !== 'demo_noop') return;

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

    // end_call: acknowledge immediately, skip response.create (AI already said goodbye),
    // then wait for output_audio_buffer.stopped before triggering the actual hangup.
    if (toolName === 'end_call') {
      try {
        ws.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callIdTool,
              output: compactToolOutput(JSON.stringify({ ok: true })),
            },
          }),
        );
        logger.info({ callId: params.callId }, 'openai_sip_end_call_tool_acknowledged');
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_end_call_ack_failed');
      }
      if (params.variant === 'shop' && params.onEndCall) {
        pendingHangupAfterAudio = true;
        // Fallback: if output_audio_buffer.stopped never arrives (e.g., SIP path doesn't emit it),
        // fire onEndCall after 5 s so the call isn't left open indefinitely.
        pendingHangupFallbackTimer = setTimeout(fireOnEndCall, 5_000);
      }
      return;
    }

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

  ws.on('close', (closeCode: number) => {
    if (softLimitTimer) { clearTimeout(softLimitTimer); softLimitTimer = null; }
    if (hardLimitTimer) { clearTimeout(hardLimitTimer); hardLimitTimer = null; }
    if (pendingHangupFallbackTimer) { clearTimeout(pendingHangupFallbackTimer); pendingHangupFallbackTimer = null; }
    pendingHangupAfterAudio = false;
    cancelInitialTimer();
    clearTimeout(t);
    logger.info({ callId: params.callId, closeCode }, 'openai_sip_sideband_ws_close');
    if (params.variant === 'demo') {
      params.onEnded?.();
    } else if (params.variant === 'shop' && wsOpened && closeCode !== 1000 && closeCode !== 1001) {
      params.onWsDropped?.(closeCode);
    }
  });
}
