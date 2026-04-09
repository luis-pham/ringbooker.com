import type { BookingView, Shop } from '@/src/backend/domain/types';

export function buildReminderPrompt(shop: Shop, booking: BookingView): string {
  return `
You are calling a customer to remind them about an appointment.

SHOP: ${shop.name}
SERVICE: ${booking.service}
DATE/TIME: ${booking.localDateLabel} at ${booking.localTimeLabel}
TECHNICIAN: ${booking.tech_name ?? 'Any available technician'}

GOAL:
1. remind them of the appointment
2. ask if they are still planning to come
3. if yes, acknowledge briefly
4. if they need changes, ask them to call or text the shop number
5. keep the call under 30 seconds when possible

Start with:
"Hi, this is a reminder call from ${shop.name} about your appointment."
  `.trim();
}

