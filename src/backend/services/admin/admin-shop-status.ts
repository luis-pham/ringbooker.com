import { isShopOnboardingComplete } from '@/src/backend/domain/shop-onboarding';
import type { BillingSubscription, Shop, ShopAccessState } from '@/src/backend/domain/types';
import {
  computeShopBillingAccessSnapshot,
  isBillingTrialStillValid,
  type BillingBlockReason,
} from '@/src/backend/services/billing/access';

export type AdminShopTrialStatus = 'none' | 'trialing' | 'trial_ended' | 'not_applicable';

export type AdminShopStatus = {
  accountStatus: 'active' | 'inactive';
  plan: string;
  trialStatus: AdminShopTrialStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  subscriptionStatus: string | null;
  paymentMethodStatus: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
  onboardingStatus: 'complete' | 'incomplete';
  onboardingStep: number | null;
  liveAnsweringStatus: 'enabled' | 'disabled' | 'unknown';
  liveAnsweringPausedReason: string | null;
  phoneSetupStatus: 'forward' | 'new_number' | 'unknown';
  telnyxNumber: string | null;
  businessPhone: string | null;
  forwardingType: string | null;
  forwardingCarrier: string | null;
  blockReason: BillingBlockReason | null;
  canReceiveLiveCalls: boolean;
  canGoLive: boolean;
};

function computeTrialStatus(
  subscription: BillingSubscription | null,
  now: Date,
): AdminShopTrialStatus {
  if (!subscription) return 'none';
  if (subscription.status === 'trialing') {
    return isBillingTrialStillValid(subscription, now) ? 'trialing' : 'trial_ended';
  }
  if (subscription.status === 'trial_expired') return 'trial_ended';
  if (subscription.status === 'active') return 'not_applicable';
  return 'not_applicable';
}

function phoneSetupStatus(shop: Shop): AdminShopStatus['phoneSetupStatus'] {
  const m = shop.setup_method;
  if (m === 'forward' || m === 'new_number') return m;
  return 'unknown';
}

/**
 * Admin-facing SaaS status for a shop. Uses {@link computeShopBillingAccessSnapshot} for billing gates
 * (same rules as {@link getShopBillingAccess} when passed matching inputs).
 */
export function buildAdminShopStatus(params: {
  shop: Shop;
  subscription: BillingSubscription | null;
  accessState: ShopAccessState | null;
  testCallsUsed: number;
  now?: Date;
}): AdminShopStatus {
  const now = params.now ?? new Date();
  const shop = params.shop;
  const subscription = params.subscription;
  const accessState = params.accessState;
  const onboardingComplete = isShopOnboardingComplete(shop);

  const billing = computeShopBillingAccessSnapshot({
    shop,
    subscription,
    accessState,
    testCallsUsed: params.testCallsUsed,
    onboardingComplete,
    now,
  });

  const trialEndsAt = subscription?.trialEndsAt ?? null;
  const trialStartedAt = subscription?.trialStartedAt ?? null;
  const trialDaysLeft = billing.trialDaysRemaining;

  let liveAnsweringStatus: AdminShopStatus['liveAnsweringStatus'] = 'unknown';
  if (accessState) {
    liveAnsweringStatus = accessState.liveCallsEnabled ? 'enabled' : 'disabled';
  }

  const blockReason: BillingBlockReason | null = shop.active ? billing.blockReason : 'account_inactive';

  return {
    accountStatus: shop.active ? 'active' : 'inactive',
    plan: shop.plan,
    trialStatus: computeTrialStatus(subscription, now),
    trialStartedAt,
    trialEndsAt,
    trialDaysLeft,
    subscriptionStatus: subscription?.status ?? null,
    paymentMethodStatus: billing.paymentMethodStatus ?? 'unknown',
    onboardingStatus: onboardingComplete ? 'complete' : 'incomplete',
    onboardingStep: shop.current_onboarding_step ?? null,
    liveAnsweringStatus,
    liveAnsweringPausedReason: accessState?.liveCallsPausedReason ?? null,
    phoneSetupStatus: phoneSetupStatus(shop),
    telnyxNumber: shop.telnyx_number ?? null,
    businessPhone: shop.phone_number ?? null,
    forwardingType: shop.forwarding_type ?? null,
    forwardingCarrier: shop.forwarding_carrier ?? null,
    blockReason,
    canReceiveLiveCalls: billing.canReceiveLiveCalls,
    canGoLive: billing.canGoLive,
  };
}
