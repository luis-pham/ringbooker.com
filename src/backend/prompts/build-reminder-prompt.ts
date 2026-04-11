import type { BookingView, Shop } from '@/src/backend/domain/types';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';

export function buildReminderPrompt(shop: Shop, booking: BookingView): string {
  return [
    buildSystemPrompt({
      shop,
      customer: null,
      mode: 'outbound_reminder',
    }),
    'REMINDER_CONTEXT:',
    `SERVICE: ${booking.service}`,
    `DATE/TIME: ${booking.localDateLabel} at ${booking.localTimeLabel}`,
    `TECHNICIAN: ${booking.tech_name ?? 'Any available technician'}`,
  ].join('\n');
}
