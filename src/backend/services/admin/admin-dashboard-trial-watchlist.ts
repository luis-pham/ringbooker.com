import type { BillingSubscription, Shop } from '@/src/backend/domain/types';

export type AdminTrialEndingSoonItem = {
  shopId: string;
  shopName: string;
  plan: BillingSubscription['plan'];
  trialEndsAt: string;
  daysRemaining: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Calendar days remaining until `trialEndsAt` (UTC ceiling). */
export function trialDaysRemainingUtc(trialEndsAt: string, now: Date): number | null {
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - now.getTime()) / MS_PER_DAY);
}

/** Trialing shops with a valid payment method and trial ending within `windowDays` (inclusive). */
export function buildAdminTrialEndingSoonWatchlist(
  shops: Shop[],
  subsByShop: Map<string, BillingSubscription | null>,
  now: Date,
  options?: { windowDays?: number },
): AdminTrialEndingSoonItem[] {
  const windowDays = options?.windowDays ?? 14;
  const items: AdminTrialEndingSoonItem[] = [];
  for (const shop of shops) {
    const sub = subsByShop.get(shop.id);
    if (!sub || sub.status !== 'trialing') continue;
    if (sub.paymentMethodStatus !== 'valid') continue;
    if (!sub.trialEndsAt) continue;
    const daysRemaining = trialDaysRemainingUtc(sub.trialEndsAt, now);
    if (daysRemaining === null || daysRemaining < 0 || daysRemaining > windowDays) continue;
    items.push({
      shopId: shop.id,
      shopName: shop.name,
      plan: sub.plan,
      trialEndsAt: sub.trialEndsAt,
      daysRemaining,
    });
  }
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return items;
}
