import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { dateSchema, timeSchema, type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({
  bookingId: z.string().min(1),
  newDate: dateSchema,
  newTime: timeSchema,
});

export async function rescheduleBookingTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: true; bookingId: string; calendarEventId?: string } | ToolError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid reschedule parameters.', { code: 'VALIDATION_ERROR', retryable: false });

  try {
    const result = await ctx.calendarProvider.rescheduleBooking({
      bookingId: parsed.data.bookingId,
      newDate: parsed.data.newDate,
      newTime: parsed.data.newTime,
      timezone: ctx.shop.timezone,
      idempotencyKey: `reschedule:${ctx.requestId}:${parsed.data.bookingId}:${parsed.data.newDate}:${parsed.data.newTime}`,
    });

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
