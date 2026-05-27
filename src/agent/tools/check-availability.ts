import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import {
  dateSchema,
  isRequestedAppointmentInsideBusinessHours,
  resolveRuntimeService,
  timeSchema,
  type AgentToolContext,
  toToolError,
} from '@/src/agent/tools/types';
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
});

export async function checkAvailabilityTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ available: boolean; suggestions?: { date: string; time: string; techName?: string }[] } | ToolError> {
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

    return await ctx.calendarProvider.checkAvailability({
      date: parsed.data.date,
      time: parsed.data.time,
      durationMin: service.durationMin,
      techName: parsed.data.techName,
      timezone: ctx.shop.timezone,
    });
  } catch {
    return toToolError('I am having trouble checking the schedule right now. Let me have the user follow up.', {
      code: 'CALENDAR_TIMEOUT',
      retryable: true,
    });
  }
}
