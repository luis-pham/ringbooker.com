import { z } from 'zod';

import { canUseOwnerTransfer } from '@/src/backend/domain/shop-plan-capabilities';
import type { AgentToolContext } from '@/src/agent/tools/types';
import { getResolvedHandoffTransport, getResolvedVoiceTransport } from '@/src/backend/config/voice-transport';
import { logger } from '@/src/backend/observability/logger';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import {
  evaluateOwnerHandoffDestination,
  logBlockedOwnerHandoffDestination,
} from '@/src/backend/services/calls/destination-policy';
import { consumeRateLimit, RATE_LIMIT_POLICIES } from '@/src/backend/security/rate-limit';
import { normalizePhone } from '@/lib/phone-number';
import { isWithinHours } from '@/lib/time-utils';
import type { Shop } from '@/src/backend/domain/types';

const schema = z.object({
  reason: z.enum([
    'caller_requested_human',
    'angry_or_complaint',
    'complex_booking',
    'same_day_urgent_change',
    'pricing_or_policy_uncertain',
    'vip_or_high_value',
    'ai_uncertain',
    'other',
  ]),
  urgency: z.enum(['low', 'normal', 'high']),
  summary: z.string().min(1).max(2000),
  caller_name: z.string().min(1).max(200).optional(),
  service_requested: z.string().min(1).max(500).optional(),
  preferred_time: z.string().min(1).max(200).optional(),
});

export type RequestHumanHandoffResult =
  | {
      success: true;
      handoff_started: true;
      handoff_id?: string;
      message_for_ai: string;
    }
  | {
      success: false;
      handoff_possible: false;
      fallback: 'send_summary';
      message_for_ai: string;
    }
  | {
      success: false;
      handoff_possible: true;
      handoff_started: false;
      fallback: 'send_summary';
      message_for_ai: string;
    };

export function isHandoffAvailable(shop: Shop): { available: boolean; reason?: 'outside_business_hours' | 'outside_custom_hours' } {
  switch (shop.handoff_availability) {
    case 'always':
      return { available: true };
    case 'custom':
      if (!shop.handoff_custom_hours || !shop.timezone) return { available: true };
      return isWithinHours(shop.handoff_custom_hours, shop.timezone)
        ? { available: true }
        : { available: false, reason: 'outside_custom_hours' };
    case 'business_hours':
    default:
      if (!shop.hours || Object.keys(shop.hours).length === 0 || !shop.timezone) return { available: true };
      return isWithinHours(shop.hours, shop.timezone)
        ? { available: true }
        : { available: false, reason: 'outside_business_hours' };
  }
}

/**
 * Telnyx Call Control handoff for OpenAI SIP direct — requires parent PSTN `call_control_id`
 * (via Call Control ingress + client_state). Pure TeXML → OpenAI SIP does not carry that id → controlled failure.
 */
export async function requestHumanHandoffTool(
  ctx: AgentToolContext & {
    parentTelnyxCallControlId?: string | null;
    rbCallId?: string;
  },
  input: unknown,
): Promise<RequestHumanHandoffResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "I wasn't able to start a live handoff. I can take your details and make sure the team follows up.",
    };
  }

  if (!ctx.shop.allow_transfers || !canUseOwnerTransfer(ctx.shop.plan)) {
    if (ctx.shop.allow_transfers && !canUseOwnerTransfer(ctx.shop.plan)) {
      logger.warn(
        { shopId: ctx.shop.id, plan: ctx.shop.plan, feature: 'owner_transfer' },
        'plan_feature_locked_handoff_skipped',
      );
    }
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        'Live transfer is not available right now. I can note your request and arrange a callback or text follow-up.',
    };
  }

  const availability = isHandoffAvailable(ctx.shop);
  if (!availability.available) {
    logger.info({ shopId: ctx.shop.id, reason: availability.reason }, 'handoff_outside_availability_hours');
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "The team isn't available to take calls right now. I can make sure they get your details and follow up during business hours.",
    };
  }

  const ownerPhone = ctx.shop.handoff_phone?.trim();
  if (!ownerPhone) {
    logger.warn({ shopId: ctx.shop.id }, 'handoff_phone_not_configured');
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "Transfer is not available right now. Capture the caller's name and request, and let them know the team will follow up shortly. Use ctx.callerPhone as the callback number. Only ask for phone if ctx.callerPhone is null, empty, or invalid, or if the caller explicitly requests a different callback number.",
    };
  }

  // Loop detection: if ownerPhone is our own Telnyx inbound number, the call would loop.
  const countryCode = ctx.shop.country_code ?? 'US';
  const telnyxNumber = ctx.shop.telnyx_number?.trim();
  if (telnyxNumber && normalizePhone(ownerPhone, countryCode) === normalizePhone(telnyxNumber, countryCode)) {
    logger.warn({ shopId: ctx.shop.id, ownerPhone }, 'handoff_loop_detected');
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "I'm unable to transfer your call right now. I'll make sure the team receives your message and they'll get back to you shortly.",
    };
  }
  // Warn (don't block) when ownerPhone matches the business line — possible forwarding loop.
  if (ctx.shop.phone_number && normalizePhone(ownerPhone, countryCode) === normalizePhone(ctx.shop.phone_number, countryCode)) {
    logger.warn({ shopId: ctx.shop.id, ownerPhone }, 'handoff_target_matches_business_line');
  }

  const destination = evaluateOwnerHandoffDestination({
    shop: ctx.shop,
    ownerPhone,
  });
  if (!destination.ok) {
    logBlockedOwnerHandoffDestination({
      shopId: ctx.shop.id,
      rbCallId: ctx.rbCallId ?? ctx.requestId,
      reason: destination.reason,
    });
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "I'm unable to transfer your call right now. I'll make sure the team receives your message and they'll get back to you shortly.",
    };
  }

  const [shopHandoffLimit, globalHandoffLimit] = await Promise.all([
    consumeRateLimit(RATE_LIMIT_POLICIES.owner_handoff_shop, `shop:${ctx.shop.id}`),
    consumeRateLimit(RATE_LIMIT_POLICIES.owner_handoff_global, 'global'),
  ]);
  if (!shopHandoffLimit.ok || !globalHandoffLimit.ok) {
    logger.warn(
      { shopId: ctx.shop.id, shopLimited: !shopHandoffLimit.ok, globalLimited: !globalHandoffLimit.ok },
      'owner_handoff_rate_limited',
    );
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "I'm unable to transfer your call right now. I'll make sure the team receives your message and they'll get back to you shortly.",
    };
  }

  if (getResolvedVoiceTransport() !== 'openai_sip_direct') {
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        'Live handoff is not available on this voice path. I can take your details and have the team follow up.',
    };
  }

  const handoffTransport = getResolvedHandoffTransport();
  if (handoffTransport !== 'telnyx_call_control') {
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        'I cannot connect a live person on this line right now. I can pass your request to the team to follow up.',
    };
  }

  const parentId = ctx.parentTelnyxCallControlId?.trim() ?? '';
  if (!parentId) {
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        "I can't connect you to a person on this call path, but I can make sure the team gets your request and follows up.",
    };
  }

  if (!ctx.billingSubscriptionsRepository || !ctx.shopAccessStatesRepository) {
    logger.warn(
      { event: 'live_answering_billing_blocked', shop_id: ctx.shop.id, reason: 'billing_gate_unavailable', call_control_id: parentId },
      'live_answering_billing_blocked',
    );
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        'Live handoff is not available right now. I can take your details and make sure the team follows up.',
    };
  }

  const access = await getShopBillingAccess(
    {
      shopsRepository: ctx.shopsRepository,
      billingSubscriptionsRepository: ctx.billingSubscriptionsRepository,
      shopAccessStatesRepository: ctx.shopAccessStatesRepository,
    },
    { shopId: ctx.shop.id },
  );
  if (!access.canReceiveLiveCalls) {
    logger.warn(
      {
        event: 'live_answering_billing_blocked',
        shop_id: ctx.shop.id,
        user_id: null,
        billing_status: access.subscriptionStatus,
        payment_method_status: access.paymentMethodStatus,
        provider_subscription_id: access.providerSubscriptionId,
        go_live_state: access.liveCallsEnabled ? 'live_enabled' : 'live_disabled',
        reason: access.blockReason,
        call_control_id: parentId,
        call_session_id: ctx.rbCallId ?? ctx.requestId,
      },
      'live_answering_billing_blocked',
    );
    return {
      success: false,
      handoff_possible: false,
      fallback: 'send_summary',
      message_for_ai:
        'Live handoff is not available right now. I can take your details and make sure the team follows up.',
    };
  }

  const rbCallId = ctx.rbCallId ?? ctx.requestId;

  const dialResult = await ctx.telephonyService.requestHumanHandoffViaCallControl({
    shopId: ctx.shop.id,
    parentCallControlId: parentId,
    openAiLegCallControlId: ctx.openAiLegCallControlId ?? undefined,
    ownerPhone: destination.e164,
    ownerPhoneVerified: ctx.shop.sms_owner_opted_in === true,
    shopCountryCode: ctx.shop.country_code ?? 'US',
    inboundDid: ctx.shop.phone_number ?? ctx.shop.telnyx_number ?? '',
    rbCallId,
    reason: parsed.data.reason,
    urgency: parsed.data.urgency,
    summary: parsed.data.summary,
    callerPhone: ctx.callerPhone,
    callerName: parsed.data.caller_name,
    serviceRequested: parsed.data.service_requested,
    preferredTime: parsed.data.preferred_time,
    idempotencyKey: `handoff_attempt:${rbCallId}:${ctx.shop.id}`,
  });

  if (dialResult.started) {
    return {
      success: true,
      handoff_started: true,
      handoff_id: dialResult.handoffId,
      message_for_ai: 'Let me try to reach the team now.',
    };
  }

  if (ctx.jobsRepository && !dialResult.handoffId) {
    try {
      await ctx.jobsRepository.enqueue({
        shopId: ctx.shop.id,
        type: 'handoff_failed_owner_sms',
        payload: {
          rbCallId,
          summary: parsed.data.summary,
          reason: parsed.data.reason,
          urgency: parsed.data.urgency,
          callerPhone: ctx.callerPhone,
          failureCode: dialResult.failureCode ?? 'unknown',
        },
        runAt: new Date(),
        idempotencyKey: `handoff_failed_owner_summary:${rbCallId}:pre_session`,
      });
    } catch (err) {
      logger.warn({ err, shopId: ctx.shop.id, rbCallId }, 'handoff_failed_owner_sms_enqueue_failed');
    }
  }

  return {
    success: false,
    handoff_possible: true,
    handoff_started: false,
    fallback: 'send_summary',
    message_for_ai:
      dialResult.messageForAi ??
      "I wasn't able to reach the team on the phone. I can make sure they get the details and follow up with you.",
  };
}
