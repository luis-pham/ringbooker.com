/**
 * Telnyx Call Control — inbound routing (Phase 1–3).
 *
 * Replaces audit gaps from TeXML + OpenAI SIP demo map:
 * - Resolves tenant from inbound `to` DID via DB (`telnyx_number` then `phone_number`).
 * - Carries correlation in base64 `client_state` for subsequent webhooks (multi-tenant isolation).
 *
 * HTTP wiring: `telnyx-call-control-webhook.ts` → POST `/webhooks/telnyx/call-control` when
 * `TELNYX_CALL_CONTROL_WEBHOOK_ENABLED` is true.
 *
 * Phase 3: optional `dial` bridge to `OPENAI_SIP_URI` on `call.answered`; `call.hangup` closes logs / missed-call SMS.
 */
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { ShopsRepository } from '@/src/backend/ports/repositories';

import { isShopCallable } from '@/src/backend/services/calls/callable-check';
import { normalizeInboundE164, resolveShopByInboundDid } from '@/src/backend/services/calls/shop-resolver';

export const telnyxCallControlEnvelopeSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    payload: z.unknown().optional(),
  }),
});

export type TelnyxCallControlParsedEvent = z.infer<typeof telnyxCallControlEnvelopeSchema>['data'];

export type TelnyxCallControlPhase1Result =
  | { handled: false; reason: 'invalid_json' | 'invalid_envelope' | 'unsupported_event' | 'not_incoming' }
  | {
      handled: true;
      decision: 'reject' | 'dry_run' | 'answer';
      shopId?: string;
      reason?: string;
      clientState?: string;
      callControlId?: string;
      internalRequestId?: string;
      destinationPhone?: string;
      callerPhone?: string | null;
    };

export type CallControlClientStatePayload = {
  shopId: string;
  requestId: string;
  callerPhone: string | null;
  ts: string;
  /** Same as `requestId` when issued by Call Control inbound — used for logs / correlation. */
  rbCallId?: string;
  /** Inbound Telnyx Call Control leg id (required for owner handoff on OpenAI SIP direct). */
  telnyxCallControlId?: string;
  /** E.164 DID the customer dialed (OpenAI SIP correlation / logs). */
  inboundDid?: string;
  /** Telnyx `call_session_id` for the inbound leg when present. */
  telnyxCallSessionId?: string;
  transport?: 'openai_sip_direct' | string;
  handoffTransport?: 'telnyx_call_control' | string;
  /**
   * `owner_handoff_leg` — outbound owner screening leg (do not dial OpenAI SIP on `call.answered`).
   * Inbound path leaves this unset.
   */
  purpose?: 'owner_handoff_leg' | string;
  handoffId?: string;
  parentCallControlId?: string;
  ownerPhone?: string;
  reason?: string;
  urgency?: string;
};

/** Telnyx echoes this on subsequent Call Control webhooks (base64-encoded JSON string). */
export function buildCallControlClientState(payload: CallControlClientStatePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

export function decodeCallControlClientState(raw: string | null | undefined): CallControlClientStatePayload | null {
  if (!raw?.trim()) return null;
  try {
    const json = Buffer.from(raw.trim(), 'base64').toString('utf8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed.shopId !== 'string' || !parsed.shopId.trim()) return null;
    if (typeof parsed.requestId !== 'string' || !parsed.requestId.trim()) return null;
    const base: CallControlClientStatePayload = {
      shopId: parsed.shopId.trim(),
      requestId: parsed.requestId.trim(),
      callerPhone: typeof parsed.callerPhone === 'string' ? parsed.callerPhone : null,
      ts: typeof parsed.ts === 'string' ? parsed.ts : '',
    };
    if (typeof parsed.rbCallId === 'string' && parsed.rbCallId.trim()) {
      base.rbCallId = parsed.rbCallId.trim();
    }
    if (typeof parsed.telnyxCallControlId === 'string' && parsed.telnyxCallControlId.trim()) {
      base.telnyxCallControlId = parsed.telnyxCallControlId.trim();
    }
    if (typeof parsed.inboundDid === 'string' && parsed.inboundDid.trim()) {
      base.inboundDid = parsed.inboundDid.trim();
    }
    if (typeof parsed.telnyxCallSessionId === 'string' && parsed.telnyxCallSessionId.trim()) {
      base.telnyxCallSessionId = parsed.telnyxCallSessionId.trim();
    }
    if (typeof parsed.transport === 'string' && parsed.transport.trim()) {
      base.transport = parsed.transport.trim();
    }
    if (typeof parsed.handoffTransport === 'string' && parsed.handoffTransport.trim()) {
      base.handoffTransport = parsed.handoffTransport.trim();
    }
    if (typeof parsed.purpose === 'string' && parsed.purpose.trim()) {
      base.purpose = parsed.purpose.trim();
    }
    if (typeof parsed.handoffId === 'string' && parsed.handoffId.trim()) {
      base.handoffId = parsed.handoffId.trim();
    }
    if (typeof parsed.parentCallControlId === 'string' && parsed.parentCallControlId.trim()) {
      base.parentCallControlId = parsed.parentCallControlId.trim();
    }
    if (typeof parsed.ownerPhone === 'string' && parsed.ownerPhone.trim()) {
      base.ownerPhone = parsed.ownerPhone.trim();
    }
    if (typeof parsed.reason === 'string' && parsed.reason.trim()) {
      base.reason = parsed.reason.trim();
    }
    if (typeof parsed.urgency === 'string' && parsed.urgency.trim()) {
      base.urgency = parsed.urgency.trim();
    }
    return base;
  } catch {
    return null;
  }
}

/** Default true — set `TELNYX_CALL_CONTROL_DRY_RUN=false` to send real Call Control commands (answer/reject). */
export function isTelnyxCallControlDryRunEnv(): boolean {
  const v = process.env.TELNYX_CALL_CONTROL_DRY_RUN?.trim().toLowerCase();
  return v !== 'false' && v !== '0';
}

export function firstStringFromPayload(payload: unknown, keys: string[]): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>;
      if (typeof nested.phone_number === 'string' && nested.phone_number.trim().length > 0) {
        return nested.phone_number.trim();
      }
    }
  }
  return null;
}

export function isCallInitiatedEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t.includes('call.initiated') || t.includes('call_initiated');
}

export function isCallAnsweredEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t.includes('call.answered') || t.includes('call_answered');
}

/** Hangup / ended — align with `telnyx.ts` call log lifecycle. */
export function isCallHangupEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t.includes('call.hangup') || t.includes('call.ended') || t.includes('call_hangup');
}

export function isCallGatherEndedEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t.includes('call.gather.ended') || t.includes('gather.ended');
}

export function isOutboundCallPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  const direction =
    (typeof body.direction === 'string' && body.direction) ||
    (typeof body.call_direction === 'string' && body.call_direction) ||
    '';
  const x = direction.toLowerCase();
  return x === 'outbound' || x === 'outgoing';
}

/** Same semantics as `telnyx.ts` missed inbound detection (no answer timestamp + cause). */
export function isTelnyxMissedInboundCall(eventType: string, payload: unknown): boolean {
  if (!eventType.toLowerCase().includes('call')) return false;
  if (!payload || typeof payload !== 'object') return false;
  const body = payload as Record<string, unknown>;
  const directionRaw =
    (typeof body.call_direction === 'string' && body.call_direction) ||
    (typeof body.direction === 'string' && body.direction) ||
    '';
  const direction = directionRaw.toLowerCase();
  if (direction !== 'inbound' && direction !== 'incoming') return false;

  const cause = typeof body.hangup_cause === 'string' ? body.hangup_cause.toLowerCase() : '';
  const answeredAt = firstStringFromPayload(payload, ['answered_at', 'answer_time', 'bridged_at']);
  if (answeredAt) return false;
  return cause.includes('no_answer') || cause.includes('busy') || cause.includes('cancel');
}

export function isIncomingCallPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return true;
  const body = payload as Record<string, unknown>;
  const direction =
    (typeof body.direction === 'string' && body.direction) ||
    (typeof body.call_direction === 'string' && body.call_direction) ||
    '';
  if (!direction.trim()) return true;
  const x = direction.toLowerCase();
  return x === 'incoming' || x === 'inbound';
}

export function parseTelnyxCallControlEnvelope(
  rawBody: string,
): { ok: false; reason: 'invalid_json' | 'invalid_envelope' } | { ok: true; event: TelnyxCallControlParsedEvent } {
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }

  const parsed = telnyxCallControlEnvelopeSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid_envelope' };
  }

  return { ok: true, event: parsed.data.data };
}

/**
 * Core routing for inbound `call.initiated` payload (after envelope parse + event filter).
 */
export async function evaluateTelnyxCallControlInboundInitiated(
  payload: unknown,
  deps: { shopsRepository: ShopsRepository },
): Promise<TelnyxCallControlPhase1Result> {
  if (!isIncomingCallPayload(payload)) {
    return { handled: false, reason: 'not_incoming' };
  }

  const callControlId = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
  if (!callControlId) {
    return { handled: true, decision: 'reject', reason: 'missing_call_control_id' };
  }

  const toRaw =
    firstStringFromPayload(payload, ['to', 'called_number', 'to_number']) ??
    firstStringFromPayload(payload, ['destination']);
  const fromRaw = firstStringFromPayload(payload, ['from', 'from_number', 'caller_number']);
  const destinationPhone = toRaw ? normalizeInboundE164(toRaw) ?? undefined : undefined;
  const callerPhone = normalizeInboundE164(fromRaw);

  const shop = toRaw ? await resolveShopByInboundDid(deps, toRaw) : null;
  if (!shop) {
    return {
      handled: true,
      decision: 'reject',
      reason: 'unknown_did',
      callControlId,
      destinationPhone,
      callerPhone,
    };
  }

  const callable = isShopCallable(shop);
  if (!callable.ok) {
    return {
      handled: true,
      decision: 'reject',
      reason: callable.reason,
      shopId: shop.id,
      callControlId,
      destinationPhone,
      callerPhone,
    };
  }

  const internalRequestId = randomUUID();
  const callSessionId = firstStringFromPayload(payload, ['call_session_id']);
  const clientState = buildCallControlClientState({
    shopId: shop.id,
    requestId: internalRequestId,
    callerPhone,
    ts: new Date().toISOString(),
    rbCallId: internalRequestId,
    telnyxCallControlId: callControlId,
    inboundDid: destinationPhone,
    telnyxCallSessionId: callSessionId ?? undefined,
    transport: 'openai_sip_direct',
    handoffTransport: 'telnyx_call_control',
  });

  const dryRun = isTelnyxCallControlDryRunEnv();
  return {
    handled: true,
    decision: dryRun ? 'dry_run' : 'answer',
    shopId: shop.id,
    clientState,
    callControlId,
    internalRequestId,
    destinationPhone,
    callerPhone,
  };
}

/**
 * Parse full webhook JSON and evaluate inbound `call.initiated` only (unit tests / tooling).
 */
export async function handleTelnyxCallControlPhase1(
  rawBody: string,
  deps: { shopsRepository: ShopsRepository },
): Promise<TelnyxCallControlPhase1Result> {
  const parsed = parseTelnyxCallControlEnvelope(rawBody);
  if (!parsed.ok) {
    return { handled: false, reason: parsed.reason };
  }

  const event = parsed.event;
  if (!isCallInitiatedEvent(event.event_type)) {
    return { handled: false, reason: 'unsupported_event' };
  }

  return evaluateTelnyxCallControlInboundInitiated(event.payload, deps);
}
