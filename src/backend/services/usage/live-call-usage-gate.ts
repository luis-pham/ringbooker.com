import type { BillingSubscription, CommercialAccount, Shop } from '@/src/backend/domain/types';
import type {
  BillingSubscriptionsRepository,
  CallLogsRepository,
  ShopActiveCallSessionsRepository,
} from '@/src/backend/ports/repositories';
import { getBillingPeriodForShop } from '@/src/backend/services/usage/period';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';

export type LiveCallUsageGateResult =
  | { ok: true; usage: Awaited<ReturnType<typeof getShopUsageForPeriod>> }
  | { ok: false; reason: 'usage_limit_reached' | 'concurrency_limit_reached'; usage: Awaited<ReturnType<typeof getShopUsageForPeriod>> };

function shouldBlockCapturedCallerOverage(subscription: BillingSubscription | null): boolean {
  const isTrial = !subscription || subscription.status === 'trialing';
  const isPastDue = subscription?.status === 'past_due' || subscription?.status === 'unpaid';
  const isPaymentFailed = subscription?.paymentMethodStatus === 'failed';
  return isTrial || isPastDue || isPaymentFailed;
}

export async function checkLiveCallUsageGate(
  deps: {
    callLogsRepository: CallLogsRepository;
    shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
    billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  },
  params: {
    shop: Shop;
    commercialAccount?: CommercialAccount | null;
    now?: Date;
  },
): Promise<LiveCallUsageGateResult> {
  const now = params.now ?? new Date();
  const period = await getBillingPeriodForShop(params.shop.id, deps, {
    now,
    shopTimezone: params.shop.timezone,
  });
  const usage = await getShopUsageForPeriod(deps, { ...params, now, period });
  // Voice minutes are intentionally unlimited. Captured callers can accrue paid overage
  // for active paid subscriptions, but trial and failed-payment shops still hard block.
  if (usage.overCapturedCallerLimit) {
    const subscription = deps.billingSubscriptionsRepository
      ? await deps.billingSubscriptionsRepository.findCurrentByShopId(params.shop.id).catch(() => null)
      : null;
    if (shouldBlockCapturedCallerOverage(subscription)) {
      return { ok: false, reason: 'usage_limit_reached', usage };
    }
  }
  if (usage.activeLiveCalls >= usage.maxConcurrentLiveCalls) {
    return { ok: false, reason: 'concurrency_limit_reached', usage };
  }
  return { ok: true, usage };
}
