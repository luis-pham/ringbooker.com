import type { BillingPaymentMethodStatus, BillingSubscription } from '@/src/backend/domain/types';

import { isBillingTrialStillValid } from '@/src/backend/services/billing/access';

/** Primary dashboard CTA while RingBooker is not answering live callers yet. */
export type GoLiveDashboardPrimaryCta =
  | 'add_payment_method'
  | 'set_up_call_forwarding'
  | 'test_forwarding_setup'
  | 'enable_live_answering';

/**
 * Resolves the next go-live action for the user dashboard banner.
 * Assumes setup wizard is complete (user is allowed on the dashboard).
 */
export function resolveGoLiveDashboardPrimaryCta(params: {
  liveCallsEnabled: boolean;
  subscription: BillingSubscription | null;
  paymentMethodStatus: BillingPaymentMethodStatus | undefined;
  hasForwardingNumber: boolean;
  forwardingSetupVerified: boolean;
  now: Date;
}): GoLiveDashboardPrimaryCta | null {
  if (params.liveCallsEnabled) return null;
  const sub = params.subscription;
  if (!sub) return 'add_payment_method';
  const activeLike = sub.status === 'active' || isBillingTrialStillValid(sub, params.now);
  if (!activeLike) return 'add_payment_method';
  if ((params.paymentMethodStatus ?? 'none') !== 'valid') return 'add_payment_method';
  if (!params.hasForwardingNumber) return 'set_up_call_forwarding';
  if (!params.forwardingSetupVerified) return 'test_forwarding_setup';
  return 'enable_live_answering';
}
