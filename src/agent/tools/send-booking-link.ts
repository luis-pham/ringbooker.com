import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  callerName: z.string().min(1).optional(),
  serviceInterest: z.string().min(1).optional(),
});

export async function sendBookingLinkTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<
  | { success: true; message: string }
  | {
      success: false;
      reason?: 'no_phone';
      fallback: 'url';
      bookingUrl: string | null;
      message: string;
    }
  | ToolError
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid booking link SMS request.', { code: 'VALIDATION_ERROR', retryable: false });

  const bookingUrl = ctx.shop.booking_url?.trim();
  if (!bookingUrl) {
    return {
      success: false,
      fallback: 'url',
      bookingUrl: null,
      message: 'Unable to send booking link. Ask the caller if they would like to leave their contact information and the shop will follow up to confirm their appointment.',
    };
  }

  const callerName = parsed.data.callerName?.trim() || 'there';
  const serviceInterest = parsed.data.serviceInterest?.trim() || 'appointment';
  const toPhone = ctx.callerPhone;
  if (!toPhone) {
    logger.warn({ shopId: ctx.shop.id, requestId: ctx.requestId }, 'booking_link_sms_skipped_no_caller_phone');
    return {
      success: false,
      reason: 'no_phone',
      fallback: 'url',
      bookingUrl,
      message: `Unable to send booking link via SMS. Tell the caller they can book directly at: ${bookingUrl}`,
    };
  }

  const smsText = `${ctx.shop.name}: Hi ${callerName}! Here is the link to book your ${serviceInterest} appointment:\n${bookingUrl}\nReply STOP to opt out.`;

  try {
    await ctx.jobsRepository.enqueue({
      shopId: ctx.shop.id,
      type: 'booking_link_sms',
      payload: {
        shopId: ctx.shop.id,
        toPhone,
        message: smsText,
        bookingUrl,
      },
      runAt: new Date(),
      idempotencyKey: `booking-link:${ctx.requestId}:${toPhone}`,
    });
  } catch {
    return toToolError('I could not send the booking link right now. Ask the caller to contact the business directly.', {
      code: 'INTERNAL',
      retryable: true,
    });
  }

  return {
    success: true,
    message: `Booking link sent to ${toPhone}`,
  };
}
