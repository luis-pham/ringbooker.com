import type { BillingSubscriptionsRepository } from '@/src/backend/ports/repositories';
import { getShopLocalMonthPeriod } from '@/src/shared/timezone';

export type UsagePeriod = { start: Date; end: Date };
type CalendarUsagePeriod = { periodStart: Date; periodEnd: Date };

export function calendarMonthPeriod(now = new Date(), shopTimezone?: string | null): CalendarUsagePeriod {
  if (shopTimezone) return getShopLocalMonthPeriod(now, shopTimezone);
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}

function parsePeriodDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getBillingPeriodForShop(
  shopId: string,
  deps: { billingSubscriptionsRepository?: BillingSubscriptionsRepository | null },
  params: { now?: Date; shopTimezone?: string | null } = {},
): Promise<UsagePeriod> {
  const fallback = () => {
    const calendarPeriod = calendarMonthPeriod(params.now ?? new Date(), params.shopTimezone);
    return { start: calendarPeriod.periodStart, end: calendarPeriod.periodEnd };
  };

  if (!deps.billingSubscriptionsRepository) return fallback();

  const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shopId).catch(() => null);
  const start = parsePeriodDate(subscription?.currentPeriodStart);
  const end = parsePeriodDate(subscription?.currentPeriodEnd);

  if (start && end && start < end) {
    return { start, end };
  }

  // Trial/no-card shops can exist before Paddle creates a billing_subscriptions row.
  // Keep the old shop-local calendar month behavior only for that fallback path.
  return fallback();
}
