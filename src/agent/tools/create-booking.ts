import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import { scheduleBookingFollowupJobs } from '@/src/backend/services/bookings/reminder-scheduling';
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
  customerEmail: z.string().email().optional(),
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

    let result;
    try {
      result = await ctx.calendarProvider.createBooking({
        shopId: ctx.shop.id,
        customerPhone: ctx.callerPhone,
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail,
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
    } catch (error) {
      logger.warn(
        {
          err: error,
          shopId: ctx.shop.id,
          provider: providerMeta.id,
          errorKind: 'provider_create_booking_failed',
        },
        'booking_provider_create_failed_fallback_request',
      );
      result = {
        bookingId: `${providerMeta.id}-request-${idempotencyKey}`,
        confirmed: false,
        providerStatus: 'provider_failed',
        providerErrorReason: error instanceof Error ? error.message.slice(0, 240) : 'provider_create_booking_failed',
      };
    }

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
      providerStatus: result.providerStatus ?? (result.confirmed ? 'provider_confirmed' : 'request_only'),
      providerErrorReason: result.providerErrorReason,
    });

    await scheduleBookingFollowupJobs({
      jobsRepository: ctx.jobsRepository,
      shop: ctx.shop,
      booking,
      source: providerMeta.type === 'booking_link' ? 'booking_link' : 'ai',
    });

    const callerPhone = ctx.callerPhone;
    const smsConsented = callerPhone && ctx.customersRepository
      ? await ctx.customersRepository.isSmsConsented(ctx.shop.id, callerPhone).catch(() => false)
      : false;
    if (smsConsented && callerPhone) {
      try {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'booking_confirmation_sms',
          payload: {
            shopId: ctx.shop.id,
            toPhone: callerPhone,
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
        logger.warn({ err: smsEnqueueErr, shopId: ctx.shop.id, bookingId: booking.id }, 'booking_confirmation_sms_enqueue_failed');
      }
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
