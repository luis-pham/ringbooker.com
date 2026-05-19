import { z } from 'zod';

import type { AgentToolContext } from './types';

const schema = z.object({
  reason: z.enum([
    'booking_completed',
    'link_sent',
    'question_answered',
    'callback_scheduled',
    'handoff_initiated',
    'other',
  ]),
});

export async function endCallTool(
  _ctx: AgentToolContext,
  input: unknown,
): Promise<{ ok: boolean; message: string }> {
  const parsed = schema.safeParse(input);
  const reason = parsed.success ? parsed.data.reason : 'other';
  void reason; // consumed for logging by the caller (sideband / runtime)
  return { ok: true, message: 'Acknowledged. The call will end shortly.' };
}
