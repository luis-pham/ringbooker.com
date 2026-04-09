import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { dateSchema, findServiceDuration, timeSchema, type AgentToolContext, toToolError } from '@/src/agent/tools/types';

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
    const durationMin = findServiceDuration(ctx.shop, parsed.data.service);
    return await ctx.calendarProvider.checkAvailability({
      date: parsed.data.date,
      time: parsed.data.time,
      durationMin,
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
