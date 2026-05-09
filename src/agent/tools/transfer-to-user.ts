import { z } from 'zod';

import { canUseOwnerTransfer } from '@/src/backend/domain/shop-plan-capabilities';
import type { ToolError } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import { getShopBillingAccess } from '@/src/backend/services/billing/access';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  reason: z.string().min(1),
});

export async function transferToUserTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: boolean; target: 'user' | 'frontdesk' | 'voicemail'; providerCallId?: string } | ToolError> {
  if (!ctx.shop.allow_transfers || !canUseOwnerTransfer(ctx.shop.plan)) {
    if (ctx.shop.allow_transfers && !canUseOwnerTransfer(ctx.shop.plan)) {
      logger.warn(
        { shopId: ctx.shop.id, plan: ctx.shop.plan, feature: 'owner_transfer' },
        'plan_feature_locked_transfer_skipped',
      );
    }
    return toToolError('Live transfers are disabled for this shop right now. I can help schedule a callback instead.', {
      code: 'TRANSFER_FAILED',
      retryable: false,
    });
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid transfer reason.', { code: 'VALIDATION_ERROR', retryable: false });

  if (!ctx.billingSubscriptionsRepository || !ctx.shopAccessStatesRepository) {
    logger.warn(
      { event: 'live_answering_billing_blocked', shop_id: ctx.shop.id, reason: 'billing_gate_unavailable' },
      'live_answering_billing_blocked',
    );
    return toToolError('Live transfers are unavailable right now. I can help schedule a callback instead.', {
      code: 'TRANSFER_FAILED',
      retryable: false,
    });
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
        call_control_id: ctx.parentTelnyxCallControlId ?? null,
        call_session_id: ctx.rbCallId ?? ctx.requestId,
      },
      'live_answering_billing_blocked',
    );
    return toToolError('Live transfers are unavailable right now. I can help schedule a callback instead.', {
      code: 'TRANSFER_FAILED',
      retryable: false,
    });
  }

  try {
    const result = await ctx.telephonyService.transferLiveCallToUser({
      shopId: ctx.shop.id,
      userPhone: ctx.shop.user_phone,
      roomName: ctx.roomName,
      reason: parsed.data.reason,
      idempotencyKey: `transfer:${ctx.requestId}:${ctx.shop.id}:${ctx.roomName}`,
    });

    return {
      success: result.initiated,
      target: result.target,
      providerCallId: result.providerCallId,
    };
  } catch {
    return toToolError('The user is unavailable right now. I can have them call you back shortly.', {
      code: 'TRANSFER_FAILED',
      retryable: true,
    });
  }
}
