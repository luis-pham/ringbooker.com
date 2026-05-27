import { DateTime } from 'luxon';
import { z } from 'zod';

import {
  dateSchema,
  isRequestedAppointmentInsideBusinessHours,
  shopLocalToUtcIso,
  timeSchema,
  type AgentToolContext,
  toToolError,
} from '@/src/agent/tools/types';
import type { ToolError } from '@/src/backend/domain/types';

const schema = z.object({
  date: dateSchema,
  time: timeSchema,
});

export type AppointmentTimeValidationResult = {
  success: true;
  valid: boolean;
  reason: 'within_business_hours' | 'outside_business_hours' | 'business_hours_not_configured' | 'past_datetime';
  normalizedDatetimeUtc: string;
  messageForAi: string;
};

/**
 * Derive the `messageForAi` field from a validation `reason`.
 * Extracted so the cache-hit path in `sip-tool-executor` can reconstruct the full
 * result without re-running the tool.
 */
export function buildValidationMessageForAi(
  reason: AppointmentTimeValidationResult['reason'],
): string {
  if (reason === 'past_datetime') {
    return 'That appointment time has already passed. Ask for another future appointment date and time. Do not ask for name or phone yet.';
  }
  if (reason === 'within_business_hours' || reason === 'business_hours_not_configured') {
    return 'The requested time may be captured. Continue without saying you checked anything, without claiming availability, and without describing the date as too far in the future.';
  }
  return 'That time is outside our business hours. Say so now and ask for another time during our opening hours. Do not ask for name or phone yet.';
}

export function requiresAppointmentTimeValidation(ctx: AgentToolContext): boolean {
  return Boolean(ctx.appointmentTimeValidation);
}

export function hasValidAppointmentTimeValidation(
  ctx: AgentToolContext,
  params: { date: string; time: string },
): boolean {
  const validated = ctx.appointmentTimeValidation?.latest;
  return Boolean(validated && validated.date === params.date && validated.time === params.time && validated.valid);
}

export async function validateAppointmentTimeTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<AppointmentTimeValidationResult | ToolError> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return toToolError('Invalid appointment date or time.', { code: 'VALIDATION_ERROR', retryable: false });
  }

  const normalizedDatetimeUtc = shopLocalToUtcIso({
    date: parsed.data.date,
    time: parsed.data.time,
    timezone: ctx.shop.timezone,
  });
  if (!normalizedDatetimeUtc) {
    return toToolError('Invalid appointment time for this shop timezone.', { code: 'VALIDATION_ERROR', retryable: false });
  }

  const requestedDatetime = DateTime.fromISO(normalizedDatetimeUtc, { zone: 'utc' });
  const isPastDatetime = requestedDatetime < DateTime.utc();
  const insideHours = isPastDatetime ? null : isRequestedAppointmentInsideBusinessHours(ctx.shop, parsed.data);
  const reason =
    isPastDatetime
      ? 'past_datetime'
      : insideHours === false
        ? 'outside_business_hours'
        : insideHours === true
          ? 'within_business_hours'
          : 'business_hours_not_configured';
  const valid = reason === 'within_business_hours' || reason === 'business_hours_not_configured';

  if (ctx.appointmentTimeValidation) {
    ctx.appointmentTimeValidation.latest = {
      ...parsed.data,
      valid,
      reason,
      normalizedDatetimeUtc,
    };
  }

  return {
    success: true,
    valid,
    reason,
    normalizedDatetimeUtc,
    messageForAi: buildValidationMessageForAi(reason),
  };
}
