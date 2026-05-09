import { z } from 'zod';

import type { AgentToolContext } from '@/src/agent/tools/types';
import type { ToolError } from '@/src/backend/domain/types';

const schema = z.object({
  query: z.string().min(1),
});

export async function getShopInfoTool(
  ctx: AgentToolContext,
  input: unknown,
): Promise<
  | {
      name: string;
      address?: string | null;
      timezone: string;
      hours: unknown;
      services: unknown;
      staff: unknown;
      faqs: unknown;
      promotions?: string | null;
      bookingUrl: string | null;
      cancelPolicy: string;
    }
  | ToolError
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      error: 'Invalid shop info query.',
      code: 'VALIDATION_ERROR',
      retryable: false,
    };
  }

  void parsed.data.query;

  return {
    name: ctx.shop.name,
    address: ctx.shop.address,
    timezone: ctx.shop.timezone,
    hours: ctx.shop.hours,
    services: ctx.shop.services,
    staff: ctx.shop.staff ?? [],
    faqs: ctx.shop.faqs ?? [],
    promotions: ctx.shop.promotions,
    bookingUrl: ctx.shop.booking_url ?? null,
    cancelPolicy: ctx.shop.cancel_policy,
  };
}
