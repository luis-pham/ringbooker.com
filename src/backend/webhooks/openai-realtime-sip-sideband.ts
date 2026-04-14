import WebSocket from 'ws';

import { logger } from '@/src/backend/observability/logger';

function compactToolOutput(output: unknown): string {
  try {
    const s = JSON.stringify(output);
    return s.length > 8000 ? `${s.slice(0, 8000)}…` : s;
  } catch {
    return '{"error":{"message":"serialization_failed"}}';
  }
}

/**
 * Minimal sideband: connect to Realtime WS for an accepted SIP call, handle `demo_noop` tool, then exit.
 * Fire-and-forget from the webhook handler; errors are logged only.
 */
export function startOpenAiRealtimeSipSideband(params: {
  callId: string;
  apiKey: string;
  /** When false, only connect briefly then close (smoke / reduced surface). */
  enableToolLoop: boolean;
}): void {
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
  }, 45_000);

  ws.on('open', () => {
    logger.info({ callId: params.callId }, 'openai_sip_sideband_ws_open');
    if (!params.enableToolLoop) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  });

  ws.on('message', (data) => {
    if (!params.enableToolLoop) return;
    let evt: { type?: string; name?: string; call_id?: string; arguments?: string };
    try {
      evt = JSON.parse(String(data)) as typeof evt;
    } catch {
      return;
    }
    if (evt.type !== 'response.function_call_arguments.done') return;
    if (evt.name !== 'demo_noop') return;
    const callIdTool = typeof evt.call_id === 'string' ? evt.call_id : undefined;
    if (!callIdTool) return;

    const payload = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callIdTool,
        output: compactToolOutput({ ok: true, echo: 'demo_noop_ack' }),
      },
    };
    try {
      ws.send(JSON.stringify(payload));
      ws.send(JSON.stringify({ type: 'response.create' }));
    } catch (err) {
      logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_tool_reply_failed');
    }
  });

  ws.on('error', (err) => {
    logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_ws_error');
  });

  ws.on('close', () => {
    clearTimeout(t);
    logger.info({ callId: params.callId }, 'openai_sip_sideband_ws_close');
  });
}
