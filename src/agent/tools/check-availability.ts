import { z } from 'zod';

import type { AvailabilityCheckResult, TimeSlot, ToolError } from '@/src/backend/domain/types';
import { resolveBookingProviderReadiness } from '@/src/backend/services/calendar/provider-readiness';
import {
  dateSchema,
  isRequestedAppointmentInsideBusinessHours,
  resolveRuntimeService,
  timeSchema,
  type AgentToolContext,
  toToolError,
} from '@/src/agent/tools/types';
import { normalizeStaffPreferenceName } from '@/src/agent/tools/staff-preference';
import {
  hasValidAppointmentTimeValidation,
  requiresAppointmentTimeValidation,
} from '@/src/agent/tools/validate-appointment-time';

export const AVAILABILITY_CACHE_TTL_MS = 60_000;

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
});

export type PublicAvailabilityResult = {
  available: boolean;
  suggestions?: TimeSlot[];
  message?: string;
  requestedStaffUnavailable?: boolean;
  requestedStaffName?: string;
  fallbackStaffName?: string;
};

export function publicAvailabilityResult(result: AvailabilityCheckResult): PublicAvailabilityResult {
  return {
    available: result.available,
    ...(result.message ? { message: result.message } : {}),
    ...(result.requestedStaffUnavailable !== undefined ? { requestedStaffUnavailable: result.requestedStaffUnavailable } : {}),
    ...(result.requestedStaffName ? { requestedStaffName: result.requestedStaffName } : {}),
    ...(result.fallbackStaffName ? { fallbackStaffName: result.fallbackStaffName } : {}),
    ...(result.suggestions !== undefined ? { suggestions: result.suggestions } : {}),
  };
}

export function buildAvailabilityCacheEntry(params: {
  providerId: string;
  service: string;
  date: string;
  time: string;
  techName?: string;
  result: AvailabilityCheckResult;
  fetchedAtMs: number;
  prefetchStartedAtMs?: number;
}): NonNullable<NonNullable<AgentToolContext['availabilityCheck']>['latest']> {
  const staff = params.result.staffResolution;
  return {
    providerId: params.providerId,
    service: params.service,
    date: params.date,
    time: params.time,
    ...(params.techName ? { techName: params.techName } : {}),
    available: params.result.available,
    ...(params.result.suggestions !== undefined ? { suggestions: params.result.suggestions } : {}),
    ...(params.result.message ? { message: params.result.message } : {}),
    requestedStaffUnavailable: params.result.requestedStaffUnavailable ?? staff?.requestedStaffUnavailable ?? false,
    requestedStaffName: params.result.requestedStaffName ?? staff?.requestedTeamMemberName ?? null,
    fallbackStaffName: params.result.fallbackStaffName ?? staff?.fallbackTeamMemberName ?? null,
    resolvedTeamMemberId: staff?.resolvedTeamMemberId ?? null,
    resolvedTeamMemberName: staff?.resolvedTeamMemberName ?? null,
    requestedTeamMemberId: staff?.requestedTeamMemberId ?? null,
    requestedTeamMemberName: staff?.requestedTeamMemberName ?? null,
    fallbackTeamMemberId: staff?.fallbackTeamMemberId ?? null,
    fallbackTeamMemberName: staff?.fallbackTeamMemberName ?? null,
    serviceVariationId: staff?.serviceVariationId ?? null,
    locationId: staff?.locationId ?? null,
    raw: publicAvailabilityResult(params.result),
    fetchedAtMs: params.fetchedAtMs,
    ...(params.prefetchStartedAtMs ? { prefetchStartedAtMs: params.prefetchStartedAtMs } : {}),
  };
}

export async function checkAvailabilityTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<PublicAvailabilityResult | ToolError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return toToolError('Invalid availability parameters.', { code: 'VALIDATION_ERROR', retryable: false });

  try {
    if (requiresAppointmentTimeValidation(ctx) && !hasValidAppointmentTimeValidation(ctx, parsed.data)) {
      return toToolError(
        'Call validate_appointment_time for this exact date and time before checking availability. Do not tell the caller you are checking.',
        { code: 'APPOINTMENT_TIME_NOT_VALIDATED', retryable: false },
      );
    }

    const requestedInsideHours = isRequestedAppointmentInsideBusinessHours(ctx.shop, parsed.data);
    if (requestedInsideHours === false) {
      return {
        available: false,
        suggestions: [],
        message:
          'The requested appointment time is outside the shop business hours. Do not say it is available. Ask for a time during business hours or offer to capture the request for the team to confirm.',
      } as { available: false; suggestions: []; message: string };
    }

    const service = resolveRuntimeService(ctx.shop, parsed.data.service);
    if (!service.ok) {
      return toToolError(service.message, { code: SERVICE_ERROR_CODE[service.reason], retryable: false });
    }

    const readiness = resolveBookingProviderReadiness(ctx.shop);
    if (!readiness.canCheckAvailability) {
      return toToolError(
        'Live availability is not configured for this shop. Offer to capture the request and have the shop confirm.',
        { code: 'CALENDAR_TIMEOUT', retryable: false },
      );
    }

    const requestedTechName = normalizeStaffPreferenceName(parsed.data.techName);
    let requestedTeamMemberId: string | undefined;
    if (requestedTechName && ctx.calendarProvider.findTeamMemberByName) {
      requestedTeamMemberId = await ctx.calendarProvider.findTeamMemberByName(requestedTechName) ?? undefined;
    }

    const result = await ctx.calendarProvider.checkAvailability({
      date: parsed.data.date,
      time: parsed.data.time,
      durationMin: service.durationMin,
      techName: requestedTechName,
      teamMemberId: requestedTeamMemberId,
      timezone: ctx.shop.timezone,
      matchedServiceId: service.matchedServiceId,
    });

    if (ctx.availabilityCheck) {
      ctx.availabilityCheck.latest = buildAvailabilityCacheEntry({
        providerId: readiness.providerId,
        service: service.serviceName,
        date: parsed.data.date,
        time: parsed.data.time,
        ...(requestedTechName ? { techName: requestedTechName } : {}),
        result,
        fetchedAtMs: Date.now(),
      });
    }

    return publicAvailabilityResult(result);
  } catch {
    return toToolError('I am having trouble checking the schedule right now. Let me have the user follow up.', {
      code: 'CALENDAR_TIMEOUT',
      retryable: true,
    });
  }
}
