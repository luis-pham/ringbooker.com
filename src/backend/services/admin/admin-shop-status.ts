import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
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
  commercialGoLiveApproved: boolean;
  commercialGoLiveApprovedAt: string | null;
  commercialGoLiveApprovedBy: string | null;
  commercialGoLiveApprovalNote: string | null;
  commercialApprovalRequired: boolean;
  goLiveChecklist: Array<{
    id:
      | 'commercial_approval'
      | 'payment_method'
      | 'onboarding'
      | 'forwarding_number'
      | 'forwarding_verification'
      | 'live_answering';
    label: string;
    status: 'complete' | 'pending' | 'blocked' | 'not_required';
    detail: string;
    completedAt: string | null;
  }>;
  goLiveTimeline: Array<{
    id: string;
    label: string;
    occurredAt: string;
    detail: string;
  }>;
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

function buildGoLiveChecklist(params: {
  shop: Shop;
  subscription: BillingSubscription | null;
  accessState: ShopAccessState | null;
  commercialApprovalRequired: boolean;
  onboardingComplete: boolean;
  paymentMethodStatus: AdminShopStatus['paymentMethodStatus'];
}): AdminShopStatus['goLiveChecklist'] {
  const commercialApprovedAt = params.accessState?.commercialGoLiveApprovedAt ?? null;
  const forwardingVerifiedAt = params.accessState?.forwardingVerifiedAt ?? params.accessState?.forwardingSetupVerifiedAt ?? null;
  const goLiveAt = params.accessState?.goLiveAt ?? null;
  const hasForwardingNumber = Boolean(params.shop.telnyx_number?.trim());
  const paymentValid = params.paymentMethodStatus === 'valid';
  const liveEnabled = params.accessState?.liveCallsEnabled === true;

  return [
    {
      id: 'commercial_approval',
      label: 'Commercial approval',
      status: params.commercialApprovalRequired
        ? 'blocked'
        : commercialApprovedAt
          ? 'complete'
          : params.shop.plan === 'enterprise'
            ? 'pending'
            : 'not_required',
      detail: params.shop.plan === 'enterprise'
        ? commercialApprovedAt
          ? 'Custom / Enterprise launch approved by RingBooker.'
          : 'Custom / Enterprise launch needs RingBooker approval.'
        : 'Only required for Custom / Enterprise shops.',
      completedAt: commercialApprovedAt,
    },
    {
      id: 'payment_method',
      label: 'Payment method',
      status: paymentValid ? 'complete' : 'blocked',
      detail: paymentValid ? 'Valid payment method on file.' : 'A valid payment method is required before go-live.',
      completedAt: paymentValid ? params.subscription?.updatedAt ?? null : null,
    },
    {
      id: 'onboarding',
      label: 'Onboarding',
      status: params.onboardingComplete ? 'complete' : 'blocked',
      detail: params.onboardingComplete ? 'Required setup data is complete.' : 'Business basics, hours, services, and required setup must be completed.',
      completedAt: null,
    },
    {
      id: 'forwarding_number',
      label: 'Forwarding number',
      status: hasForwardingNumber ? 'complete' : 'pending',
      detail: hasForwardingNumber ? 'RingBooker technical forwarding number is assigned.' : 'Forwarding number has not been provisioned yet.',
      completedAt: null,
    },
    {
      id: 'forwarding_verification',
      label: 'Forwarding verification',
      status: forwardingVerifiedAt ? 'complete' : hasForwardingNumber ? 'pending' : 'blocked',
      detail: forwardingVerifiedAt
        ? `Verified via ${params.accessState?.forwardingVerifiedSource ?? params.accessState?.forwardingSetupVerifiedVia ?? 'unknown'}.`
        : hasForwardingNumber
          ? 'Call the business number to verify forwarding or use admin override.'
          : 'Provision a forwarding number before verification.',
      completedAt: forwardingVerifiedAt,
    },
    {
      id: 'live_answering',
      label: 'Live answering',
      status: liveEnabled ? 'complete' : forwardingVerifiedAt ? 'pending' : 'blocked',
      detail: liveEnabled ? 'Live answering is enabled.' : 'Enable live answering after all required gates are complete.',
      completedAt: goLiveAt,
    },
  ];
}

function buildGoLiveTimeline(params: {
  subscription: BillingSubscription | null;
  accessState: ShopAccessState | null;
}): AdminShopStatus['goLiveTimeline'] {
  const events: AdminShopStatus['goLiveTimeline'] = [];
  if (params.subscription?.createdAt) {
    events.push({
      id: 'subscription_created',
      label: 'Subscription record created',
      occurredAt: params.subscription.createdAt,
      detail: params.subscription.status,
    });
  }
  if (params.subscription?.paymentMethodStatus === 'valid' && params.subscription.updatedAt) {
    events.push({
      id: 'payment_valid',
      label: 'Payment method valid',
      occurredAt: params.subscription.updatedAt,
      detail: 'Payment method is valid.',
    });
  }
  if (params.accessState?.commercialGoLiveApprovedAt) {
    events.push({
      id: 'commercial_approved',
      label: 'Commercial go-live approved',
      occurredAt: params.accessState.commercialGoLiveApprovedAt,
      detail: params.accessState.commercialGoLiveApprovedBy
        ? `Approved by ${params.accessState.commercialGoLiveApprovedBy}.`
        : 'Approved by RingBooker.',
    });
  }
  const forwardingVerifiedAt = params.accessState?.forwardingVerifiedAt ?? params.accessState?.forwardingSetupVerifiedAt;
  if (forwardingVerifiedAt) {
    const forwardingVerifiedSource =
      params.accessState?.forwardingVerifiedSource ?? params.accessState?.forwardingSetupVerifiedVia ?? 'unknown';
    events.push({
      id: 'forwarding_verified',
      label: 'Forwarding setup verified',
      occurredAt: forwardingVerifiedAt,
      detail: `Verified via ${forwardingVerifiedSource}.`,
    });
  }
  if (params.accessState?.goLiveAt) {
    events.push({
      id: 'live_enabled',
      label: 'Live answering enabled',
      occurredAt: params.accessState.goLiveAt,
      detail: 'Shop moved to live answering.',
    });
  }
  if (params.accessState?.liveCallsPausedAt) {
    events.push({
      id: 'live_paused',
      label: 'Live answering paused',
      occurredAt: params.accessState.liveCallsPausedAt,
      detail: params.accessState.liveCallsPausedReason ?? 'No reason recorded.',
    });
  }
  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
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
  const billing = computeShopBillingAccessSnapshot({
    shop,
    subscription,
    accessState,
    testCallsUsed: params.testCallsUsed,
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
  const onboardingComplete = isShopSetupWizardComplete(shop);
  const commercialApprovalRequired = billing.blockReason === 'commercial_approval_required';

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
    commercialGoLiveApproved: billing.commercialGoLiveApproved,
    commercialGoLiveApprovedAt: accessState?.commercialGoLiveApprovedAt ?? null,
    commercialGoLiveApprovedBy: accessState?.commercialGoLiveApprovedBy ?? null,
    commercialGoLiveApprovalNote: accessState?.commercialGoLiveApprovalNote ?? null,
    commercialApprovalRequired,
    goLiveChecklist: buildGoLiveChecklist({
      shop,
      subscription,
      accessState,
      commercialApprovalRequired,
      onboardingComplete,
      paymentMethodStatus: billing.paymentMethodStatus ?? 'unknown',
    }),
    goLiveTimeline: buildGoLiveTimeline({ subscription, accessState }),
  };
}
