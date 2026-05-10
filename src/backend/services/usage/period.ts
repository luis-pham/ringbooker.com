import { getShopLocalMonthPeriod } from '@/src/shared/timezone';

export function calendarMonthPeriod(now = new Date(), shopTimezone?: string | null): { periodStart: Date; periodEnd: Date } {
  if (shopTimezone) return getShopLocalMonthPeriod(now, shopTimezone);
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}
