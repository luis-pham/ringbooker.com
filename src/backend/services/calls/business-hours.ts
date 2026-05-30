import type { Shop } from '@/src/backend/domain/types';
import { normalizeDayKey } from '@/src/backend/services/calls/day-key-utils';
import { formatHour } from '@/src/backend/utils/time-format';

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
  const normalizedHours = normalizeBusinessHours(shop.hours);
  const entry = normalizedHours[day];
  if (!entry || 'closed' in entry) return false;
  const tzNow = new Date(ref.toLocaleString('en-US', { timeZone: shop.timezone }));
  const currentMinutes = tzNow.getHours() * 60 + tzNow.getMinutes();
  return (
    currentMinutes >= parseBusinessTimeMinutes(entry.open, '09:00') &&
    currentMinutes < parseBusinessTimeMinutes(entry.close, '17:00')
  );
}

export function resolveShopTimeContext(
  shop: Pick<Shop, 'hours' | 'timezone'>,
  now?: Date,
): { currentLocalTime: string; currentlyOpen: boolean; todayHours: string | null } {
  const ref = now ?? new Date();
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: shop.timezone })
    .format(ref)
    .toLowerCase();
  const currentLocalTime = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: shop.timezone,
  }).format(ref);
  const normalizedHours = normalizeBusinessHours(shop.hours);
  const entry = normalizedHours[day];
  const todayHours = entry ? ('closed' in entry ? 'Closed' : `${formatHour(entry.open)} to ${formatHour(entry.close)}`) : null;

  return {
    currentLocalTime,
    currentlyOpen: isWithinBusinessHours(shop, ref),
    todayHours,
  };
}

function normalizeBusinessHours(shopHours: Pick<Shop, 'hours'>['hours'] | null | undefined): Pick<Shop, 'hours'>['hours'] {
  const normalized: Pick<Shop, 'hours'>['hours'] = {};
  for (const [key, value] of Object.entries(shopHours ?? {})) {
    normalized[normalizeDayKey(key)] = value;
  }
  return normalized;
}
