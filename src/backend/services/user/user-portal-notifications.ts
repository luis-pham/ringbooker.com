import type { BillingSubscription } from '@/src/backend/domain/types';
import type { ShopBillingAccess } from '@/src/backend/services/billing/access';
import { formatShopDate, getShopTimezone } from '@/src/shared/timezone';

export type UserPortalNotificationSeverity = 'info' | 'warn' | 'critical';

export type UserPortalNotificationDto = {
  id: string;
  severity: UserPortalNotificationSeverity;
  title: string;
  body?: string;
  href: string;
};

export type UserPortalNotificationsUsageInput = {
  nearCapturedCallerLimit: boolean;
  overCapturedCallerLimit: boolean;
  capturedCallersUsed: number;
  capturedCallersLimit: number | null;
} | null;

type UsageLite = UserPortalNotificationsUsageInput;

function fmtDate(iso: string | null | undefined, shopTimezone: string): string | null {
  if (!iso) return null;
  const formatted = formatShopDate(iso, shopTimezone);
  return formatted === 'Unknown' ? null : formatted;
}

function daysUntil(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Derived in-app alerts for the user portal (billing, renewal, usage).
 * Not a persisted inbox — safe to call on every page load.
 */
export function buildUserPortalNotifications(params: {
  access: ShopBillingAccess;
  subscription: BillingSubscription | null;
  usage: UsageLite;
  now: Date;
  shopTimezone?: string | null;
}): UserPortalNotificationDto[] {
  const { access, subscription, usage, now } = params;
  const shopTimezone = getShopTimezone({ timezone: params.shopTimezone });
  const out: UserPortalNotificationDto[] = [];
  const push = (n: UserPortalNotificationDto) => {
    if (!out.some((x) => x.id === n.id)) out.push(n);
  };

  const status = subscription?.status ?? access.subscriptionStatus;

  if (access.blockReason === 'commercial_approval_required') {
    push({
      id: 'commercial_approval',
      severity: 'info',
      title: 'Custom plan approval in progress',
      body: 'RingBooker will confirm before live answering is enabled.',
      href: '/contact?topic=implementation',
    });
  }

  const trialExpired = access.blockReason === 'trial_expired' || status === 'trial_expired';

  if (trialExpired) {
    push({
      id: 'trial_expired',
      severity: 'critical',
      title: 'Trial has ended',
      body: 'Choose a plan to continue using RingBooker.',
      href: '/user/billing',
    });
  }

  if (status === 'past_due' || status === 'unpaid') {
    push({
      id: 'billing_past_due',
      severity: 'critical',
      title: 'Payment required',
      body: 'Your subscription payment failed or is overdue. Update billing to avoid interruption.',
      href: '/user/billing',
    });
  }

  if (subscription?.paymentMethodStatus === 'failed') {
    push({
      id: 'payment_method_failed',
      severity: 'critical',
      title: 'Payment method failed',
      body: 'Your card or payment method needs attention.',
      href: '/user/billing',
    });
  }

  if (!trialExpired && status === 'trialing' && access.trialDaysRemaining !== null && access.trialDaysRemaining <= 7) {
    const d = access.trialDaysRemaining;
    push({
      id: 'trial_ending',
      severity: d <= 3 ? 'critical' : 'warn',
      title: d === 0 ? 'Trial ends today' : `Trial ends in ${d} day${d === 1 ? '' : 's'}`,
      body: subscription?.trialEndsAt ? `Trial end date: ${fmtDate(subscription.trialEndsAt, shopTimezone) ?? ''}.` : undefined,
      href: '/user/billing',
    });
  }

  if (subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    const dt = fmtDate(subscription.currentPeriodEnd, shopTimezone);
    push({
      id: 'cancel_at_period_end',
      severity: 'info',
      title: 'Subscription ending',
      body: dt ? `Access continues until ${dt}.` : undefined,
      href: '/user/billing',
    });
  }

  if (
    status === 'active' &&
    subscription?.currentPeriodEnd &&
    !subscription.cancelAtPeriodEnd
  ) {
    const days = daysUntil(subscription.currentPeriodEnd, now);
    if (days !== null && days >= 0 && days <= 7) {
      const dt = fmtDate(subscription.currentPeriodEnd, shopTimezone);
      push({
        id: 'renewal_soon',
        severity: 'info',
        title: 'Upcoming renewal',
        body: dt ? `Next billing cycle: ${dt}.` : undefined,
        href: '/user/billing',
      });
    }
  }

  const paymentMethodStatus = access.paymentMethodStatus ?? 'unknown';
  const paymentMethodNotVerified =
    paymentMethodStatus !== 'valid' &&
    ['none', 'unknown', 'pending', 'failed'].includes(paymentMethodStatus);
  const billingNeedsVerifiedPayment =
    access.blockReason === 'payment_method_required' ||
    (paymentMethodNotVerified && (status === 'trialing' || status === 'incomplete' || status === 'unknown'));

  if (!trialExpired && billingNeedsVerifiedPayment) {
    push({
      id: 'payment_method_required',
      severity: paymentMethodStatus === 'failed' ? 'critical' : 'warn',
      title: paymentMethodStatus === 'pending' || paymentMethodStatus === 'unknown'
        ? 'Payment method not verified yet'
        : 'Add a payment method',
      body:
        paymentMethodStatus === 'pending' || paymentMethodStatus === 'unknown'
          ? 'Paddle has not confirmed a valid payment method yet. Live answering stays off until billing is verified.'
          : 'Required to go live or continue after trial.',
      href: '/user/billing',
    });
  }

  if (usage?.overCapturedCallerLimit) {
    push({
      id: 'usage_captured_over',
      severity: 'critical',
      title: 'Captured caller limit reached',
      body: 'Upgrade or adjust your plan for more monthly coverage.',
      href: '/user/billing',
    });
  } else if (usage?.nearCapturedCallerLimit) {
    push({
      id: 'usage_captured_near',
      severity: 'warn',
      title: 'Approaching captured caller limit',
      body:
        usage.capturedCallersLimit != null
          ? `${usage.capturedCallersUsed} / ${usage.capturedCallersLimit} captured callers this period.`
          : `${usage.capturedCallersUsed} captured callers this period.`,
      href: '/user/billing',
    });
  }

  if (status === 'paused') {
    push({
      id: 'subscription_paused',
      severity: 'warn',
      title: 'Subscription paused',
      body: 'Check Billing for status and next steps.',
      href: '/user/billing',
    });
  }

  const rank: Record<UserPortalNotificationSeverity, number> = { critical: 0, warn: 1, info: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return out;
}
