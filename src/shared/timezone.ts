import { DateTime } from 'luxon';

export const DEFAULT_SHOP_TIMEZONE = 'America/Los_Angeles';

export function normalizeShopTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim() || DEFAULT_SHOP_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date('2026-01-01T00:00:00Z'));
    return candidate;
  } catch {
    return DEFAULT_SHOP_TIMEZONE;
  }
}

export function getShopTimezone(shop?: { timezone?: string | null } | null): string {
  return normalizeShopTimezone(shop?.timezone);
}

function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShopDate(value?: string | Date | null, shopTimezone?: string | null, locale = 'en-US'): string {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeShopTimezone(shopTimezone),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatShopLongDate(value?: string | Date | null, shopTimezone?: string | null, locale = 'en-US'): string {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeShopTimezone(shopTimezone),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatShopTime(value?: string | Date | null, shopTimezone?: string | null, locale = 'en-US'): string {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeShopTimezone(shopTimezone),
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatShopDateTime(value?: string | Date | null, shopTimezone?: string | null, locale = 'en-US'): string {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat(locale, {
    timeZone: normalizeShopTimezone(shopTimezone),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function getShopLocalMonthPeriod(nowUtc: Date = new Date(), shopTimezone?: string | null): { periodStart: Date; periodEnd: Date } {
  const zone = normalizeShopTimezone(shopTimezone);
  const local = DateTime.fromJSDate(nowUtc, { zone: 'utc' }).setZone(zone);
  const periodStart = local.startOf('month').toUTC().toJSDate();
  const periodEnd = local.plus({ months: 1 }).startOf('month').toUTC().toJSDate();
  return { periodStart, periodEnd };
}

type BusinessHoursEntry = { closed: true } | { open: string; close: string };
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function minutesFromHm(value: string): number | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function isWithinBusinessHours(
  dateUtc: Date | string,
  businessHours: Record<string, BusinessHoursEntry | undefined> | null | undefined,
  shopTimezone?: string | null,
): boolean {
  const date = parseDate(dateUtc);
  if (!date || !businessHours) return false;
  const local = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(normalizeShopTimezone(shopTimezone));
  const current = local.hour * 60 + local.minute;
  const todayIndex = local.weekday % 7;
  const entry = businessHours[DAY_KEYS[todayIndex]];
  if (entry && !('closed' in entry)) {
    const open = minutesFromHm(entry.open);
    const close = minutesFromHm(entry.close);
    if (open != null && close != null) {
      if (close > open && current >= open && current < close) return true;
      if (close < open && current >= open) return true;
    }
  }

  const previousEntry = businessHours[DAY_KEYS[(todayIndex + 6) % 7]];
  if (previousEntry && !('closed' in previousEntry)) {
    const previousOpen = minutesFromHm(previousEntry.open);
    const previousClose = minutesFromHm(previousEntry.close);
    if (previousOpen != null && previousClose != null && previousClose < previousOpen && current < previousClose) return true;
  }
  return false;
}
