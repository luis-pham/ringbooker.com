import WebSocket from 'ws';

import { SIP_SHOP_TOOL_NAME_SET } from '@/src/agent/sip/sip-tool-definitions';
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
    }
  | {
      variant: 'shop';
      callId: string;
      apiKey: string;
      executeBusinessTool: (toolName: string, argsJson: string) => Promise<string>;
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

  ws.on('open', () => {
    logger.info({ callId: params.callId, variant: params.variant }, 'openai_sip_sideband_ws_open');
    if (params.variant === 'demo') {
      if (!params.enableToolLoop) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
    }
    try {
      ws.send(JSON.stringify({ type: 'response.create' }));
    } catch (err) {
      logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_initial_response_create_failed');
    }
  });

  ws.on('message', (data) => {
    let evt: { type?: string; name?: string; call_id?: string; arguments?: string };
    try {
      evt = JSON.parse(String(data)) as typeof evt;
    } catch {
      return;
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
    if (!toolName || !SIP_SHOP_TOOL_NAME_SET.has(toolName)) return;
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
    clearTimeout(t);
    logger.info({ callId: params.callId }, 'openai_sip_sideband_ws_close');
  });
}
