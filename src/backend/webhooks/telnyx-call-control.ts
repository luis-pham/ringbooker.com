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
 * Phase 3: optional `POST /v2/calls` + bridge to `OPENAI_SIP_URI` after inbound `call.answered`; `call.hangup` closes logs / missed-call SMS.
 */
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import type { VoicePromptVertical } from '@/src/agent/prompts';
import type { Shop } from '@/src/backend/domain/types';
import type {
  BillingSubscriptionsRepository,
  ForwardingTestSessionsRepository,
  JobsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { getEnv } from '@/src/backend/config/env';
import { resolveVerticalDemoInboundRoute } from '@/src/backend/demo/demo-vertical-phone-map';
import {
  getResolvedHandoffTransport,
  getResolvedVoiceTransport,
  getTelnyxInboundRoutingMode,
} from '@/src/backend/config/voice-transport';
import { isShopCallable } from '@/src/backend/services/calls/callable-check';
import { getShopBillingAccess, type ShopBillingAccess } from '@/src/backend/services/billing/access';
import {
  normalizeInboundE164,
  resolveShopByInboundDidWithMeta,
  type ResolveShopByInboundDidResult,
} from '@/src/backend/services/calls/shop-resolver';
import { completeForwardingTestFromInboundCall } from '@/src/backend/services/go-live/forwarding-test-inbound';

export const telnyxCallControlEnvelopeSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string(),
    payload: z.unknown().optional(),
  }),
});

export type TelnyxCallControlParsedEvent = z.infer<typeof telnyxCallControlEnvelopeSchema>['data'];

/** Canonical reject reason for logs / metrics (aligned with `evaluateTelnyxCallControlInboundInitiated`). */
export type TelnyxCallControlInboundRejectReason =
  | 'shop_not_found'
  | 'shop_inactive'
  | 'call_control_webhook_disabled'
  | 'unsupported_direction'
  | 'missing_call_control_id'
  | 'missing_inbound_did'
  | 'missing_openai_sip_uri'
  | 'bridge_openai_sip_disabled'
  | 'invalid_inbound_routing_mode'
  | 'voice_transport_not_openai_sip_direct'
  | 'handoff_transport_not_telnyx_call_control'
  | 'unknown';

export type TelnyxCallControlTelnyxRejectCause = 'CALL_REJECTED' | 'USER_BUSY';

export type TelnyxCallControlResolverSnapshot = {
  inboundDid: string | null;
  matchedBy: 'telnyx_number' | 'phone_number' | 'none' | 'demo_number';
  telnyxNumberMatch: boolean;
  shopId?: string;
  shopName?: string;
  shopActive?: boolean;
  allowTransfers?: boolean;
  aiVoiceConfigured?: boolean;
  callableBlockReason?: string;
  /** Present when inbound matched merged vertical demo DID map (Call Control). */
  demoNumberMatched?: boolean;
  demoVertical?: VoicePromptVertical;
  shopLookupSkippedForDemo?: boolean;
};

export type TelnyxCallControlPhase1Result =
  | { handled: false; reason: 'invalid_json' | 'invalid_envelope' | 'unsupported_event' | 'not_incoming' }
  | {
      handled: true;
      decision: 'reject' | 'dry_run' | 'answer';
      /** Legacy / internal detail (tests, debugging). */
      reason?: string;
      reject_reason?: TelnyxCallControlInboundRejectReason;
      reject_cause_telnyx?: TelnyxCallControlTelnyxRejectCause;
      resolver?: TelnyxCallControlResolverSnapshot;
      shopId?: string;
      clientState?: string;
      callControlId?: string;
      internalRequestId?: string;
      destinationPhone?: string;
      callerPhone?: string | null;
      /** `demo` = vertical demo DID (no shop plan gate). `shop` = production tenant. */
      routeKind?: 'demo' | 'shop';
      demoVertical?: VoicePromptVertical;
      /** Inbound forwarding connectivity check — answered with a short prompt; does not bridge OpenAI. */
      forwardingConnectivityTest?: boolean;
      billingAccess?: Pick<
        ShopBillingAccess,
        | 'blockReason'
        | 'billingProvider'
        | 'subscriptionStatus'
        | 'paymentMethodStatus'
        | 'providerCustomerId'
        | 'providerSubscriptionId'
        | 'liveCallsEnabled'
      >;
    };

export type TelnyxCallControlPhase1HandledResult = Extract<TelnyxCallControlPhase1Result, { handled: true }>;

export function telnyxInboundRejectCauseFor(
  reason: TelnyxCallControlInboundRejectReason,
): TelnyxCallControlTelnyxRejectCause {
  return reason === 'shop_inactive' ? 'USER_BUSY' : 'CALL_REJECTED';
}

function baseResolverFromLookup(meta: ResolveShopByInboundDidResult): TelnyxCallControlResolverSnapshot {
  return {
    inboundDid: meta.inboundDid,
    matchedBy: meta.matchedBy,
    telnyxNumberMatch: meta.matchedBy === 'telnyx_number',
  };
}

function resolverFromShop(shop: Shop, meta: ResolveShopByInboundDidResult): TelnyxCallControlResolverSnapshot {
  return {
    ...baseResolverFromLookup(meta),
    shopId: shop.id,
    shopName: shop.name,
    shopActive: shop.active,
    allowTransfers: shop.allow_transfers,
    aiVoiceConfigured: Boolean(shop.ai_voice?.trim()),
  };
}

export type CallControlClientStatePayload = {
  /** Production shop id, or `PUBLIC_DEMO_SHOP_ID` for vertical demo Call Control legs (DB FK for voice_call_legs). */
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
   * `forwarding_connectivity_test` — shop inbound during pending forwarding test; speak + hang up (no AI).
   * Inbound path leaves this unset.
   */
  purpose?: 'owner_handoff_leg' | 'openai_sip_leg' | 'vertical_demo_inbound' | 'forwarding_connectivity_test' | string;
  handoffId?: string;
  parentCallControlId?: string;
  ownerPhone?: string;
  reason?: string;
  urgency?: string;
  /** When `demo`, OpenAI SIP accept uses public demo prompt for `demoVertical` (not shop production). */
  routeKind?: 'demo' | 'shop';
  /** Marketing vertical slug, e.g. `nail-salon` (only when routeKind is `demo`). */
  demoVertical?: string;
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
    if (typeof parsed.routeKind === 'string' && (parsed.routeKind === 'demo' || parsed.routeKind === 'shop')) {
      base.routeKind = parsed.routeKind;
    }
    if (typeof parsed.demoVertical === 'string' && parsed.demoVertical.trim()) {
      base.demoVertical = parsed.demoVertical.trim();
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

export function isCallBridgedEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t.includes('call.bridged') || t.includes('call_bridged');
}

export function isCallCostEvent(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return t === 'call.cost' || t === 'call_cost';
}

/** Telnyx `call.bridged` — peer leg id field name varies by API version. */
export function bridgedPeerCallControlIdFromPayload(payload: unknown): string | null {
  return firstStringFromPayload(payload, [
    'peer_call_control_id',
    'bridged_call_control_id',
    'bridged_with_call_control_id',
    'other_call_control_id',
  ]);
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
 * Shared env gates for Telnyx → OpenAI SIP bridge (production shop or vertical demo DID).
 * Returns a reject result when misconfigured; `null` when OK to proceed to `answer`.
 */
function runOpenAiSipBridgeEnvGates(params: {
  callControlId: string;
  callerPhone: string | null;
  destinationPhone: string | undefined;
  resolver: TelnyxCallControlResolverSnapshot;
  shopId?: string;
}): TelnyxCallControlPhase1HandledResult | null {
  const env = getEnv();
  if (getTelnyxInboundRoutingMode() !== 'call_control_to_openai_sip') {
    return {
      handled: true,
      decision: 'reject',
      reason: 'invalid_inbound_routing_mode',
      reject_reason: 'invalid_inbound_routing_mode',
      reject_cause_telnyx: 'CALL_REJECTED',
      shopId: params.shopId,
      callControlId: params.callControlId,
      destinationPhone: params.destinationPhone,
      callerPhone: params.callerPhone,
      resolver: params.resolver,
    };
  }

  if (getResolvedVoiceTransport() !== 'openai_sip_direct') {
    return {
      handled: true,
      decision: 'reject',
      reason: 'voice_transport_mismatch',
      reject_reason: 'voice_transport_not_openai_sip_direct',
      reject_cause_telnyx: 'CALL_REJECTED',
      shopId: params.shopId,
      callControlId: params.callControlId,
      destinationPhone: params.destinationPhone,
      callerPhone: params.callerPhone,
      resolver: params.resolver,
    };
  }

  if (getResolvedHandoffTransport() !== 'telnyx_call_control') {
    return {
      handled: true,
      decision: 'reject',
      reason: 'handoff_transport_mismatch',
      reject_reason: 'handoff_transport_not_telnyx_call_control',
      reject_cause_telnyx: 'CALL_REJECTED',
      shopId: params.shopId,
      callControlId: params.callControlId,
      destinationPhone: params.destinationPhone,
      callerPhone: params.callerPhone,
      resolver: params.resolver,
    };
  }

  if (!env.TELNYX_CALL_CONTROL_BRIDGE_OPENAI_SIP) {
    return {
      handled: true,
      decision: 'reject',
      reason: 'bridge_disabled',
      reject_reason: 'bridge_openai_sip_disabled',
      reject_cause_telnyx: 'CALL_REJECTED',
      shopId: params.shopId,
      callControlId: params.callControlId,
      destinationPhone: params.destinationPhone,
      callerPhone: params.callerPhone,
      resolver: params.resolver,
    };
  }

  const sip = env.OPENAI_SIP_URI?.trim() ?? '';
  if (!/^sips?:/i.test(sip)) {
    return {
      handled: true,
      decision: 'reject',
      reason: 'missing_openai_sip_uri',
      reject_reason: 'missing_openai_sip_uri',
      reject_cause_telnyx: 'CALL_REJECTED',
      shopId: params.shopId,
      callControlId: params.callControlId,
      destinationPhone: params.destinationPhone,
      callerPhone: params.callerPhone,
      resolver: params.resolver,
    };
  }

  return null;
}

/**
 * Core routing for inbound `call.initiated` payload (after envelope parse + event filter).
 */
export async function evaluateTelnyxCallControlInboundInitiated(
  payload: unknown,
  deps: {
    shopsRepository: ShopsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
    shopAccessStatesRepository?: ShopAccessStatesRepository;
    forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
    jobsRepository?: JobsRepository;
  },
): Promise<TelnyxCallControlPhase1Result> {
  if (!isIncomingCallPayload(payload)) {
    return { handled: false, reason: 'not_incoming' };
  }

  const callControlId = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
  if (!callControlId) {
    return {
      handled: true,
      decision: 'reject',
      reason: 'missing_call_control_id',
      reject_reason: 'missing_call_control_id',
      reject_cause_telnyx: telnyxInboundRejectCauseFor('missing_call_control_id'),
    };
  }

  const toRaw =
    firstStringFromPayload(payload, ['to', 'called_number', 'to_number']) ??
    firstStringFromPayload(payload, ['destination']);
  const fromRaw = firstStringFromPayload(payload, ['from', 'from_number', 'caller_number']);
  const callerPhone = normalizeInboundE164(fromRaw);

  if (!toRaw?.trim()) {
    return {
      handled: true,
      decision: 'reject',
      reason: 'missing_to',
      reject_reason: 'missing_inbound_did',
      reject_cause_telnyx: telnyxInboundRejectCauseFor('missing_inbound_did'),
      callControlId,
      callerPhone,
      resolver: { inboundDid: null, matchedBy: 'none', telnyxNumberMatch: false },
    };
  }

  const env = getEnv();
  const destinationPhone = normalizeInboundE164(toRaw) ?? undefined;
  const demoCtx = destinationPhone ? resolveVerticalDemoInboundRoute(destinationPhone, env) : null;

  if (demoCtx) {
    const demoResolver: TelnyxCallControlResolverSnapshot = {
      inboundDid: destinationPhone ?? null,
      matchedBy: 'demo_number',
      telnyxNumberMatch: false,
      demoNumberMatched: true,
      demoVertical: demoCtx.vertical,
      shopLookupSkippedForDemo: true,
    };
    const gate = runOpenAiSipBridgeEnvGates({
      callControlId,
      callerPhone,
      destinationPhone,
      resolver: demoResolver,
      shopId: env.PUBLIC_DEMO_SHOP_ID,
    });
    if (gate) return gate;

    const internalRequestId = randomUUID();
    const callSessionId = firstStringFromPayload(payload, ['call_session_id']);
    const clientState = buildCallControlClientState({
      shopId: env.PUBLIC_DEMO_SHOP_ID,
      requestId: internalRequestId,
      callerPhone,
      ts: new Date().toISOString(),
      rbCallId: internalRequestId,
      telnyxCallControlId: callControlId,
      inboundDid: destinationPhone,
      telnyxCallSessionId: callSessionId ?? undefined,
      transport: 'openai_sip_direct',
      handoffTransport: 'telnyx_call_control',
      routeKind: 'demo',
      demoVertical: demoCtx.vertical,
      purpose: 'vertical_demo_inbound',
    });

    const dryRunDemo = isTelnyxCallControlDryRunEnv();
    return {
      handled: true,
      decision: dryRunDemo ? 'dry_run' : 'answer',
      reason: 'vertical_demo_did_matched',
      routeKind: 'demo',
      demoVertical: demoCtx.vertical,
      shopId: env.PUBLIC_DEMO_SHOP_ID,
      clientState,
      callControlId,
      internalRequestId,
      destinationPhone,
      callerPhone,
      resolver: demoResolver,
    };
  }

  const meta = await resolveShopByInboundDidWithMeta(deps, toRaw);
  const destinationPhoneShop = meta.inboundDid ?? normalizeInboundE164(toRaw) ?? undefined;

  if (!meta.shop) {
    return {
      handled: true,
      decision: 'reject',
      reason: 'unknown_did',
      reject_reason: 'shop_not_found',
      reject_cause_telnyx: telnyxInboundRejectCauseFor('shop_not_found'),
      callControlId,
      destinationPhone: destinationPhoneShop,
      callerPhone,
      resolver: baseResolverFromLookup(meta),
    };
  }

  const shop = meta.shop;
  const callable = isShopCallable(shop);
  if (!callable.ok) {
    const reject_reason: TelnyxCallControlInboundRejectReason =
      callable.reason === 'shop_inactive' ? 'shop_inactive' : 'unknown';
    return {
      handled: true,
      decision: 'reject',
      reason: callable.reason,
      reject_reason,
      reject_cause_telnyx: telnyxInboundRejectCauseFor(reject_reason),
      shopId: shop.id,
      callControlId,
      destinationPhone: destinationPhoneShop,
      callerPhone,
      resolver: { ...resolverFromShop(shop, meta), callableBlockReason: callable.reason },
    };
  }

  let completedForwardingTestThisEvent = false;
  if (
    meta.matchedBy === 'telnyx_number' &&
    deps.forwardingTestSessionsRepository &&
    deps.shopAccessStatesRepository &&
    meta.inboundDid
  ) {
    const callSessionIdForTest = firstStringFromPayload(payload, ['call_session_id']);
    completedForwardingTestThisEvent = await completeForwardingTestFromInboundCall({
      forwardingTestSessionsRepository: deps.forwardingTestSessionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      shopId: shop.id,
      inboundDidE164: meta.inboundDid,
      inboundCallSessionId: callSessionIdForTest ?? null,
      inboundCallControlId: callControlId,
      callerPhone,
      now: new Date(),
    });
    if (completedForwardingTestThisEvent && deps.jobsRepository) {
      const subscription = deps.billingSubscriptionsRepository
        ? await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id).catch(() => null)
        : null;
      await deps.jobsRepository.enqueue({
        shopId: shop.id,
        type: 'lifecycle_email',
        payload: { kind: 'forwarding_verified', subscriptionId: subscription?.id ?? null },
        runAt: new Date(),
        idempotencyKey: `lifecycle_email:${shop.id}:${subscription?.id ?? 'none'}:forwarding_verified`,
      }).catch(() => undefined);
    }
  }

  if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
      },
      { shopId: shop.id },
    );
    if (!access.canReceiveLiveCalls) {
      if (completedForwardingTestThisEvent) {
        const internalRequestId = randomUUID();
        const callSessionId = firstStringFromPayload(payload, ['call_session_id']);
        const clientState = buildCallControlClientState({
          shopId: shop.id,
          requestId: internalRequestId,
          callerPhone,
          ts: new Date().toISOString(),
          rbCallId: internalRequestId,
          telnyxCallControlId: callControlId,
          inboundDid: destinationPhoneShop,
          telnyxCallSessionId: callSessionId ?? undefined,
          purpose: 'forwarding_connectivity_test',
          routeKind: 'shop',
        });
        const dryRunFwd = isTelnyxCallControlDryRunEnv();
        return {
          handled: true,
          decision: dryRunFwd ? 'dry_run' : 'answer',
          reason: 'forwarding_connectivity_test',
          routeKind: 'shop',
          shopId: shop.id,
          clientState,
          callControlId,
          internalRequestId,
          destinationPhone: destinationPhoneShop,
          callerPhone,
          resolver: resolverFromShop(shop, meta),
          forwardingConnectivityTest: true,
        };
      }
      return {
        handled: true,
        decision: 'reject',
        reason: access.blockReason,
        reject_reason: 'shop_inactive',
        reject_cause_telnyx: telnyxInboundRejectCauseFor('shop_inactive'),
        shopId: shop.id,
        callControlId,
        destinationPhone: destinationPhoneShop,
        callerPhone,
        resolver: { ...resolverFromShop(shop, meta), callableBlockReason: access.blockReason },
        billingAccess: {
          blockReason: access.blockReason,
          billingProvider: access.billingProvider,
          subscriptionStatus: access.subscriptionStatus,
          paymentMethodStatus: access.paymentMethodStatus,
          providerCustomerId: access.providerCustomerId,
          providerSubscriptionId: access.providerSubscriptionId,
          liveCallsEnabled: access.liveCallsEnabled,
        },
      };
    }
  }

  const shopResolver = resolverFromShop(shop, meta);
  const gateShop = runOpenAiSipBridgeEnvGates({
    callControlId,
    callerPhone,
    destinationPhone: destinationPhoneShop,
    resolver: shopResolver,
    shopId: shop.id,
  });
  if (gateShop) return { ...gateShop, routeKind: 'shop' };

  const internalRequestId = randomUUID();
  const callSessionId = firstStringFromPayload(payload, ['call_session_id']);
  const clientState = buildCallControlClientState({
    shopId: shop.id,
    requestId: internalRequestId,
    callerPhone,
    ts: new Date().toISOString(),
    rbCallId: internalRequestId,
    telnyxCallControlId: callControlId,
    inboundDid: destinationPhoneShop,
    telnyxCallSessionId: callSessionId ?? undefined,
    transport: 'openai_sip_direct',
    handoffTransport: 'telnyx_call_control',
    routeKind: 'shop',
  });

  const dryRun = isTelnyxCallControlDryRunEnv();
  return {
    handled: true,
    decision: dryRun ? 'dry_run' : 'answer',
    reason: 'shop_resolved_and_mode_enabled',
    routeKind: 'shop',
    shopId: shop.id,
    clientState,
    callControlId,
    internalRequestId,
    destinationPhone: destinationPhoneShop,
    callerPhone,
    resolver: shopResolver,
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
