import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  customerName: z.string().min(1).optional(),
  reason: z.string().min(1),
});

export async function scheduleCallbackTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: true; callbackJobId: string } | ToolError> {
  if (!ctx.shop.allow_callbacks) {
    return toToolError('This shop has callbacks disabled right now, but the user can help you directly during business hours.', {
      code: 'RATE_LIMITED',
      retryable: false,
    });
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid callback request.', { code: 'VALIDATION_ERROR', retryable: false });

  try {
    const callback = await ctx.callbacksRepository.create({
      shopId: ctx.shop.id,
      customerPhone: ctx.callerPhone,
      customerName: parsed.data.customerName ?? null,
      reason: parsed.data.reason,
      requestId: ctx.requestId,
    });
    const idempotencyKey = `callback-owner-alert:${ctx.requestId}:${callback.id}`;
    await ctx.jobsRepository.enqueue({
      shopId: ctx.shop.id,
      type: 'callback_request_owner_alert',
      payload: {
        callbackId: callback.id,
        callerPhone: ctx.callerPhone,
        callerName: parsed.data.customerName,
        reason: parsed.data.reason,
      },
      runAt: new Date(),
      idempotencyKey,
    });
    return {
      success: true,
      callbackJobId: idempotencyKey,
    };
  } catch {
    return toToolError('I could not schedule that callback right now, but someone will follow up with you.', {
      code: 'INTERNAL',
      retryable: true,
    });
  }
}
