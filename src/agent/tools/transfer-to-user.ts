import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  reason: z.string().min(1),
});

export async function transferToUserTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: boolean; target: 'user' | 'frontdesk' | 'voicemail'; providerCallId?: string } | ToolError> {
  if (!ctx.shop.allow_transfers) {
    return toToolError('Live transfers are disabled for this shop right now. I can help schedule a callback instead.', {
      code: 'TRANSFER_FAILED',
      retryable: false,
    });
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid transfer reason.', { code: 'VALIDATION_ERROR', retryable: false });

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
