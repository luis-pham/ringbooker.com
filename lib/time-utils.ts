import type { BusinessHours } from '@/src/backend/domain/types';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Returns true when the current local time in `timezone` falls within the
 * open hours defined in `hours` for today.
 *
 * Days use 3-letter keys: 'mon'–'sun'.
 * Entries: `{ open: 'HH:MM', close: 'HH:MM' }` or `{ closed: true }`.
 */
export function isWithinHours(hours: BusinessHours, timezone: string): boolean {
  let now: Date;
  try {
    now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
  } catch {
    now = new Date();
  }

  const dayKey = DAY_KEYS[now.getDay()];
  const dayHours = hours[dayKey];

  if (!dayHours || 'closed' in dayHours) return false;

  const [openH, openM] = dayHours.open.split(':').map(Number);
  const [closeH, closeM] = dayHours.close.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}
