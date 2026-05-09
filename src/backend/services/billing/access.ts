import { isCommercialGoLiveApprovalRequired } from '@/src/backend/domain/commercial-approval';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import { getPlanCatalogEntry } from '@/src/backend/domain/plan-catalog';
import type { BillingSubscription, Shop, ShopAccessState } from '@/src/backend/domain/types';
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
  | 'forwarding_number_required'
  | 'forwarding_verification_required'
  | 'account_inactive'
  | 'commercial_approval_required'
  | 'test_call_limit_reached'
  | 'usage_limit_reached'
  | 'concurrency_limit_reached';

export type ShopBillingAccess = {
  canReceiveLiveCalls: boolean;
  /** All prerequisites met to enable live answering (flip `live_calls_enabled`). */
  canGoLive: boolean;
  canTestCall: boolean;
  blockReason: BillingBlockReason;
  billingProvider: BillingSubscription['provider'] | null;
  subscriptionStatus: BillingSubscription['status'] | null;
  paymentMethodStatus: BillingSubscription['paymentMethodStatus'];
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  liveCallsEnabled: boolean;
  amountCents: number | null;
  interval: BillingSubscription['interval'] | null;
  currency: string;
  testCallsUsed: number;
  testCallLimit: number;
  setupWizardComplete: boolean;
  hasForwardingNumber: boolean;
  forwardingSetupVerified: boolean;
  commercialGoLiveApproved: boolean;
};

/** Same rule as billing access trial gate (exported for admin status + tests). */
export function isBillingTrialStillValid(subscription: BillingSubscription, now: Date): boolean {
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

const inactiveAccess = (): ShopBillingAccess => ({
  canReceiveLiveCalls: false,
  canGoLive: false,
  canTestCall: false,
  blockReason: 'account_inactive',
  billingProvider: null,
  subscriptionStatus: null,
  paymentMethodStatus: 'none',
  providerCustomerId: null,
  providerSubscriptionId: null,
  trialEndsAt: null,
  trialDaysRemaining: null,
  liveCallsEnabled: false,
  amountCents: null,
  interval: null,
  currency: 'USD',
  testCallsUsed: 0,
  testCallLimit: 0,
  setupWizardComplete: false,
  hasForwardingNumber: false,
  forwardingSetupVerified: false,
  commercialGoLiveApproved: false,
});

/**
 * Prefer persisted `forwarding_setup_verified_at`. Optional env grandfather (see
 * RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE) covers legacy shops until SQL backfill runs.
 */
export function resolveForwardingSetupVerified(
  shop: Shop,
  accessState: ShopAccessState | null,
  grandfatherGoLiveBeforeIso?: string | null,
): boolean {
  if (accessState?.forwardingSetupVerifiedAt?.trim()) return true;
  const hasForwardingNumber = Boolean(shop.telnyx_number?.trim());
  if (!hasForwardingNumber || !accessState?.liveCallsEnabled) return false;
  const goLiveAt = accessState.goLiveAt?.trim();
  if (!goLiveAt) return false;
  const rawCutoff = grandfatherGoLiveBeforeIso?.trim();
  if (!rawCutoff) return false;
  const cutoffMs = Date.parse(rawCutoff);
  const glMs = Date.parse(goLiveAt);
  if (Number.isNaN(cutoffMs) || Number.isNaN(glMs)) return false;
  return glMs < cutoffMs;
}

function billingExtrasFromShopAndAccess(
  shop: Shop,
  accessState: ShopAccessState | null,
  grandfatherGoLiveBeforeIso?: string | null,
): {
  setupWizardComplete: boolean;
  hasForwardingNumber: boolean;
  forwardingSetupVerified: boolean;
  commercialGoLiveApproved: boolean;
} {
  return {
    setupWizardComplete: isShopSetupWizardComplete(shop),
    hasForwardingNumber: Boolean(shop.telnyx_number?.trim()),
    forwardingSetupVerified: resolveForwardingSetupVerified(shop, accessState, grandfatherGoLiveBeforeIso),
    commercialGoLiveApproved: !isCommercialGoLiveApprovalRequired({ plan: shop.plan, accessState }),
  };
}

/**
 * Pure billing/access snapshot from already-loaded shop, subscription, and access state.
 * Keeps rules aligned with {@link getShopBillingAccess} without extra repository reads.
 */
export function computeShopBillingAccessSnapshot(params: {
  shop: Shop;
  subscription: BillingSubscription | null;
  accessState: ShopAccessState | null;
  testCallsUsed: number;
  /** @deprecated use setupWizardComplete */
  onboardingComplete?: boolean;
  setupWizardComplete?: boolean;
  now?: Date;
  /** ISO instant; unset disables grandfather (normal path). */
  legacyForwardingVerificationGrandfatherGoLiveBefore?: string | null;
}): ShopBillingAccess {
  const now = params.now ?? new Date();
  const shop = params.shop;
  if (!shop.active) {
    return inactiveAccess();
  }

  const testCallLimit = testCallLimitForPlan(shop.plan);
  const testCallsUsed = params.testCallsUsed;
  const accessState = params.accessState;
  const subscription = params.subscription;
  const grandfatherIso = params.legacyForwardingVerificationGrandfatherGoLiveBefore ?? undefined;

  const extrasDefault = billingExtrasFromShopAndAccess(shop, accessState, grandfatherIso);

  if (!extrasDefault.commercialGoLiveApproved) {
    return {
      canReceiveLiveCalls: false,
      canGoLive: false,
      canTestCall: false,
      blockReason: 'commercial_approval_required',
      billingProvider: subscription?.provider ?? null,
      subscriptionStatus: subscription?.status ?? null,
      paymentMethodStatus: subscription?.paymentMethodStatus ?? 'none',
      providerCustomerId: subscription?.providerCustomerId ?? null,
      providerSubscriptionId: subscription?.providerSubscriptionId ?? null,
      trialEndsAt: subscription?.trialEndsAt ?? null,
      trialDaysRemaining: daysRemaining(subscription?.trialEndsAt, now),
      liveCallsEnabled: accessState?.liveCallsEnabled ?? false,
      amountCents: getPlanCatalogEntry(shop.plan).amountCents,
      interval: getPlanCatalogEntry(shop.plan).interval,
      currency: getPlanCatalogEntry(shop.plan).currency,
      testCallsUsed,
      testCallLimit,
      setupWizardComplete: extrasDefault.setupWizardComplete,
      hasForwardingNumber: extrasDefault.hasForwardingNumber,
      forwardingSetupVerified: extrasDefault.forwardingSetupVerified,
      commercialGoLiveApproved: false,
    };
  }

  if (!subscription) {
    return {
      canReceiveLiveCalls: false,
      canGoLive: false,
      canTestCall: false,
      blockReason: 'no_subscription',
      billingProvider: null,
      subscriptionStatus: null,
      paymentMethodStatus: 'none',
      providerCustomerId: null,
      providerSubscriptionId: null,
      trialEndsAt: null,
      trialDaysRemaining: null,
      liveCallsEnabled: accessState?.liveCallsEnabled ?? false,
      amountCents: getPlanCatalogEntry(shop.plan).amountCents,
      interval: getPlanCatalogEntry(shop.plan).interval,
      currency: getPlanCatalogEntry(shop.plan).currency,
      testCallsUsed,
      testCallLimit,
      setupWizardComplete: extrasDefault.setupWizardComplete,
      hasForwardingNumber: extrasDefault.hasForwardingNumber,
      forwardingSetupVerified: extrasDefault.forwardingSetupVerified,
      commercialGoLiveApproved: extrasDefault.commercialGoLiveApproved,
    };
  }

  const paymentMethodStatus = subscription.paymentMethodStatus ?? 'none';
  const providerIdentityReady =
    subscription.provider !== 'paddle' ||
    (Boolean(subscription.providerCustomerId?.trim()) && Boolean(subscription.providerSubscriptionId?.trim()));
  const activeLike = subscription.status === 'active' || isBillingTrialStillValid(subscription, now);
  const expiredTrial =
    subscription.status === 'trial_expired' || (subscription.status === 'trialing' && !isBillingTrialStillValid(subscription, now));
  const underTestLimit = testCallsUsed < testCallLimit;
  const canTestCall = activeLike && underTestLimit;

  const setupWizardComplete =
    params.setupWizardComplete ??
    params.onboardingComplete ??
    isShopSetupWizardComplete(shop);

  const hasForwardingNumber = extrasDefault.hasForwardingNumber;
  const forwardingSetupVerified = extrasDefault.forwardingSetupVerified;

  const liveAnsweringPrerequisitesMet =
    activeLike &&
    providerIdentityReady &&
    paymentMethodStatus === 'valid' &&
    setupWizardComplete &&
    hasForwardingNumber &&
    forwardingSetupVerified;

  const canGoLive = liveAnsweringPrerequisitesMet;
  const liveCallsEnabled = accessState?.liveCallsEnabled ?? false;
  const canReceiveLiveCalls = canGoLive && liveCallsEnabled;

  let blockReason: BillingBlockReason;
  if (canReceiveLiveCalls) {
    blockReason = 'none';
  } else if (!activeLike) {
    blockReason = expiredTrial ? 'trial_expired' : 'subscription_inactive';
  } else if (!providerIdentityReady) {
    blockReason = 'no_subscription';
  } else if (paymentMethodStatus !== 'valid') {
    blockReason = 'payment_method_required';
  } else if (!setupWizardComplete) {
    blockReason = 'onboarding_incomplete';
  } else if (!hasForwardingNumber) {
    blockReason = 'forwarding_number_required';
  } else if (!forwardingSetupVerified) {
    blockReason = 'forwarding_verification_required';
  } else if (!liveCallsEnabled) {
    blockReason = 'live_not_enabled';
  } else {
    blockReason = 'none';
  }

  return {
    canReceiveLiveCalls,
    canGoLive,
    canTestCall,
    blockReason,
    billingProvider: subscription.provider,
    subscriptionStatus: subscription.status,
    paymentMethodStatus,
    providerCustomerId: subscription.providerCustomerId ?? null,
    providerSubscriptionId: subscription.providerSubscriptionId ?? null,
    trialEndsAt: subscription.trialEndsAt ?? null,
    trialDaysRemaining: daysRemaining(subscription.trialEndsAt, now),
    liveCallsEnabled,
    amountCents: subscription.amountCents ?? Math.round(subscription.amount * 100),
    interval: subscription.interval,
    currency: subscription.currency,
    testCallsUsed,
    testCallLimit,
    setupWizardComplete,
    hasForwardingNumber,
    forwardingSetupVerified,
    commercialGoLiveApproved: extrasDefault.commercialGoLiveApproved,
  };
}

export async function getShopBillingAccess(
  deps: {
    shopsRepository: ShopsRepository;
    billingSubscriptionsRepository: BillingSubscriptionsRepository;
    shopAccessStatesRepository: ShopAccessStatesRepository;
    testCallAttemptsRepository?: TestCallAttemptsRepository;
  },
  params: {
    shopId: string;
    /** Override wizard snapshot (tests); defaults from shop row. */
    setupWizardComplete?: boolean;
    /** @deprecated use setupWizardComplete */
    onboardingComplete?: boolean;
    now?: Date;
  },
): Promise<ShopBillingAccess> {
  const now = params.now ?? new Date();
  const shop = await deps.shopsRepository.findById(params.shopId);
  if (!shop || !shop.active) {
    return inactiveAccess();
  }

  const [subscription, accessState] = await Promise.all([
    deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id),
    deps.shopAccessStatesRepository.findByShopId(shop.id),
  ]);
  const testCallsUsed = deps.testCallAttemptsRepository
    ? await deps.testCallAttemptsRepository.countRecentByShopId({
        shopId: shop.id,
        type: 'outbound_call_me',
        since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      })
    : 0;

  /** Prefer SQL backfill; optional bridge (validated in env.ts). Raw `process.env` keeps unit tests free of full `getEnv()`. */
  const grandfatherIso =
    process.env.RB_FORWARDING_VERIFICATION_GRANDFATHER_GO_LIVE_BEFORE?.trim() || undefined;

  return computeShopBillingAccessSnapshot({
    shop,
    subscription,
    accessState,
    testCallsUsed,
    setupWizardComplete: params.setupWizardComplete,
    onboardingComplete: params.onboardingComplete,
    now,
    legacyForwardingVerificationGrandfatherGoLiveBefore: grandfatherIso,
  });
}
