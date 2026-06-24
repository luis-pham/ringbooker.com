import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';
import { logger } from '@/src/backend/observability/logger';
import { scheduleBookingFollowupJobs } from '@/src/backend/services/bookings/reminder-scheduling';
import { resolveBookingProviderReadiness } from '@/src/backend/services/calendar/provider-readiness';
import { ManualCalendarProvider } from '@/src/backend/services/calendar/manual-provider';
import { getShopCalendarProviderMetadata } from '@/src/backend/services/calendar/types';
import { AVAILABILITY_CACHE_TTL_MS } from '@/src/agent/tools/check-availability';
import {
  dateSchema,
  isRequestedAppointmentInsideBusinessHours,
  resolveRuntimeService,
  shopLocalToUtcIso,
  timeSchema,
  type AgentToolContext,
  toToolError,
} from '@/src/agent/tools/types';
import { normalizeStaffPreferenceName } from '@/src/agent/tools/staff-preference';
import {
  hasValidAppointmentTimeValidation,
  requiresAppointmentTimeValidation,
} from '@/src/agent/tools/validate-appointment-time';

const SERVICE_ERROR_CODE = {
  unknown_service: 'UNKNOWN_SERVICE',
  service_needs_clarification: 'SERVICE_NEEDS_CLARIFICATION',
  service_not_bookable: 'SERVICE_NOT_BOOKABLE',
} as const;

const schema = z.object({
  date: dateSchema,
  time: timeSchema,
  service: z.string().min(1),
  techName: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  notes: z.string().min(1).optional(),
});

function normalized(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isAvailabilityCacheValid(
  cache: NonNullable<NonNullable<AgentToolContext['availabilityCheck']>['latest']> | null | undefined,
  params: { providerId: string; service: string; date: string; time: string },
): cache is NonNullable<NonNullable<AgentToolContext['availabilityCheck']>['latest']> {
  if (!cache) return false;
  if (Date.now() - cache.fetchedAtMs > AVAILABILITY_CACHE_TTL_MS) return false;
  return (
    cache.providerId === params.providerId &&
    normalized(cache.service) === normalized(params.service) &&
    cache.date === params.date &&
    cache.time === params.time
  );
}

function cachedTeamMemberForBooking(
  cache: NonNullable<NonNullable<AgentToolContext['availabilityCheck']>['latest']>,
  techName?: string,
): { teamMemberId?: string; skipAvailabilitySearch: boolean } | { unavailable: true; message: string } {
  const requested = normalized(techName);
  if (requested) {
    if (
      cache.requestedStaffUnavailable &&
      normalized(cache.requestedStaffName ?? cache.requestedTeamMemberName) === requested
    ) {
      const fallback = cache.fallbackStaffName ?? cache.fallbackTeamMemberName;
      return {
        unavailable: true,
        message: fallback
          ? `${techName} is not available at that time, but ${fallback} is. Would you like to book with ${fallback}, or choose a different time for ${techName}?`
          : `${techName} is not available at that time. Would you like any available stylist, or choose a different time for ${techName}?`,
      };
    }

    const resolvedName = normalized(cache.resolvedTeamMemberName);
    const fallbackName = normalized(cache.fallbackStaffName ?? cache.fallbackTeamMemberName);
    const requestedName = normalized(cache.requestedStaffName ?? cache.requestedTeamMemberName);
    if (
      cache.resolvedTeamMemberId &&
      (resolvedName === requested || fallbackName === requested || (requestedName === requested && !cache.requestedStaffUnavailable))
    ) {
      return { teamMemberId: cache.resolvedTeamMemberId, skipAvailabilitySearch: true };
    }
    return { skipAvailabilitySearch: false };
  }

  if (cache.resolvedTeamMemberId) {
    return { teamMemberId: cache.resolvedTeamMemberId, skipAvailabilitySearch: true };
  }
  return { skipAvailabilitySearch: false };
}

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
    if (requiresAppointmentTimeValidation(ctx) && !hasValidAppointmentTimeValidation(ctx, parsed.data)) {
      return toToolError(
        'Call validate_appointment_time for this exact date and time before creating a booking. Do not tell the caller you are checking.',
        { code: 'APPOINTMENT_TIME_NOT_VALIDATED', retryable: false },
      );
    }

    const requestedInsideHours = isRequestedAppointmentInsideBusinessHours(ctx.shop, parsed.data);
    if (requestedInsideHours === false) {
      return toToolError(
        'The requested appointment time is outside the shop business hours. Do not say it is booked, confirmed, scheduled, or available. Ask for a time during business hours or offer to record the request for the shop to confirm.',
        { code: 'OUTSIDE_BUSINESS_HOURS', retryable: false },
      );
    }

    const service = resolveRuntimeService(ctx.shop, parsed.data.service);
    if (!service.ok) {
      return toToolError(service.message, { code: SERVICE_ERROR_CODE[service.reason], retryable: false });
    }

    const durationMin = service.durationMin;
    const canonicalServiceName = service.serviceName;
    const requestedTechName = normalizeStaffPreferenceName(parsed.data.techName);
    const idempotencyKey = `booking:${ctx.requestId}:${ctx.callerPhone}:${parsed.data.date}:${parsed.data.time}:${parsed.data.service}`;
    const squareRuntimeBlocked =
      ctx.shop.selected_integration === 'square_appointments' &&
      !isCapabilityAllowed(ctx.shop.plan, 'third_party_integrations');
    const providerShop = squareRuntimeBlocked ? { ...ctx.shop, selected_integration: null } : ctx.shop;
    const calendarProvider: AgentToolContext['calendarProvider'] = squareRuntimeBlocked
      ? new ManualCalendarProvider(providerShop)
      : ctx.calendarProvider;
    const providerMeta = getShopCalendarProviderMetadata(providerShop);
    const readiness = resolveBookingProviderReadiness(providerShop);
    const availabilityCache = isAvailabilityCacheValid(ctx.availabilityCheck?.latest, {
      providerId: providerMeta.id,
      service: canonicalServiceName,
      date: parsed.data.date,
      time: parsed.data.time,
    })
      ? ctx.availabilityCheck!.latest!
      : null;

    if (ctx.shop.booking_url?.trim() && providerMeta?.id === 'manual') {
      return toToolError(
        'This shop uses a booking link. Use the send_booking_link tool instead of creating a booking directly.',
        { code: 'BOOKING_LINK_PROVIDER', retryable: false },
      );
    }

    if (providerMeta?.type === 'booking_link') {
      return toToolError(
        'This salon uses an external booking system. Use send_booking_link to text the caller a booking link instead of creating a booking directly.',
        { code: 'BOOKING_LINK_PROVIDER', retryable: false },
      );
    }

    if (
      ctx.shop.booking_url?.trim() &&
      providerMeta?.capabilities.createBooking === false &&
      providerMeta.capabilities.hasBookingLink
    ) {
      return toToolError(
        'This salon uses an external booking system. Use send_booking_link to text the caller a booking link instead of creating a booking directly.',
        { code: 'BOOKING_LINK_PROVIDER', retryable: false },
      );
    }

    let teamMemberId: string | undefined;
    let skipAvailabilitySearch = false;
    if (availabilityCache) {
      const cached = cachedTeamMemberForBooking(availabilityCache, requestedTechName);
      if ('unavailable' in cached) {
        return {
          success: false,
          techNotAvailable: true,
          requestedTech: requestedTechName ?? availabilityCache.requestedStaffName ?? availabilityCache.requestedTeamMemberName ?? 'that stylist',
          message: cached.message,
        };
      }
      teamMemberId = cached.teamMemberId;
      skipAvailabilitySearch = cached.skipAvailabilitySearch;
    }

    if (!teamMemberId && readiness.canCreateBooking && requestedTechName && providerMeta?.id === 'square_appointments' && calendarProvider.findTeamMemberByName) {
      try {
        const foundTeamMemberId = await calendarProvider.findTeamMemberByName(requestedTechName);
        if (foundTeamMemberId) {
          const availability = await calendarProvider.checkAvailability({
            date: parsed.data.date,
            time: parsed.data.time,
            durationMin,
            techName: requestedTechName,
            teamMemberId: foundTeamMemberId,
            timezone: ctx.shop.timezone,
            matchedServiceId: service.matchedServiceId,
          });

          if (availability.requestedStaffUnavailable) {
            return {
              success: false,
              techNotAvailable: true,
              requestedTech: requestedTechName,
              message:
                availability.message ??
                `${requestedTechName} is not available at that time. ` +
                  `Would you like to book with any available stylist, or choose a different time for ${requestedTechName}?`,
            };
          }

          if (!availability.available) {
            return {
              success: false,
              techNotAvailable: true,
              requestedTech: requestedTechName,
              message:
                `${requestedTechName} is not available at that time. ` +
                `Would you like to book with any available stylist, or choose a different time for ${requestedTechName}?`,
            };
          }

          teamMemberId = availability.staffResolution?.resolvedTeamMemberId ?? foundTeamMemberId;
        } else {
          logger.warn(
            { shopId: ctx.shop.id, techName: requestedTechName },
            'square_team_member_not_found_booking_without_preference',
          );
        }
      } catch (error) {
        logger.warn(
          { shopId: ctx.shop.id, techName: requestedTechName, err: error },
          'square_tech_lookup_failed_booking_without_preference',
        );
      }
    }

    let result;
    if (providerMeta.capabilities.createBooking && !readiness.liveReady) {
      logger.warn(
        {
          shopId: ctx.shop.id,
          provider: providerMeta.id,
          readinessStatus: readiness.status,
          missingFields: readiness.missingFields,
          errorKind: 'provider_not_ready',
        },
        'booking_provider_not_ready_fallback_request',
      );
      result = {
        bookingId: `${providerMeta.id}-request-${idempotencyKey}`,
        confirmed: false,
        providerStatus: 'provider_not_ready',
        providerErrorReason: readiness.missingFields.length ? `missing:${readiness.missingFields.join(',')}` : readiness.status,
      };
    } else {
      try {
        result = await calendarProvider.createBooking({
          shopId: ctx.shop.id,
          customerPhone: ctx.callerPhone,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          service: canonicalServiceName,
          techName: requestedTechName,
          teamMemberId,
          skipAvailabilitySearch,
          datetimeIso: utcIso,
          timezone: ctx.shop.timezone,
          durationMin,
          source: 'inbound_call',
          notes: parsed.data.notes,
          matchedServiceId: service.matchedServiceId,
          matchedServiceConfidence: service.matchedServiceConfidence,
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
    }

    const booking = await ctx.bookingsRepository.create({
      shopId: ctx.shop.id,
      customerPhone: ctx.callerPhone,
      customerName: parsed.data.customerName ?? null,
      service: canonicalServiceName,
      datetimeUtc: utcIso,
      timezone: ctx.shop.timezone,
      status: result.confirmed ? 'confirmed' : 'pending',
      calendarEventId: result.calendarEventId,
      provider: getShopCalendarProviderMetadata(ctx.shop).id,
      providerStatus: result.providerStatus ?? (result.confirmed ? 'provider_confirmed' : 'request_only'),
      providerErrorReason: result.providerErrorReason,
      callLogId: ctx.requestId,
    });

    await scheduleBookingFollowupJobs({
      jobsRepository: ctx.jobsRepository,
      shop: ctx.shop,
      booking,
      source: 'ai',
    });

    const callerPhone = ctx.callerPhone;
    if (callerPhone) {
      try {
        await ctx.jobsRepository.enqueue({
          shopId: ctx.shop.id,
          type: 'booking_confirmation_sms',
          payload: {
            shopId: ctx.shop.id,
            toPhone: callerPhone,
            bookingId: booking.id,
            serviceName: canonicalServiceName,
            appointmentDate: parsed.data.date,
            appointmentTime: parsed.data.time,
            techName: requestedTechName,
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
            serviceName: canonicalServiceName,
            appointmentDate: parsed.data.date,
            appointmentTime: parsed.data.time,
            techName: requestedTechName,
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
      ...(teamMemberId && requestedTechName
        ? {
            bookedWithTech: requestedTechName,
            message: `Booked with ${requestedTechName}!`,
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
