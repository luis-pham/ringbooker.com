import { getEnv } from '@/src/backend/config/env';

export type CallControlHttpResult = { ok: boolean; status: number; text: string };

export type CallControlClientDeps = {
  fetchImpl?: typeof fetch;
  apiKey?: string;
};

/**
 * POST https://api.telnyx.com/v2/calls/{call_control_id}/actions/{action}
 * @see https://developers.telnyx.com/api/call-control/
 */
export async function postCallControlAction(
  callControlId: string,
  action: string,
  body: Record<string, unknown>,
  deps?: CallControlClientDeps,
): Promise<CallControlHttpResult> {
  const apiKey = deps?.apiKey ?? getEnv().TELNYX_API_KEY;
  const url = `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/${encodeURIComponent(action)}`;
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, text: text.slice(0, 500) };
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
