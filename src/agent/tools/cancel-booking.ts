import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';
import type { CalendarProviderId } from '@/src/backend/services/calendar/provider-catalog';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  bookingId: z.string().min(1).optional(),
  callerName: z.string().min(1).optional(),
  callerPhone: z.string().min(1).optional(),
  appointmentDate: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
});

type CancelBookingInput = z.infer<typeof schema>;

type CancelBookingResult =
  | {
      success: true;
      cancelled: true;
      message: string;
    }
  | {
      success: false;
      cancelled: false;
      canSelfCancel?: boolean;
      message: string;
    };

export async function cancelBookingTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<CancelBookingResult | ToolError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid cancellation request.', { code: 'VALIDATION_ERROR', retryable: false });

  const providerMeta = getShopCalendarProviderMetadata(ctx.shop);
  const providerId = providerMeta?.id ?? 'manual';

  if (providerId === 'square_appointments') {
    if (parsed.data.bookingId) {
      try {
        await ctx.calendarProvider.cancelBooking({
          bookingId: parsed.data.bookingId,
          reason: parsed.data.reason || 'Client requested cancellation',
          idempotencyKey: `cancel:${ctx.requestId}:${parsed.data.bookingId}:${randomUUID()}`,
        });

        return {
          success: true,
          cancelled: true,
          message: "Your appointment has been cancelled. You'll receive a confirmation shortly.",
        };
      } catch {
        await enqueueShopNotification(ctx, parsed.data, providerId);
        return {
          success: false,
          cancelled: false,
          message: `I wasn't able to cancel automatically. I've notified ${ctx.shop.name} to process your cancellation — they'll confirm with you shortly.`,
        };
      }
    }

    await enqueueShopNotification(ctx, parsed.data, providerId);
    return {
      success: false,
      cancelled: false,
      message: `I've recorded your cancellation request and notified ${ctx.shop.name}. They'll confirm with you shortly.`,
    };
  }

  if (providerMeta?.type === 'booking_link' || providerId === 'vagaro') {
    await enqueueShopNotification(ctx, parsed.data, providerId);
    return {
      success: false,
      cancelled: false,
      canSelfCancel: true,
      message: buildSelfCancelMessage(providerId, ctx.shop.name),
    };
  }

  await enqueueShopNotification(ctx, parsed.data, providerId);
  return {
    success: false,
    cancelled: false,
    canSelfCancel: false,
    message: `I've recorded your cancellation request and notified ${ctx.shop.name}. They'll confirm the cancellation with you shortly.`,
  };
}

async function enqueueShopNotification(
  ctx: AgentToolContext,
  params: CancelBookingInput,
  providerName: string,
) {
  const callerPhone = params.callerPhone ?? ctx.callerPhone;
  await ctx.jobsRepository.enqueue({
    shopId: ctx.shop.id,
    type: 'cancellation_request_alert',
    payload: {
      shopId: ctx.shop.id,
      callerName: params.callerName,
      callerPhone,
      appointmentDate: params.appointmentDate,
      reason: params.reason,
      providerName,
    },
    runAt: new Date(),
    idempotencyKey: `cancellation-request:${ctx.requestId}:${callerPhone}:${params.appointmentDate ?? 'unknown'}`,
  });
}

function buildSelfCancelMessage(providerId: CalendarProviderId, shopName: string): string {
  if (providerId === 'glossgenius' || providerId === 'fresha') {
    return `To cancel, check your booking confirmation email — there's a cancel link inside. I've also notified ${shopName} of your request.`;
  }

  if (providerId === 'booksy') {
    return `You can cancel by logging into your Booksy account and selecting your appointment. I've also notified ${shopName} of your request.`;
  }

  if (providerId === 'vagaro') {
    return `You can cancel through the Vagaro app or website. I've also notified ${shopName} of your request.`;
  }

  return `I've recorded your cancellation request and notified ${shopName}. They'll confirm the cancellation with you shortly.`;
}
