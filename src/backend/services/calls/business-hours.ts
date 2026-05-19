import type { Shop } from '@/src/backend/domain/types';

export function parseBusinessTimeMinutes(value: string | null | undefined, fallback: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? fallback);
  if (!match) return parseBusinessTimeMinutes(fallback, '08:00');
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return parseBusinessTimeMinutes(fallback, '08:00');
  }
  return hours * 60 + minutes;
}

export function isWithinBusinessHours(shop: Pick<Shop, 'hours' | 'timezone'>, now?: Date): boolean {
  const ref = now ?? new Date();
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: shop.timezone })
    .format(ref)
    .toLowerCase();
  const entry = shop.hours?.[day];
  if (!entry || 'closed' in entry) return false;
  const tzNow = new Date(ref.toLocaleString('en-US', { timeZone: shop.timezone }));
  const currentMinutes = tzNow.getHours() * 60 + tzNow.getMinutes();
  return (
    currentMinutes >= parseBusinessTimeMinutes(entry.open, '09:00') &&
    currentMinutes < parseBusinessTimeMinutes(entry.close, '17:00')
  );
}
