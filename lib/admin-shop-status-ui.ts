import type { AdminShopStatus } from '@/src/backend/services/admin/admin-shop-status';

export function adminSubscriptionLabel(s: AdminShopStatus): string {
  const st = s.subscriptionStatus;
  if (!st) return 'No active subscription';
  switch (st) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trialing';
    case 'past_due':
      return 'Past due';
    case 'canceled':
      return 'Canceled';
    case 'trial_expired':
      return 'Trial ended';
    case 'paused':
      return 'Paused';
    case 'unpaid':
      return 'Unpaid';
    case 'incomplete':
      return 'Incomplete';
    case 'unknown':
      return 'Unknown';
    default:
      return st.replace(/_/g, ' ');
  }
}

export function adminPaymentMethodLabel(s: AdminShopStatus): string {
  switch (s.paymentMethodStatus) {
    case 'none':
      return 'Payment method missing';
    case 'pending':
      return 'Payment method pending';
    case 'valid':
      return 'Payment method on file';
    case 'failed':
      return 'Payment method failed';
    case 'unknown':
    default:
      return 'Payment method unknown';
  }
}

export function adminLiveAnsweringLabel(s: AdminShopStatus): string {
  switch (s.liveAnsweringStatus) {
    case 'enabled':
      return 'Live answering on';
    case 'disabled':
      return 'Live answering off';
    default:
      return 'Live answering unknown';
  }
}

export function adminOnboardingLabel(s: AdminShopStatus): string {
  if (s.onboardingStatus === 'complete') return 'Onboarding complete';
  const step = s.onboardingStep;
  return step != null ? `Onboarding in progress · step ${step}` : 'Onboarding in progress';
}

export function adminBlockReasonLabel(s: AdminShopStatus): string {
  switch (s.blockReason) {
    case 'none':
      return 'None';
    case 'no_subscription':
      return 'No active subscription';
    case 'trial_expired':
      return 'Trial ended';
    case 'payment_method_required':
      return 'Payment method missing';
    case 'subscription_inactive':
      return 'Subscription inactive';
    case 'live_not_enabled':
      return 'Live answering off';
    case 'onboarding_incomplete':
      return 'Onboarding incomplete';
    case 'account_inactive':
      return 'Account inactive';
    case 'test_call_limit_reached':
      return 'Test call limit reached';
    default:
      return s.blockReason ?? 'Unknown';
  }
}

export function adminPhoneSetupLabel(s: AdminShopStatus): string {
  const mode = s.phoneSetupStatus;
  const ft = s.forwardingType;
  if (mode === 'forward') {
    return ft ? `Forwarding · ${ft}` : 'Forwarding';
  }
  if (mode === 'new_number') return 'New RingBooker number';
  return 'Phone setup unknown';
}

export function adminTrialCardLabel(s: AdminShopStatus): string {
  switch (s.trialStatus) {
    case 'trialing':
      return s.trialDaysLeft != null ? `Trialing · ${s.trialDaysLeft} days left` : 'Trialing';
    case 'trial_ended':
      return 'Trial ended';
    case 'not_applicable':
      return 'Not on trial';
    case 'none':
    default:
      return '—';
  }
}

/** Second line under business name on /admin/shops (compact). */
export function adminShopsListSummaryLine(s: AdminShopStatus): string {
  const parts: string[] = [];
  if (s.trialStatus === 'trialing') {
    parts.push(s.trialDaysLeft != null ? `Trialing · ${s.trialDaysLeft} days left` : 'Trialing');
  } else if (s.trialStatus === 'trial_ended') {
    parts.push('Trial ended');
  }
  parts.push(adminSubscriptionLabel(s));
  parts.push(adminPaymentMethodLabel(s));
  parts.push(adminLiveAnsweringLabel(s));
  if (s.onboardingStatus === 'incomplete') {
    parts.push(adminOnboardingLabel(s));
  }
  return parts.join(' · ');
}

export function adminAccountBadgeClass(s: AdminShopStatus): string {
  return s.accountStatus === 'active' ? 'tag green' : 'tag red';
}

export function adminSubscriptionBadgeClass(s: AdminShopStatus): string {
  const st = s.subscriptionStatus;
  if (!st) return 'tag gray';
  if (st === 'active') return 'tag green';
  if (st === 'trialing') return 'tag orange';
  if (st === 'past_due' || st === 'unpaid') return 'tag red';
  if (st === 'canceled' || st === 'trial_expired') return 'tag gray';
  return 'tag orange';
}

export function adminPaymentBadgeClass(s: AdminShopStatus): string {
  if (s.paymentMethodStatus === 'valid') return 'tag green';
  if (s.paymentMethodStatus === 'none' || s.paymentMethodStatus === 'failed') return 'tag orange';
  return 'tag gray';
}

export function adminLiveBadgeClass(s: AdminShopStatus): string {
  if (s.liveAnsweringStatus === 'enabled') return 'tag green';
  if (s.liveAnsweringStatus === 'disabled') return 'tag orange';
  return 'tag gray';
}

export function adminOnboardingBadgeClass(s: AdminShopStatus): string {
  return s.onboardingStatus === 'complete' ? 'tag green' : 'tag orange';
}
