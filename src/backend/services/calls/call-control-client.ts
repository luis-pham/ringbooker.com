import {
  isTelnyxApiError,
  isTelnyxNetworkError,
  isTelnyxTimeoutError,
} from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import {
  getCallControlActionTimeoutMs,
  getTelnyxCallsCreateTimeoutMs,
} from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { getEnv } from '@/src/backend/config/env';

export type CallControlHttpResult = {
  ok: boolean;
  status: number;
  text: string;
  durationMs?: number;
  errorKind?: 'timeout' | 'network' | 'http';
};

export type TelnyxCreateCallResult = CallControlHttpResult & {
  data?: unknown;
  callControlId?: string;
  callLegId?: string;
  callSessionId?: string;
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

function mapTelnyxHttpErrorToResult(e: unknown): CallControlHttpResult | null {
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
  return null;
}

function readDataObject(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const top = parsed as Record<string, unknown>;
  const data = top.data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

export function extractCallControlIdFromTelnyxCreateCallResponse(parsed: unknown): string | null {
  const data = readDataObject(parsed);
  const cc = data?.call_control_id;
  return typeof cc === 'string' && cc.trim() ? cc.trim() : null;
}

export function extractCallLegIdFromTelnyxCreateCallResponse(parsed: unknown): string | null {
  const data = readDataObject(parsed);
  const id = data?.call_leg_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function extractCallSessionIdFromTelnyxCreateCallResponse(parsed: unknown): string | null {
  const data = readDataObject(parsed);
  const id = data?.call_session_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export async function callControlCreateCall(
  body: Record<string, unknown>,
  deps?: CallControlClientDeps & { operation?: string },
): Promise<TelnyxCreateCallResult> {
  const apiKey = deps?.apiKey ?? getEnv().TELNYX_API_KEY;
  const operation = deps?.operation ?? 'call_control.create_call';
  try {
    const result = await telnyxHttpJson({
      method: 'POST',
      path: 'calls',
      body,
      timeoutMs: getTelnyxCallsCreateTimeoutMs(),
      operation,
      apiKey,
      fetchImpl: deps?.fetchImpl,
      correlation: deps?.correlation,
    });
    const parsed = result.parsedJson;
    return {
      ok: true,
      status: result.status,
      text: result.rawText.slice(0, 500),
      durationMs: result.durationMs,
      data: parsed,
      callControlId: extractCallControlIdFromTelnyxCreateCallResponse(parsed) ?? undefined,
      callLegId: extractCallLegIdFromTelnyxCreateCallResponse(parsed) ?? undefined,
      callSessionId: extractCallSessionIdFromTelnyxCreateCallResponse(parsed) ?? undefined,
    };
  } catch (e: unknown) {
    const mapped = mapTelnyxHttpErrorToResult(e);
    if (mapped) return mapped;
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

/** Telnyx Call Control `reject` action — only these values are accepted (API 422 otherwise). */
export type TelnyxCallControlRejectCause = 'CALL_REJECTED' | 'USER_BUSY';

export function buildTelnyxCallRejectPayload(cause: TelnyxCallControlRejectCause): { cause: TelnyxCallControlRejectCause } {
  return { cause };
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

/** @deprecated `/actions/dial` is not supported; use `callControlCreateCall` + bridge/transfer. */
export async function callControlDial(
  _callControlId: string,
  _body: Record<string, unknown>,
  _deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  throw new Error('Unsupported Telnyx action: /actions/dial is not valid; use POST /v2/calls');
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
  commandId?: string,
): Promise<CallControlHttpResult> {
  return postCallControlAction(
    callControlId,
    'bridge',
    { call_control_id: otherLegCallControlId, ...(commandId ? { command_id: commandId } : {}) },
    deps,
  );
}

/** @see https://developers.telnyx.com/api/call-control/playback-start */
export async function callControlPlaybackStart(
  callControlId: string,
  audioUrl: string,
  loop: 'infinity' | number = 'infinity',
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'playback_start', { audio_url: audioUrl, loop }, deps);
}

/** @see https://developers.telnyx.com/api/call-control/playback-stop */
export async function callControlPlaybackStop(
  callControlId: string,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  return postCallControlAction(callControlId, 'playback_stop', {}, deps);
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
