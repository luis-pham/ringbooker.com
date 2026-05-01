import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  callerPhone: z.string().min(1),
  callerName: z.string().min(1).optional(),
  serviceInterest: z.string().min(1).optional(),
});

export async function sendBookingLinkTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: true; message: string } | { success: false; message: string } | ToolError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid booking link SMS request.', { code: 'VALIDATION_ERROR', retryable: false });

  const bookingUrl = ctx.shop.booking_url?.trim();
  if (!bookingUrl) {
    return {
      success: false,
      message: 'No booking link configured for this business. Ask the caller to contact the business directly.',
    };
  }

  const callerName = parsed.data.callerName?.trim() || 'there';
  const serviceInterest = parsed.data.serviceInterest?.trim() || 'appointment';
  const smsText = `${ctx.shop.name}: Hi ${callerName}! Here is the link to book your ${serviceInterest} appointment:\n${bookingUrl}`;

  try {
    await ctx.jobsRepository.enqueue({
      shopId: ctx.shop.id,
      type: 'booking_link_sms',
      payload: {
        shopId: ctx.shop.id,
        toPhone: parsed.data.callerPhone,
        message: smsText,
        bookingUrl,
      },
      runAt: new Date(),
      idempotencyKey: `booking-link:${ctx.requestId}:${parsed.data.callerPhone}`,
    });
  } catch {
    return toToolError('I could not send the booking link right now. Ask the caller to contact the business directly.', {
      code: 'INTERNAL',
      retryable: true,
    });
  }

  return {
    success: true,
    message: `Booking link sent to ${parsed.data.callerPhone}`,
  };
}
