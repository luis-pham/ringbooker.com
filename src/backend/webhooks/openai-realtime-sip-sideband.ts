import WebSocket from 'ws';

import { getSipShopToolNameSet } from '@/src/agent/sip/sip-tool-definitions';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';
import { logger } from '@/src/backend/observability/logger';

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
    };

/**
 * Sideband: connect to Realtime WS for an accepted SIP call on the same `call_id`.
 * OpenAI Realtime SIP does not speak until a client sends `response.create` on this socket
 * (see Realtime SIP guide — WebSocket monitor section).
 * Demo: handles `demo_noop` only. Shop: runs shared booking tools via `executeBusinessTool`.
 */
export function startOpenAiRealtimeSipSideband(params: OpenAiRealtimeSipSidebandParams): void {
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
  let sawUserSpeechBeforeInitial = false;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;

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
      // Wait briefly after sideband open so the accepted SIP call has media/session state ready.
      initialTimer = setTimeout(() => {
        initialTimer = null;
        trySendInitialResponse();
      }, 500);
      return;
    }

    initialTimer = setTimeout(() => {
      initialTimer = null;
      trySendInitialResponse();
    }, 300);
  });

  ws.on('message', (data) => {
    let evt: { type?: string; name?: string; call_id?: string; arguments?: string };
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
  });
}
