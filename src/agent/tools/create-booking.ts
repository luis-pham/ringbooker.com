import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { canUseReminderSms, canUseReviewRequestSms } from '@/src/backend/domain/shop-plan-capabilities';
import { logger } from '@/src/backend/observability/logger';
import { getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';
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
): Promise<
  | { success: true; bookingId: string; confirmed: boolean; calendarEventId?: string; bookedWithTech?: string; message?: string }
  | { success: false; techNotAvailable: true; requestedTech: string; message: string }
  | ToolError
> {
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
    const providerMeta = getShopCalendarProviderMetadata(ctx.shop);
    let teamMemberId: string | undefined;

    if (parsed.data.techName && providerMeta?.id === 'square_appointments' && ctx.calendarProvider.findTeamMemberByName) {
      try {
        const foundTeamMemberId = await ctx.calendarProvider.findTeamMemberByName(parsed.data.techName);
        if (foundTeamMemberId) {
          const availability = await ctx.calendarProvider.checkAvailability({
            date: parsed.data.date,
            time: parsed.data.time,
            durationMin,
            techName: parsed.data.techName,
            teamMemberId: foundTeamMemberId,
            timezone: ctx.shop.timezone,
          });

          if (!availability.available) {
            return {
              success: false,
              techNotAvailable: true,
              requestedTech: parsed.data.techName,
              message:
                `${parsed.data.techName} is not available at that time. ` +
                `Would you like to book with any available stylist, or choose a different time for ${parsed.data.techName}?`,
            };
          }

          teamMemberId = foundTeamMemberId;
        } else {
          console.warn(
            `Tech "${parsed.data.techName}" not found in Square team members. Booking without staff preference.`,
          );
        }
      } catch (error) {
        console.warn(
          `Square tech lookup failed for "${parsed.data.techName}". Booking without staff preference. ${
            error instanceof Error ? error.message : 'unknown_error'
          }`,
        );
      }
    }

    const result = await ctx.calendarProvider.createBooking({
      shopId: ctx.shop.id,
      customerPhone: ctx.callerPhone,
      customerName: parsed.data.customerName,
      service: parsed.data.service,
      techName: parsed.data.techName,
      teamMemberId,
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
      provider: getShopCalendarProviderMetadata(ctx.shop).id,
      providerStatus: result.providerStatus ?? (result.confirmed ? 'confirmed' : 'fallback_request'),
      providerErrorReason: result.providerErrorReason,
    });

    const bookingAt = new Date(utcIso).getTime();
    if (Number.isFinite(bookingAt)) {
      const canEnqueueReminderSms = canUseReminderSms(ctx.shop.plan);
      const canEnqueueReviewRequestSms = canUseReviewRequestSms(ctx.shop.plan);
      const reminder24hAt = new Date(bookingAt - 24 * 60 * 60 * 1000);
      if (ctx.shop.send_reminder_sms && !canEnqueueReminderSms) {
        logger.warn(
          { shopId: ctx.shop.id, plan: ctx.shop.plan, feature: 'reminder_sms' },
          'plan_feature_locked_booking_job_enqueue_skipped',
        );
      }
      if (ctx.shop.send_reminder_sms && canEnqueueReminderSms && reminder24hAt.getTime() > Date.now()) {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'appointment_reminder_24h',
          payload: { bookingId: booking.id },
          runAt: reminder24hAt,
          idempotencyKey: `booking:${booking.id}:reminder24h`,
        });
      }

      const reminder2hAt = new Date(bookingAt - 2 * 60 * 60 * 1000);
      if (ctx.shop.send_reminder_sms && canEnqueueReminderSms && reminder2hAt.getTime() > Date.now()) {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'appointment_reminder_2h',
          payload: { bookingId: booking.id },
          runAt: reminder2hAt,
          idempotencyKey: `booking:${booking.id}:reminder2h`,
        });
      }

      const reviewAt = new Date(bookingAt + 4 * 60 * 60 * 1000);
      if (ctx.shop.send_review_request_sms && !canEnqueueReviewRequestSms) {
        logger.warn(
          { shopId: ctx.shop.id, plan: ctx.shop.plan, feature: 'review_request_sms' },
          'plan_feature_locked_booking_job_enqueue_skipped',
        );
      }
      if (ctx.shop.send_review_request_sms && canEnqueueReviewRequestSms) {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'review_request_sms',
          payload: { bookingId: booking.id },
          runAt: reviewAt,
          idempotencyKey: `booking:${booking.id}:review`,
        });
      }
    }

    try {
      await ctx.jobsRepository.enqueue({
        shopId: ctx.shop.id,
        type: 'booking_confirmation_sms',
        payload: {
          shopId: ctx.shop.id,
          toPhone: ctx.callerPhone,
          bookingId: booking.id,
          serviceName: parsed.data.service,
          appointmentDate: parsed.data.date,
          appointmentTime: parsed.data.time,
          techName: parsed.data.techName,
          shopName: ctx.shop.name,
          confirmed: result.confirmed,
        },
        runAt: new Date(),
        idempotencyKey: `booking:${booking.id}:confirmation`,
      });
    } catch (smsEnqueueErr) {
      console.warn('booking_confirmation_sms enqueue failed', smsEnqueueErr);
    }

    if (!result.confirmed) {
      try {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'new_booking_request_owner_alert',
          payload: {
            shopId: ctx.shop.id,
            bookingId: booking.id,
            callerPhone: ctx.callerPhone,
            callerName: parsed.data.customerName,
            serviceName: parsed.data.service,
            appointmentDate: parsed.data.date,
            appointmentTime: parsed.data.time,
            techName: parsed.data.techName,
            notes: parsed.data.notes,
          },
          runAt: new Date(),
          idempotencyKey: `booking:${booking.id}:owner-alert`,
        });
      } catch (ownerAlertErr) {
        logger.warn({ err: ownerAlertErr, shopId: ctx.shop.id, bookingId: booking.id }, 'new_booking_request_owner_alert_enqueue_failed');
      }
    }

    return {
      success: true,
      bookingId: booking.id,
      confirmed: result.confirmed,
      calendarEventId: result.calendarEventId,
      ...(teamMemberId && parsed.data.techName
        ? {
            bookedWithTech: parsed.data.techName,
            message: `Booked with ${parsed.data.techName}!`,
          }
        : {}),
    };
  } catch {
    return toToolError('I could not finish the booking right now. Let me have the user confirm it for you.', {
      code: 'CALENDAR_TIMEOUT',
      retryable: true,
    });
  }
}
