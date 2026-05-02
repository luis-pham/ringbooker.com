import {
  isTelnyxApiError,
  isTelnyxNetworkError,
  isTelnyxTimeoutError,
} from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import { getCallControlActionTimeoutMs } from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { getEnv } from '@/src/backend/config/env';

export type CallControlHttpResult = {
  ok: boolean;
  status: number;
  text: string;
  durationMs?: number;
  errorKind?: 'timeout' | 'network' | 'http';
};

export type CallControlClientDeps = {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  correlation?: {
    rbCallId?: string;
    handoffId?: string;
    shopId?: string;
  };
};

/**
 * POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/{action}
 * Uses timeout + structured Telnyx logging; does not retry (realtime Call Control).
 * @see https://developers.telnyx.com/api/call-control/
 */
export async function postCallControlAction(
  callControlId: string,
  action: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  const apiKey = deps?.apiKey ?? getEnv().TELNYX_API_KEY;
  const path = `calls/${encodeURIComponent(callControlId)}/actions/${encodeURIComponent(action)}`;

  try {
    const result = await telnyxHttpJson({
      method: 'POST',
      path,
      body,
      timeoutMs: getCallControlActionTimeoutMs(action),
      operation: `call_control.${action}`,
      apiKey,
      fetchImpl: deps?.fetchImpl,
      correlation: {
        ...deps?.correlation,
        callControlId,
        action,
      },
    });
    return {
      ok: true,
      status: result.status,
      text: result.rawText.slice(0, 500),
      durationMs: result.durationMs,
    };
  } catch (e: unknown) {
    if (isTelnyxTimeoutError(e)) {
      return {
        ok: false,
        status: 0,
        text: e.message,
        durationMs: e.durationMs,
        errorKind: 'timeout',
      };
    }
    if (isTelnyxNetworkError(e)) {
      return {
        ok: false,
        status: 0,
        text: e.message,
        durationMs: e.durationMs,
        errorKind: 'network',
      };
    }
    if (isTelnyxApiError(e)) {
      return {
        ok: false,
        status: e.status ?? 0,
        text: (e.responseText ?? e.message).slice(0, 500),
        durationMs: e.durationMs,
        errorKind: 'http',
      };
    }
    throw e;
  }
}

export async function callControlAnswer(
  callControlId: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'answer', body, deps);
}

export async function callControlReject(
  callControlId: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'reject', body, deps);
}

export async function callControlHangup(
  callControlId: string,
  body: Record<string, unknown> = {},
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'hangup', body, deps);
}

export async function callControlSpeak(
  callControlId: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'speak', body, deps);
}

/** Outbound leg toward PSTN or SIP (e.g. bridge caller to OpenAI Realtime SIP). */
export async function callControlDial(
  callControlId: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'dial', body, deps);
}

/** @see https://developers.telnyx.com/api/call-control/gather-using-speak */
export async function callControlGatherUsingSpeak(
  callControlId: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'gather_using_speak', body, deps);
}

/** @see https://developers.telnyx.com/api/call-control/bridge */
export async function callControlBridgeCalls(
  callControlId: string,
  otherLegCallControlId: string,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'bridge', { call_control_id: otherLegCallControlId }, deps);
}

export type TelnyxCallControlCommandJson = {
  data?: {
    result?: string;
    /** Some Telnyx responses echo created resource ids */
    call_control_id?: string;
  };
};

export function parseTelnyxCallControlJsonResponse(text: string): TelnyxCallControlCommandJson | null {
  try {
    return JSON.parse(text) as TelnyxCallControlCommandJson;
  } catch {
    return null;
  }
}
