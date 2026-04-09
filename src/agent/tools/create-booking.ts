import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import {
  dateSchema,
  findServiceDuration,
  shopLocalToUtcIso,
  timeSchema,
  type AgentToolContext,
  toToolError,
} from '@/src/agent/tools/types';

const schema = z.object({
  date: dateSchema,
  time: timeSchema,
  service: z.string().min(1),
  techName: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

export async function createBookingTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: true; bookingId: string; calendarEventId?: string } | ToolError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid booking parameters.', { code: 'VALIDATION_ERROR', retryable: false });

  const utcIso = shopLocalToUtcIso({
    date: parsed.data.date,
    time: parsed.data.time,
    timezone: ctx.shop.timezone,
  });

  if (!utcIso) {
    return toToolError('Invalid appointment time for this shop timezone.', { code: 'VALIDATION_ERROR', retryable: false });
  }

  try {
    const durationMin = findServiceDuration(ctx.shop, parsed.data.service);
    const idempotencyKey = `booking:${ctx.requestId}:${ctx.callerPhone}:${parsed.data.date}:${parsed.data.time}:${parsed.data.service}`;
    const result = await ctx.calendarProvider.createBooking({
      shopId: ctx.shop.id,
      customerPhone: ctx.callerPhone,
      customerName: parsed.data.customerName,
      service: parsed.data.service,
      techName: parsed.data.techName,
      datetimeIso: utcIso,
      timezone: ctx.shop.timezone,
      durationMin,
      source: 'inbound_call',
      notes: parsed.data.notes,
      idempotencyKey,
    });

    const booking = await ctx.bookingsRepository.create({
      shopId: ctx.shop.id,
      customerPhone: ctx.callerPhone,
      customerName: parsed.data.customerName ?? null,
      service: parsed.data.service,
      datetimeUtc: utcIso,
      timezone: ctx.shop.timezone,
      status: result.confirmed ? 'confirmed' : 'pending',
      calendarEventId: result.calendarEventId,
    });

    const bookingAt = new Date(utcIso).getTime();
    if (Number.isFinite(bookingAt)) {
      const reminder24hAt = new Date(bookingAt - 24 * 60 * 60 * 1000);
      if (ctx.shop.send_reminder_sms && reminder24hAt.getTime() > Date.now()) {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'appointment_reminder_24h',
          payload: { bookingId: booking.id },
          runAt: reminder24hAt,
          idempotencyKey: `booking:${booking.id}:reminder24h`,
        });
      }

      const reminder2hAt = new Date(bookingAt - 2 * 60 * 60 * 1000);
      if (ctx.shop.send_reminder_sms && reminder2hAt.getTime() > Date.now()) {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'appointment_reminder_2h',
          payload: { bookingId: booking.id },
          runAt: reminder2hAt,
          idempotencyKey: `booking:${booking.id}:reminder2h`,
        });
      }

      const reviewAt = new Date(bookingAt + 4 * 60 * 60 * 1000);
      if (ctx.shop.send_review_request_sms) {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'review_request_sms',
          payload: { bookingId: booking.id },
          runAt: reviewAt,
          idempotencyKey: `booking:${booking.id}:review`,
        });
      }
    }

    return {
      success: true,
      bookingId: booking.id,
      calendarEventId: result.calendarEventId,
    };
  } catch {
    return toToolError('I could not finish the booking right now. Let me have the user confirm it for you.', {
      code: 'CALENDAR_TIMEOUT',
      retryable: true,
    });
  }
}
