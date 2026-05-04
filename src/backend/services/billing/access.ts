import { getPlanCatalogEntry } from '@/src/backend/domain/plan-catalog';
import type { BillingSubscription, Shop } from '@/src/backend/domain/types';
import type {
  BillingSubscriptionsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';

export type BillingBlockReason =
  | 'none'
  | 'no_subscription'
  | 'trial_expired'
  | 'payment_method_required'
  | 'subscription_inactive'
  | 'live_not_enabled'
  | 'onboarding_incomplete'
  | 'account_inactive'
  | 'test_call_limit_reached';

export type ShopBillingAccess = {
  canReceiveLiveCalls: boolean;
  canGoLive: boolean;
  canTestCall: boolean;
  blockReason: BillingBlockReason;
  subscriptionStatus: BillingSubscription['status'] | null;
  paymentMethodStatus: BillingSubscription['paymentMethodStatus'];
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  liveCallsEnabled: boolean;
  amountCents: number | null;
  interval: BillingSubscription['interval'] | null;
  currency: string;
  testCallsUsed: number;
  testCallLimit: number;
};

function isTrialStillValid(subscription: BillingSubscription, now: Date): boolean {
  if (subscription.status !== 'trialing') return false;
  if (!subscription.trialEndsAt) return false;
  return new Date(subscription.trialEndsAt).getTime() > now.getTime();
}

function daysRemaining(value: string | null | undefined, now: Date): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function testCallLimitForPlan(plan: Shop['plan']): number {
  return plan === 'professional' ? 5 : 3;
}

export async function getShopBillingAccess(
  deps: {
    shopsRepository: ShopsRepository;
    billingSubscriptionsRepository: BillingSubscriptionsRepository;
    shopAccessStatesRepository: ShopAccessStatesRepository;
    testCallAttemptsRepository?: TestCallAttemptsRepository;
  },
  params: { shopId: string; onboardingComplete?: boolean; now?: Date },
): Promise<ShopBillingAccess> {
  const now = params.now ?? new Date();
  const shop = await deps.shopsRepository.findById(params.shopId);
  if (!shop || !shop.active) {
    return {
      canReceiveLiveCalls: false,
      canGoLive: false,
      canTestCall: false,
      blockReason: 'account_inactive',
      subscriptionStatus: null,
      paymentMethodStatus: 'none',
      trialEndsAt: null,
      trialDaysRemaining: null,
      liveCallsEnabled: false,
      amountCents: null,
      interval: null,
      currency: 'USD',
      testCallsUsed: 0,
      testCallLimit: 0,
    };
  }

  const [subscription, accessState] = await Promise.all([
    deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id),
    deps.shopAccessStatesRepository.findByShopId(shop.id),
  ]);
  const testCallLimit = testCallLimitForPlan(shop.plan);
  const testCallsUsed = deps.testCallAttemptsRepository
    ? await deps.testCallAttemptsRepository.countRecentByShopId({
        shopId: shop.id,
        type: 'outbound_call_me',
        since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      })
    : 0;

  if (!subscription) {
    return {
      canReceiveLiveCalls: false,
      canGoLive: false,
      canTestCall: false,
      blockReason: 'no_subscription',
      subscriptionStatus: null,
      paymentMethodStatus: 'none',
      trialEndsAt: null,
      trialDaysRemaining: null,
      liveCallsEnabled: accessState?.liveCallsEnabled ?? false,
      amountCents: getPlanCatalogEntry(shop.plan).amountCents,
      interval: getPlanCatalogEntry(shop.plan).interval,
      currency: getPlanCatalogEntry(shop.plan).currency,
      testCallsUsed,
      testCallLimit,
    };
  }

  const paymentMethodStatus = subscription.paymentMethodStatus ?? 'none';
  const activeLike = subscription.status === 'active' || isTrialStillValid(subscription, now);
  const expiredTrial = subscription.status === 'trial_expired' || (subscription.status === 'trialing' && !isTrialStillValid(subscription, now));
  const underTestLimit = testCallsUsed < testCallLimit;
  const canTestCall = activeLike && underTestLimit;
  const onboardingComplete = params.onboardingComplete ?? true;
  const canGoLive = activeLike && paymentMethodStatus === 'valid' && onboardingComplete;
  const liveCallsEnabled = accessState?.liveCallsEnabled ?? false;
  const canReceiveLiveCalls = canGoLive && liveCallsEnabled;
  const blockReason: BillingBlockReason = canReceiveLiveCalls
    ? 'none'
    : !activeLike
      ? expiredTrial
        ? 'trial_expired'
        : 'subscription_inactive'
      : paymentMethodStatus !== 'valid'
        ? 'payment_method_required'
        : !onboardingComplete
          ? 'onboarding_incomplete'
          : !liveCallsEnabled
            ? 'live_not_enabled'
            : !underTestLimit
              ? 'test_call_limit_reached'
              : 'none';

  return {
    canReceiveLiveCalls,
    canGoLive,
    canTestCall,
    blockReason,
    subscriptionStatus: subscription.status,
    paymentMethodStatus,
    trialEndsAt: subscription.trialEndsAt ?? null,
    trialDaysRemaining: daysRemaining(subscription.trialEndsAt, now),
    liveCallsEnabled,
    amountCents: subscription.amountCents ?? Math.round(subscription.amount * 100),
    interval: subscription.interval,
    currency: subscription.currency,
    testCallsUsed,
    testCallLimit,
  };
}
