import { z } from 'zod';

import type { ToolError } from '@/src/backend/domain/types';
import { logger } from '@/src/backend/observability/logger';
import { type AgentToolContext, toToolError } from '@/src/agent/tools/types';

const schema = z.object({});

export async function recordSmsConsentTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<{ success: true; message: string } | { success: false; message: string } | ToolError> {
  schema.safeParse(input);

  if (!ctx.customersRepository) {
    return toToolError('SMS consent recording is not available.', { code: 'INTERNAL', retryable: false });
  }

  const phone = ctx.callerPhone;
  if (!phone) {
    return { success: false, message: 'No caller phone available to record consent.' };
  }

  try {
    await ctx.customersRepository.setSmsConsent(ctx.shop.id, phone);
    logger.info({ shopId: ctx.shop.id, phone }, 'sms_consent_recorded');
    return { success: true, message: 'SMS consent recorded. Automated appointment reminders and booking confirmations may now be sent.' };
  } catch (error) {
    logger.warn({ err: error, shopId: ctx.shop.id, phone }, 'sms_consent_record_failed');
    return toToolError('Unable to record SMS consent right now.', { code: 'INTERNAL', retryable: true });
  }
}
