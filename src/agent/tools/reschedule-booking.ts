import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';
import { dateSchema, shopLocalToUtcIso, timeSchema, type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z
  .object({
    bookingId: z.string().min(1),
    newDate: dateSchema.optional(),
    newTime: timeSchema.optional(),
    currentDateTime: z.string().min(1).optional(),
    newDateTime: z.string().min(1).optional(),
    callerName: z.string().min(1).optional(),
  })
  .refine((value) => (value.newDate && value.newTime) || value.newDateTime, {
    message: 'Either newDate and newTime, or newDateTime is required.',
  });

export async function rescheduleBookingTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<
  | { success: true; bookingId: string; calendarEventId?: string }
  | { success: false; canSelfReschedule: boolean; message: string }
  | ToolError
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid reschedule parameters.', { code: 'VALIDATION_ERROR', retryable: false });

  const normalized = normalizeNewDateTime(parsed.data, ctx.shop.timezone);
  if (!normalized) {
    return toToolError('Invalid reschedule time for this shop timezone.', { code: 'VALIDATION_ERROR', retryable: false });
  }

  const providerMeta = getShopCalendarProviderMetadata(ctx.shop);
  const providerId = providerMeta?.id ?? 'manual';

  if (providerId === 'square_appointments') {
    try {
      const result = await ctx.calendarProvider.rescheduleBooking({
        bookingId: parsed.data.bookingId,
        newDate: normalized.newDate,
        newTime: normalized.newTime,
        timezone: ctx.shop.timezone,
        idempotencyKey: `reschedule:${ctx.requestId}:${parsed.data.bookingId}:${normalized.newDate}:${normalized.newTime}`,
      });

      try {
        await ctx.bookingsRepository.updateDatetime(parsed.data.bookingId, normalized.newDatetimeUtc);
      } catch (dbErr) {
        console.warn(
          'Local booking record update failed after provider reschedule. Provider is source of truth.',
          dbErr,
        );
      }

      return {
        success: true,
        bookingId: result.bookingId,
        calendarEventId: result.calendarEventId,
      };
    } catch {
      return toToolError('I could not reschedule it right now. Let me have the user help with that change.', {
        code: 'CALENDAR_TIMEOUT',
        retryable: true,
      });
    }
  }

  if (providerMeta?.type === 'booking_link' || providerId === 'vagaro') {
    await enqueueRescheduleRequest(ctx, {
      bookingId: parsed.data.bookingId,
      callerName: parsed.data.callerName,
      currentDateTime: parsed.data.currentDateTime,
      requestedDateTime: normalized.requestedDateTime,
      providerName: providerId,
    });

    return {
      success: false,
      canSelfReschedule: true,
      message: buildSelfRescheduleMessage(providerId, ctx.shop.name),
    };
  }

  await enqueueRescheduleRequest(ctx, {
    bookingId: parsed.data.bookingId,
    callerName: parsed.data.callerName,
    currentDateTime: parsed.data.currentDateTime,
    requestedDateTime: normalized.requestedDateTime,
    providerName: 'manual',
  });

  return {
    success: false,
    canSelfReschedule: false,
    message: `I've recorded your reschedule request and notified ${ctx.shop.name}. They'll confirm the new time with you shortly.`,
  };
}

function normalizeNewDateTime(
  params: { newDate?: string; newTime?: string; newDateTime?: string },
  timezone: string,
): { newDate: string; newTime: string; newDatetimeUtc: Date; requestedDateTime: string } | null {
  const extracted =
    params.newDate && params.newTime
      ? { newDate: params.newDate, newTime: params.newTime }
      : extractDateTime(params.newDateTime);
  if (!extracted) return null;

  const utcIso = shopLocalToUtcIso({
    date: extracted.newDate,
    time: extracted.newTime,
    timezone,
  });
  if (!utcIso) return null;

  return {
    ...extracted,
    newDatetimeUtc: new Date(utcIso),
    requestedDateTime: `${extracted.newDate} ${extracted.newTime}`,
  };
}

function extractDateTime(value?: string): { newDate: string; newTime: string } | null {
  if (!value) return null;
  const match = value.match(/(\d{4}-\d{2}-\d{2})[T\s]+(\d{2}:\d{2})/);
  if (!match) return null;
  return { newDate: match[1], newTime: match[2] };
}

async function enqueueRescheduleRequest(
  ctx: AgentToolContext,
  params: {
    bookingId: string;
    callerName?: string;
    currentDateTime?: string;
    requestedDateTime: string;
    providerName: string;
  },
) {
  await ctx.jobsRepository.enqueue({
    shopId: ctx.shop.id,
    type: 'cancellation_request_alert',
    payload: {
      shopId: ctx.shop.id,
      callerName: params.callerName,
      callerPhone: ctx.callerPhone,
      appointmentDate: params.currentDateTime,
      reason: `Reschedule request to: ${params.requestedDateTime}`,
      providerName: params.providerName,
    },
    runAt: new Date(),
    idempotencyKey: `reschedule-request:${ctx.requestId}:${params.bookingId}`,
  });
}

function buildSelfRescheduleMessage(providerId: string, shopName: string): string {
  if (providerId === 'glossgenius' || providerId === 'fresha') {
    return `To reschedule, check your booking confirmation email — there's a reschedule link inside. I've also notified ${shopName} of your request.`;
  }

  if (providerId === 'booksy') {
    return `You can reschedule by logging into your Booksy account and selecting your appointment. I've also notified ${shopName} of your request.`;
  }

  if (providerId === 'vagaro') {
    return `You can reschedule through the Vagaro app or website. I've also notified ${shopName} of your request.`;
  }

  return `I've recorded your reschedule request and notified ${shopName}. They'll confirm the new time with you shortly.`;
}
