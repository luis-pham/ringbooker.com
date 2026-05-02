import {
  callControlDial,
  parseTelnyxCallControlJsonResponse,
  type CallControlHttpResult,
} from '@/src/backend/services/calls/call-control-client';

export type DialOwnerHandoffParams = {
  parentCallControlId: string;
  ownerE164: string;
  fromDidE164: string;
  connectionId: string;
  fetchImpl?: typeof fetch;
  apiKey: string;
  rbCallId: string;
  shopId: string;
  handoffId: string;
  reason: string;
  urgency: string;
  /** Shown to owner in screening; may be null. */
  callerPhone: string | null;
  inboundDid?: string;
  telnyxCallSessionId?: string;
};

const SUMMARY_SCREEN_MAX = 120;

export function sanitizeHandoffSummaryForSpeech(summary: string): string {
  const oneLine = summary.replace(/\s+/g, ' ').trim();
  return oneLine.length <= SUMMARY_SCREEN_MAX ? oneLine : `${oneLine.slice(0, SUMMARY_SCREEN_MAX - 1)}…`;
}

export function buildOwnerScreeningPrompt(params: {
  shopName: string;
  callerLabel: string;
  summary: string;
}): string {
  const sum = sanitizeHandoffSummaryForSpeech(params.summary);
  return (
    `RingBooker call for ${params.shopName}. Caller: ${params.callerLabel}. Reason: ${sum}. ` +
    `Press 1 to accept this call, or press 2 to decline and send a text summary.`
  );
}

export function buildOwnerHandoffDialClientState(params: {
  shopId: string;
  requestId: string;
  rbCallId: string;
  callerPhone: string | null;
  parentCallControlId: string;
  handoffId: string;
  ownerPhoneE164: string;
  reason: string;
  urgency: string;
  inboundDid?: string;
  telnyxCallSessionId?: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      shopId: params.shopId,
      requestId: params.requestId,
      callerPhone: params.callerPhone,
      ts: new Date().toISOString(),
      rbCallId: params.rbCallId,
      telnyxCallControlId: params.parentCallControlId,
      inboundDid: params.inboundDid,
      telnyxCallSessionId: params.telnyxCallSessionId,
      transport: 'openai_sip_direct',
      handoffTransport: 'telnyx_call_control',
      purpose: 'owner_handoff_leg',
      handoffId: params.handoffId,
      parentCallControlId: params.parentCallControlId,
      ownerPhone: params.ownerPhoneE164,
      reason: params.reason,
      urgency: params.urgency,
    }),
    'utf8',
  ).toString('base64');
}

export type DialOwnerResult = CallControlHttpResult & {
  ownerDialCallControlId?: string;
};

/**
 * Dials the shop owner from the **parent** inbound Call Control leg.
 * Screening + DTMF gather + bridge are handled via Call Control webhooks (handoff-orchestrator).
 */
export async function dialOwnerFromParentCall(params: DialOwnerHandoffParams): Promise<DialOwnerResult> {
  const client_state = buildOwnerHandoffDialClientState({
    shopId: params.shopId,
    requestId: params.rbCallId,
    rbCallId: params.rbCallId,
    callerPhone: params.callerPhone,
    parentCallControlId: params.parentCallControlId,
    handoffId: params.handoffId,
    ownerPhoneE164: params.ownerE164,
    reason: params.reason,
    urgency: params.urgency,
    inboundDid: params.inboundDid,
    telnyxCallSessionId: params.telnyxCallSessionId,
  });

  const result = await callControlDial(
    params.parentCallControlId,
    {
      to: params.ownerE164,
      from: params.fromDidE164,
      connection_id: params.connectionId,
      timeout_secs: 20,
      client_state,
    },
    {
      fetchImpl: params.fetchImpl,
      apiKey: params.apiKey,
      correlation: {
        rbCallId: params.rbCallId,
        handoffId: params.handoffId,
        shopId: params.shopId,
      },
    },
  );

  let ownerDialCallControlId: string | undefined;
  const parsed = parseTelnyxCallControlJsonResponse(result.text);
  const maybeId = parsed?.data?.call_control_id;
  if (typeof maybeId === 'string' && maybeId.trim()) {
    ownerDialCallControlId = maybeId.trim();
  }

  return { ...result, ownerDialCallControlId };
}
