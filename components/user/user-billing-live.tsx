'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userBillingScripts, userBillingStyles } from '@/components/user/user-billing';
import { BILLING_PLAN_CARD_FEATURES } from '@/components/user/user-plan-ux-copy';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { UserPortalPageContent } from '@/components/user/user-portal-page-content';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
import {
  CUSTOM_MANAGED_SETUP_ITEMS,
  ENTERPRISE_PENDING_BILLING_STATUS_LINES,
} from '@/components/user/user-plan-ux-copy';
import { formatShopDate, getShopTimezone } from '@/src/shared/timezone';
import type { GoLiveStatusResponse } from '@/components/user/go-live-forwarding-panel';

type ShopPlan = 'starter' | 'professional' | 'enterprise';
type BillingProvider = 'paddle' | 'stripe' | 'manual';
type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused'
  | 'trial_expired'
  | 'unpaid'
  | 'unknown';

export type UserBillingResponse = {
  ok: boolean;
  shop?: {
    id: string;
    name: string;
    plan: ShopPlan;
    active: boolean;
    timezone?: string | null;
  };
  billing?: {
    provider: BillingProvider;
    customer: {
      providerCustomerId: string;
      email?: string | null;
    } | null;
    subscription: {
      plan: ShopPlan;
      status: BillingSubscriptionStatus;
      provider?: BillingProvider;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
      amount: number;
      amountCents?: number | null;
      currency: string;
      interval: 'month' | 'year';
      currentPeriodStart?: string | null;
      currentPeriodEnd?: string | null;
      trialStartedAt?: string | null;
      trialEndsAt?: string | null;
      paymentMethodStatus?: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
      cancelAtPeriodEnd: boolean;
      createdAt?: string | null;
    } | null;
    planLabel?: string;
    formattedPrice?: string;
    trialDaysRemaining?: number | null;
    paymentMethodStatus?: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
    hasPaymentMethod?: boolean;
    liveCallsEnabled?: boolean;
    canTestCall?: boolean;
    canGoLive?: boolean;
    canReceiveLiveCalls?: boolean;
    blockReason?: string;
    commercialGoLiveApproved?: boolean;
    commercialApprovalRequired?: boolean;
    requiresPaymentMethodBeforeGoLive?: boolean;
    trialNoChargeUntilEndVerified?: boolean;
    checkoutAvailable?: boolean;
    checkoutDisabledReason?: string | null;
    availableBillingIntervals?: Array<'monthly' | 'annual'>;
    manageBillingAvailable?: boolean;
    manageBillingDisabledReason?: string | null;
    canViewInvoicesViaPortal?: boolean;
    canUpdatePaymentMethodViaPortal?: boolean;
    canCancelViaPortal?: boolean;
    selfServeUpgradeAvailable?: boolean;
    upgradeDisabledReason?: string | null;
    pendingPlanUpgrade?: {
      targetPlan: ShopPlan | null;
      billingInterval: 'monthly' | 'annual' | null;
      requestedAt: string | null;
    } | null;
    billingHistoryLabel?: string;
    forwardingNumber?: string | null;
    usage?: {
      capturedCallersUsed: number;
      capturedCallersLimit: number | null;
      capturedCallerUsagePercent: number | null;
      voiceMinutesSoftLimit: number | null;
      nearCapturedCallerLimit: boolean;
      overCapturedCallerLimit: boolean;
    } | null;
  };
  error?: string;
};

type BillingTransactionRecord = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  type: 'payment' | 'invoice' | 'refund' | 'credit' | 'unknown';
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  receiptUrl?: string;
};

export type BillingTransactionsResponse = {
  ok: boolean;
  available?: boolean;
  transactions?: BillingTransactionRecord[];
  message?: string | null;
  reason?: string;
  error?: string;
};

type OverageChargeRecord = {
  id: string;
  periodStart: string;
  periodEnd: string;
  includedCallers: number;
  capturedCallers: number;
  overageCallers: number;
  rateCents: number;
  amountCents: number;
  status: 'pending' | 'charged' | 'failed' | 'skipped';
  paddleTransactionId?: string | null;
  createdAt?: string | null;
};

type OverageChargesResponse = {
  ok: boolean;
  charges?: OverageChargeRecord[];
  error?: string;
};

type BillingSubscriptionRow = NonNullable<NonNullable<UserBillingResponse['billing']>['subscription']>;

type BillingPlansCatalogEntry = {
  key: ShopPlan;
  name: string;
  monthlyPrice?: number;
  annualPrice?: number;
  priceLabel?: string;
  description: string;
  features: string[];
  badge?: string;
  ctaLabel: string;
  ctaVariant: 'active' | 'outline-purple' | 'ghost';
};

/** Marketing / UX catalog — amounts for display; subscription charges follow Paddle. */
const BILLING_PLANS_CATALOG: BillingPlansCatalogEntry[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: 79,
    annualPrice: 63,
    description: 'Answer calls and capture bookings.',
    features: BILLING_PLAN_CARD_FEATURES.starter,
    ctaLabel: 'Current plan',
    ctaVariant: 'active',
  },
  {
    key: 'professional',
    name: 'Professional',
    monthlyPrice: 149,
    annualPrice: 119,
    description: 'Adds SMS, caller memory, bilingual & owner transfer.',
    badge: 'Popular',
    features: BILLING_PLAN_CARD_FEATURES.professional,
    ctaLabel: 'Upgrade to Pro',
    ctaVariant: 'outline-purple',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceLabel: 'Custom',
    description: 'Multi-location, high volume, custom routing.',
    features: BILLING_PLAN_CARD_FEATURES.enterprise,
    ctaLabel: 'Talk to sales',
    ctaVariant: 'ghost',
  },
];

const BILLING_USAGE_FAQ = [
  {
    question: 'What counts as a captured call?',
    answer:
      'A captured call is any call where our AI successfully engaged with your caller — answering a question, capturing a booking request, handling a reschedule, or taking down their details for follow-up. Missed calls, wrong numbers, and calls that ended before the AI could respond do not count.',
  },
  {
    question: 'What happens when I reach my plan limit?',
    answer:
      "You can continue receiving calls beyond your limit. Each additional captured call is billed at $0.75. You'll receive an email alert at 80% usage and again when you reach your limit so there are no surprises.",
  },
  {
    question: 'When does my usage reset?',
    answer:
      'Your usage resets at the start of each billing period, not on the 1st of every calendar month. Your billing period start date is shown on this page.',
  },
  {
    question: 'How is the overage charge applied?',
    answer:
      'Overage charges are calculated at the end of your billing period and applied as a one-time charge at $0.75 per captured call over your plan limit.',
  },
  {
    question: 'Can I upgrade my plan to avoid overage charges?',
    answer:
      'Yes. Upgrading to a higher plan takes effect immediately and your quota resets to the new plan limit for the remainder of your billing period.',
  },
  {
    question: 'What is the call duration limit?',
    answer:
      'To ensure fair usage, calls are limited to 6 minutes on the Starter plan and 8 minutes on the Professional plan. Most salon calls are completed well within this window. If a call reaches the limit, the AI will politely wrap up and offer to take the caller\'s information for follow-up.',
  },
] as const;

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatMoneyCents(amountCents: number, currency = 'USD') {
  return formatMoney(amountCents / 100, currency);
}

function formatBillingDate(value: string | null | undefined, shopTimezone: string) {
  if (!value) return 'Not scheduled';
  return formatShopDate(value, shopTimezone);
}

function planDisplayName(plan: ShopPlan) {
  return plan[0].toUpperCase() + plan.slice(1);
}

function subscriptionStatusTone(status: BillingSubscriptionStatus | undefined, hasSubscription: boolean): 'green' | 'purple' | 'orange' | 'red' | 'gray' {
  if (!hasSubscription) return 'gray';
  switch (status) {
    case 'active':
      return 'green';
    case 'trialing':
      return 'purple';
    case 'past_due':
    case 'unpaid':
      return 'red';
    case 'canceled':
    case 'paused':
    case 'trial_expired':
    case 'incomplete':
      return 'orange';
    default:
      return 'orange';
  }
}

function subscriptionCardValue(subscription: BillingSubscriptionRow | null) {
  if (!subscription) return 'No active subscription';
  switch (subscription.status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past due';
    case 'canceled':
      return 'Canceled';
    case 'paused':
      return 'Paused';
    case 'trial_expired':
      return 'Trial ended';
    case 'unpaid':
      return 'Payment overdue';
    case 'incomplete':
      return 'Payment incomplete';
    case 'unknown':
    default:
      return 'Not available';
  }
}

function subscriptionCardMeta(
  subscription: BillingSubscriptionRow | null,
  trialDaysRemaining: number | null | undefined,
  shopTimezone: string,
) {
  if (!subscription) return 'Start a subscription to unlock invoices and renewals.';
  if (subscription.status === 'trialing' && typeof trialDaysRemaining === 'number') {
    return `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left in trial`;
  }
  if (subscription.status === 'trialing') return 'Trial in progress';
  if (subscription.currentPeriodEnd) return `Renews around ${formatBillingDate(subscription.currentPeriodEnd, shopTimezone)}`;
  return subscription.trialEndsAt ? `Trial ends ${formatBillingDate(subscription.trialEndsAt, shopTimezone)}` : 'Subscription details update after billing.';
}

function paymentCardValue(pm: 'none' | 'pending' | 'valid' | 'failed' | 'unknown' | undefined) {
  switch (pm) {
    case 'valid':
      return 'On file';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Needs attention';
    case 'none':
    default:
      return 'Not added';
  }
}

function paymentCardMeta(pm: 'none' | 'pending' | 'valid' | 'failed' | 'unknown' | undefined) {
  if (pm === 'valid') return 'Ready for renewals and go-live checks';
  return 'Required before live answering trial';
}

function liveAnsweringValue(enabled: boolean | undefined) {
  if (enabled === true) return 'Enabled';
  if (enabled === false) return 'Disabled';
  return 'Not available';
}

function liveAnsweringMeta(params: {
  enabled: boolean | undefined;
  subscription: BillingSubscriptionRow | null;
  forwardingState: string;
  hasPaymentMethod: boolean | undefined;
}) {
  if (params.enabled === true) return 'Live answering is active';
  if (!params.subscription) return 'Start trial before live answering';
  if (['past_due', 'paused', 'canceled', 'unpaid', 'trial_expired'].includes(params.subscription.status)) {
    return 'Resolve billing issue to restore';
  }
  if (params.subscription.status === 'trialing') {
    if (params.forwardingState !== 'verified') return 'Verify call forwarding to go live';
    if (!params.hasPaymentMethod) return 'Add payment method to go live';
    return 'Turn on go-live when you are ready';
  }
  return 'Turn on go-live when you are ready';
}

function getStatusTone(status: BillingSubscriptionStatus | undefined) {
  switch (status) {
    case 'active':
      return 'green';
    case 'trialing':
      return 'purple';
    case 'past_due':
      return 'orange';
    case 'canceled':
    case 'paused':
    case 'incomplete':
      return 'red';
    default:
      return 'orange';
  }
}

function getStatusLabel(status: BillingSubscriptionStatus | undefined) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trialing';
    case 'past_due':
      return 'Past due';
    case 'canceled':
      return 'Canceled';
    case 'paused':
      return 'Paused';
    case 'trial_expired':
      return 'Trial ended';
    case 'unpaid':
      return 'Payment overdue';
    case 'incomplete':
      return 'Incomplete';
    default:
      return 'Pending';
  }
}

function transactionStatusTone(status: string): 'green' | 'purple' | 'orange' | 'red' | 'gray' {
  const normalized = status.toLowerCase();
  if (['completed', 'paid', 'billed'].includes(normalized)) return 'green';
  if (['ready', 'draft', 'pending', 'past_due'].includes(normalized)) return 'orange';
  if (['canceled', 'cancelled', 'failed'].includes(normalized)) return 'red';
  if (normalized.includes('refund') || normalized.includes('credit')) return 'purple';
  return 'gray';
}

type BillingUiState =
  | 'billing_not_configured'
  | 'setup_allowed_no_payment'
  | 'payment_method_required'
  | 'checkout_pending'
  | 'trialing_valid'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled';

function resolveBillingUiState(params: {
  subscription: BillingSubscriptionRow | null;
  hasPaymentMethod: boolean;
  checkoutPlan: ShopPlan | null;
}): BillingUiState {
  if (params.checkoutPlan) return 'checkout_pending';
  if (!params.subscription) return 'billing_not_configured';
  if (params.subscription.status === 'past_due') return 'past_due';
  if (params.subscription.status === 'unpaid') return 'past_due';
  if (params.subscription.status === 'paused') return 'paused';
  if (params.subscription.status === 'canceled') return 'canceled';
  if (params.subscription.status === 'trial_expired') return 'canceled';
  if (params.subscription.status === 'trialing' && params.hasPaymentMethod) return 'trialing_valid';
  if (params.subscription.status === 'active' && params.hasPaymentMethod) return 'active';
  return params.hasPaymentMethod ? 'setup_allowed_no_payment' : 'payment_method_required';
}

function billingUiCopy(state: BillingUiState) {
  switch (state) {
    case 'billing_not_configured':
      return {
        title: 'Start your 14-day trial',
        body: 'Add your card to start your 14-day free trial and enable live answering.',
      };
    case 'setup_allowed_no_payment':
      return {
        title: 'Start your 14-day trial',
        body: 'Add your card to start your 14-day free trial and enable live answering.',
      };
    case 'payment_method_required':
      return {
        title: 'Start your 14-day trial',
        body: 'Add your card to start your 14-day free trial and enable live answering.',
      };
    case 'checkout_pending':
      return {
        title: 'Payment setup pending',
        body: 'We are waiting for billing to confirm your trial. This usually updates within a minute.',
      };
    case 'trialing_valid':
      return {
        title: 'Billing is active',
        body: 'Update your payment method, view invoices, or manage your subscription.',
      };
    case 'active':
      return {
        title: 'Billing is active',
        body: 'Update your payment method, view invoices, or manage your subscription.',
      };
    case 'past_due':
      return {
        title: 'Billing issue',
        body: 'Update your payment method to restore live answering.',
      };
    case 'paused':
      return {
        title: 'Live answering is paused',
        body: 'Your billing status needs attention. RingBooker will not answer forwarded live calls until billing is resolved.',
      };
    case 'canceled':
      return {
        title: 'Subscription canceled',
        body: 'Live answering is paused. Restart billing when you are ready to go live again.',
      };
  }
}

type BillingSectionTab = 'overview' | 'plans' | 'history';
type BillingNotice = 'checkout_success' | 'checkout_cancelled' | 'manage_returned' | null;

function checkoutUnavailableCopy(reason?: string | null): string {
  if (reason === 'billing_checkout_disabled') {
    return 'Payment setup is temporarily unavailable. Setup and test calls still work; contact support if you are ready to go live.';
  }
  return 'Payment setup is not available for this account yet. Contact support if you are ready to go live.';
}

function manageBillingUnavailableCopy(reason?: string | null): string {
  if (reason === 'billing_manage_disabled') {
    return 'Billing management is temporarily unavailable. Contact support if you need help updating payment details or managing your subscription.';
  }
  return 'Billing management is not available right now. Contact support or try again later.';
}

export function UserBillingLive({
  initialData = null,
  initialTransactions = null,
  initialGoLiveStatus = null,
}: {
  initialData?: UserBillingResponse | null;
  initialTransactions?: BillingTransactionsResponse | null;
  initialGoLiveStatus?: GoLiveStatusResponse | null;
}) {
  const { workspace, setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<UserBillingResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [checkoutPlan, setCheckoutPlan] = useState<ShopPlan | null>(null);
  const [managingBilling, setManagingBilling] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<ShopPlan | null>(null);
  const [upgradePendingMessage, setUpgradePendingMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingNotice, setBillingNotice] = useState<BillingNotice>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [billingTab, setBillingTab] = useState<BillingSectionTab>('overview');
  const [transactionsState, setTransactionsState] = useState<{
    loading: boolean;
    available: boolean;
    rows: BillingTransactionRecord[];
    message: string | null;
  }>(() => ({
    loading: false,
    available: initialTransactions?.ok === true && initialTransactions.available === true,
    rows: initialTransactions?.ok === true && Array.isArray(initialTransactions.transactions) ? initialTransactions.transactions : [],
    message: initialTransactions?.message ?? null,
  }));
  const [overageChargesState, setOverageChargesState] = useState<{
    loading: boolean;
    rows: OverageChargeRecord[];
    message: string | null;
  }>({
    loading: false,
    rows: [],
    message: null,
  });

  const [goLiveStatus, setGoLiveStatus] = useState<GoLiveStatusResponse | null>(initialGoLiveStatus ?? null);

  const refreshGoLiveStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/backend/user/go-live/status', { credentials: 'include' });
      const body = (await response.json()) as GoLiveStatusResponse;
      if (response.ok && body.ok) setGoLiveStatus(body);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshBilling = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch('/api/backend/user/billing', { signal: controller.signal });
    } finally {
      window.clearTimeout(timeout);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('invalid_billing_response');
    }
    const body = (await response.json()) as UserBillingResponse;
    setData(body);
    if (body.ok && body.shop) {
      setWorkspace({
        shopName: body.shop.name,
        plan: body.shop.plan,
        active: body.shop.active,
      });
    }
    void refreshGoLiveStatus();
  }, [setWorkspace, refreshGoLiveStatus]);

  useEffect(() => {
    if (initialData) return;
    let active = true;
    void refreshBilling()
      .catch(() => {
        if (active) {
          setData({ ok: false, error: 'network_error' });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialData, refreshBilling]);

  useEffect(() => {
    if (initialGoLiveStatus?.ok) setGoLiveStatus(initialGoLiveStatus);
  }, [initialGoLiveStatus]);

  useEffect(() => {
    if (!data?.ok || !data.shop) return;
    setWorkspace({
      shopName: data.shop.name,
      plan: data.shop.plan,
      active: data.shop.active,
    });
  }, [data?.ok, data?.shop, setWorkspace]);

  useEffect(() => {
    if (initialTransactions) return;
    if (!data?.ok || !data.billing) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setTransactionsState((current) => ({ ...current, loading: true }));
    void fetch('/api/backend/user/billing/transactions', { signal: controller.signal })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) throw new Error('invalid_transactions_response');
        const body = (await response.json()) as BillingTransactionsResponse;
        if (!active) return;
        setTransactionsState({
          loading: false,
          available: body.ok === true && body.available === true,
          rows: body.ok === true && Array.isArray(body.transactions) ? body.transactions : [],
          message:
            body.message ??
            (body.ok === true
              ? null
              : 'We could not load Paddle payment history right now. You can still view official invoices and receipts in Manage billing.'),
        });
      })
      .catch(() => {
        if (!active) return;
        setTransactionsState({
          loading: false,
          available: false,
          rows: [],
          message: 'We could not load Paddle payment history right now. You can still view official invoices and receipts in Manage billing.',
        });
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [data?.ok, data?.billing, initialTransactions]);

  useEffect(() => {
    if (!data?.ok || !data.billing) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setOverageChargesState((current) => ({ ...current, loading: true }));
    void fetch('/api/backend/user/billing/overage-charges', { signal: controller.signal })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) throw new Error('invalid_overage_charges_response');
        const body = (await response.json()) as OverageChargesResponse;
        if (!active) return;
        setOverageChargesState({
          loading: false,
          rows: body.ok === true && Array.isArray(body.charges) ? body.charges : [],
          message: body.ok === true ? null : 'We could not load overage history right now.',
        });
      })
      .catch(() => {
        if (!active) return;
        setOverageChargesState({
          loading: false,
          rows: [],
          message: 'We could not load overage history right now.',
        });
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [data?.ok, data?.billing]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#go-live-forwarding') {
      window.location.replace(`${window.location.origin}/user/go-live#go-live-forwarding`);
    }
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    const billing = new URLSearchParams(window.location.search).get('billing');
    if (checkout === 'success') {
      setBillingNotice('checkout_success');
    } else if (checkout === 'cancelled' || checkout === 'canceled') {
      setBillingNotice('checkout_cancelled');
    } else if (billing === 'manage_returned') {
      setBillingNotice('manage_returned');
    }
  }, []);

  const subscription = data?.billing?.subscription ?? null;
  const currentPlan = subscription?.plan ?? data?.shop?.plan ?? 'starter';
  const paymentMethodStatus = data?.billing?.paymentMethodStatus ?? subscription?.paymentMethodStatus ?? 'none';
  const hasPaymentMethod =
    data?.billing?.hasPaymentMethod === true &&
    !['past_due', 'paused', 'canceled'].includes(subscription?.status ?? '');
  const headerPaymentMethodStatus = (() => {
    if (['past_due', 'paused', 'canceled'].includes(subscription?.status ?? '')) {
      if (paymentMethodStatus === 'valid') return 'failed';
      return paymentMethodStatus;
    }
    return paymentMethodStatus;
  })();
  const liveEnabled = data?.billing?.liveCallsEnabled;
  const catalog = useMemo(() => BILLING_PLANS_CATALOG.find((p) => p.key === currentPlan) ?? BILLING_PLANS_CATALOG[0], [currentPlan]);
  const shopTimezone = getShopTimezone(data?.shop);

  const billingHistory = useMemo(() => {
    if (!subscription) return [];
    const rows = [];
    const periodStart = subscription.currentPeriodStart ?? subscription.trialStartedAt ?? subscription.createdAt ?? null;
    const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt ?? null;
    const isTrial = subscription.status === 'trialing';
    rows.push({
      date: formatBillingDate(periodStart, shopTimezone),
      description: isTrial ? `${planDisplayName(subscription.plan)} trial started` : `${planDisplayName(subscription.plan)} plan`,
      amount: subscription.amount > 0 ? formatMoney(subscription.amount, subscription.currency) : '$0',
      status: getStatusLabel(subscription.status),
      tone: getStatusTone(subscription.status),
    });
    if (periodEnd) {
      rows.push({
        date: formatBillingDate(periodEnd, shopTimezone),
        description: isTrial ? 'Trial ends' : 'Next billing date',
        amount: subscription.amount > 0 ? formatMoney(subscription.amount, subscription.currency) : '$0',
        status: subscription.cancelAtPeriodEnd ? 'Cancel scheduled' : 'Scheduled',
        tone: subscription.cancelAtPeriodEnd ? 'orange' : 'green',
      });
    }
    return rows;
  }, [subscription]);

  const currentPlanMeta = useMemo(() => {
    if (currentPlan === 'enterprise') return 'Custom pricing';
    if (subscription && subscription.amount > 0) {
      return `${formatMoney(subscription.amount, subscription.currency)}/${subscription.interval === 'year' ? 'yr' : 'mo'}`;
    }
    return catalog.monthlyPrice != null ? `$${catalog.monthlyPrice}/mo` : catalog.priceLabel ?? '—';
  }, [currentPlan, subscription, catalog.monthlyPrice, catalog.priceLabel]);

  const enterpriseApprovalPending = currentPlan === 'enterprise' && data?.billing?.commercialApprovalRequired === true;
  const isEnterprisePlan = currentPlan === 'enterprise';
  const billing = data?.billing ?? null;
  const usage = billing?.usage ?? null;
  const checkoutAvailable = data?.billing?.checkoutAvailable === true;
  const manageBillingAvailable = data?.billing?.manageBillingAvailable === true;
  const selfServeUpgradeAvailable = data?.billing?.selfServeUpgradeAvailable === true;
  const pendingPlanUpgrade = data?.billing?.pendingPlanUpgrade ?? null;
  const planChangePending =
    upgradePendingMessage != null ||
    (pendingPlanUpgrade?.targetPlan != null && pendingPlanUpgrade.targetPlan !== currentPlan);
  const availableBillingIntervals = data?.billing?.availableBillingIntervals ?? ['monthly'];
  const canChooseAnnual = checkoutAvailable && availableBillingIntervals.includes('annual');
  const effectiveBillingInterval =
    billingInterval === 'annual' && canChooseAnnual ? 'annual' : 'monthly';
  const billingState = resolveBillingUiState({ subscription, hasPaymentMethod, checkoutPlan });
  const billingCopy = billingUiCopy(billingState);
  const subscriptionBillingBlocked =
    subscription != null && ['past_due', 'paused', 'canceled'].includes(subscription.status);
  const shouldUseReactivateCheckout =
    subscription != null &&
    (['trial_expired', 'paused', 'canceled', 'past_due', 'unpaid'].includes(subscription.status) ||
      (subscription.status === 'unknown' &&
        (subscription.provider === 'paddle' || data?.billing?.provider === 'paddle') &&
        Boolean(subscription.providerCustomerId?.trim() || subscription.providerSubscriptionId?.trim() || data?.billing?.customer?.providerCustomerId?.trim())));
  const forwardingState = goLiveStatus?.status?.forwarding?.status ?? 'none';
  const showTrialCtaRow =
    Boolean(data?.billing) &&
    !isEnterprisePlan &&
    billingState !== 'trialing_valid' &&
    billingState !== 'active' &&
    billingState !== 'checkout_pending';
  const showForwardingNudge =
    Boolean(data?.billing) &&
    !isEnterprisePlan &&
    forwardingState !== 'verified' &&
    billingState !== 'active' &&
    billingState !== 'checkout_pending';
  // Banner suppression flags based on priority order.
  const hasLoadError = !loading && !data?.ok;
  const hasCheckoutNotice = ['checkout_success', 'checkout_cancelled', 'manage_returned'].includes(billingNotice ?? '');
  const hasBillingIssue = ['past_due', 'paused', 'canceled'].includes(billingState) && !isEnterprisePlan;
  const hasCheckoutError = !!checkoutError;

  const showForwardingNudgeFinal = showForwardingNudge && !hasBillingIssue && !hasCheckoutNotice && !hasLoadError;
  const showTrialCtaRowFinal =
    showTrialCtaRow &&
    !hasBillingIssue &&
    !hasCheckoutNotice &&
    !planChangePending &&
    !hasCheckoutError &&
    !showForwardingNudgeFinal &&
    !hasLoadError;
  const showPlanChangePending = planChangePending && !hasBillingIssue && !hasLoadError;
  const showBillingIssueBanner = hasBillingIssue && !hasLoadError;
  const showCheckoutNotice = hasCheckoutNotice && !hasLoadError && !hasBillingIssue;
  const showCheckoutError = hasCheckoutError;

  const selectBillingTab = useCallback((tab: BillingSectionTab) => {
    setBillingTab(tab);
    if (typeof window === 'undefined') return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  async function openCheckout(plan: ShopPlan) {
    if (!checkoutAvailable) {
      setCheckoutError(checkoutUnavailableCopy(data?.billing?.checkoutDisabledReason));
      return;
    }
    setCheckoutPlan(plan);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/backend/user/billing/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ plan, billing_interval: effectiveBillingInterval }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        checkoutUrl?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !body.ok || !body.checkoutUrl) {
        throw new Error(body.message ?? body.error ?? 'Payment setup could not start.');
      }
      window.location.href = body.checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'checkout_failed');
    } finally {
      setCheckoutPlan(null);
    }
  }

  async function openReactivateCheckout() {
    if (!checkoutAvailable) {
      setCheckoutError(checkoutUnavailableCopy(data?.billing?.checkoutDisabledReason));
      return;
    }
    setCheckoutPlan(currentPlan);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/backend/user/billing/reactivate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      const body = (await response.json()) as {
        ok: boolean;
        checkoutUrl?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !body.ok || !body.checkoutUrl) {
        throw new Error(body.message ?? body.error ?? 'Payment setup could not start.');
      }
      window.location.href = body.checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'checkout_failed');
    } finally {
      setCheckoutPlan(null);
    }
  }

  async function openStartOrReactivateCheckout(plan: ShopPlan) {
    if (shouldUseReactivateCheckout) {
      await openReactivateCheckout();
      return;
    }
    await openCheckout(plan);
  }

  async function openManageBilling() {
    if (!manageBillingAvailable) {
      setCheckoutError(manageBillingUnavailableCopy(data?.billing?.manageBillingDisabledReason));
      return;
    }
    setManagingBilling(true);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/backend/user/billing/manage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json()) as {
        ok: boolean;
        manageUrl?: string;
        error?: string;
        message?: string;
      };
      if (!response.ok || !body.ok || !body.manageUrl) {
        throw new Error(body.message ?? body.error ?? 'Billing management could not open.');
      }
      window.location.href = body.manageUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'billing_management_failed');
    } finally {
      setManagingBilling(false);
    }
  }

  async function changePlan(targetPlan: Extract<ShopPlan, 'starter' | 'professional'>) {
    if (!selfServeUpgradeAvailable) {
      setCheckoutError('Plan change is not available right now. Resolve billing or contact support.');
      return;
    }
    setUpgradingPlan(targetPlan);
    setCheckoutError(null);
    setUpgradePendingMessage(null);
    try {
      const response = await fetch('/api/backend/user/billing/upgrade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_plan: targetPlan,
          billing_interval: effectiveBillingInterval,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        status?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok || !body.ok) {
        throw new Error(body.message ?? body.error ?? 'Plan change could not start.');
      }
      setUpgradePendingMessage(
        body.message ??
          (targetPlan === 'starter'
            ? 'Your change to Starter is being processed. Your plan will update after billing is confirmed.'
            : 'Your upgrade is being processed. Professional features will unlock after billing is confirmed.'),
      );
      await refreshBilling().catch(() => undefined);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'billing_plan_change_failed');
    } finally {
      setUpgradingPlan(null);
    }
  }

  const subTagClass = `tag ${subscriptionStatusTone(subscription?.status, Boolean(subscription))}`;

  return (
    <UserLayout styles={userBillingStyles} scripts={userBillingScripts} scriptPrefix="user-billing-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="billing" />
          <main className="main">
            <UserPortalTopbar
              title="Billing"
              subtitle="View usage, plans, and billing activity. Set up forwarding under Go Live."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />

            <UserPortalPageContent pageClass="page-billing">
            {hasLoadError ? (
              <section className="card">
                <h3>Unable to load billing</h3>
                <p className="sub">{data?.error ?? 'unknown_error'}</p>
              </section>
            ) : null}
                <section className="billing-status-grid" aria-label="Billing summary">
                  <div className="billing-status-card">
                    <div className="bst-label">Current plan</div>
                    <div className="bst-value">{planDisplayName(currentPlan)}</div>
                    <div className="bst-meta">{currentPlanMeta}</div>
                  </div>
                  <div className="billing-status-card">
                    <div className="bst-label">Subscription</div>
                    <div className="bst-value">
                      <span className={subTagClass}>{subscriptionCardValue(subscription)}</span>
                    </div>
                    <div className="bst-meta">{subscriptionCardMeta(subscription, data?.billing?.trialDaysRemaining, shopTimezone)}</div>
                  </div>
                  <div className="billing-status-card">
                    <div className="bst-label">Payment method</div>
                    <div className="bst-value">{paymentCardValue(headerPaymentMethodStatus)}</div>
                    <div className="bst-meta">{paymentCardMeta(headerPaymentMethodStatus)}</div>
                  </div>
                  <div className="billing-status-card">
                    <div className="bst-label">Live answering</div>
                    <div className="bst-value">{liveAnsweringValue(liveEnabled)}</div>
                    <div className="bst-meta">{liveAnsweringMeta({ enabled: liveEnabled, subscription, forwardingState, hasPaymentMethod })}</div>
                  </div>
                </section>

                {showCheckoutNotice ? (
                  billingNotice === 'checkout_success' ? (
                    <section className="billing-alert-strip success">
                      <p>
                        <strong>{forwardingState === 'verified' ? 'Payment confirmed — switch on live answering now!' : 'Payment confirmed — verify forwarding to go live.'}</strong>
                      </p>
                      <a className="btn purple" href="/user/go-live#go-live-forwarding">
                        {forwardingState === 'verified' ? 'Switch it on →' : 'Verify forwarding →'}
                      </a>
                    </section>
                  ) : billingNotice === 'checkout_cancelled' ? (
                    <section className="billing-alert-strip">
                      <p>
                        <strong>Checkout was cancelled.</strong> Your live answering trial was not started. Setup and test calls still work.
                      </p>
                      {checkoutAvailable ? (
                        <button type="button" className="btn user-save" disabled={checkoutPlan !== null} onClick={() => void openStartOrReactivateCheckout(currentPlan)}>
                          {checkoutPlan ? 'Starting…' : 'Try again'}
                        </button>
                      ) : null}
                    </section>
                  ) : billingNotice === 'manage_returned' ? (
                    <section className="billing-alert-strip info">
                      <p>
                        <strong>Billing management closed.</strong> Changes made in billing management may take a minute to appear here.
                      </p>
                      <button type="button" className="btn" onClick={() => void refreshBilling()}>
                        Refresh status
                      </button>
                    </section>
                  ) : null
                ) : null}

                {showPlanChangePending ? (
                  <section className="billing-alert-strip info">
                    <p>
                      <strong>Plan change pending.</strong>{' '}
                      {upgradePendingMessage ??
                        (pendingPlanUpgrade?.targetPlan === 'starter'
                          ? 'Your change to Starter is being processed. Your plan will update after billing confirms the change.'
                          : 'Your upgrade is being processed. Professional features will unlock after billing confirms the change.')}
                    </p>
                    <button type="button" className="btn" onClick={() => void refreshBilling()}>
                      Refresh status
                    </button>
                  </section>
                ) : null}

                {showForwardingNudgeFinal ? (
                  <section className="billing-alert-strip info" aria-label="Complete forwarding setup">
                    <p style={{ margin: 0 }}>
                      <strong>{forwardingState === 'configured' ? 'One more step after this — verify your call forwarding to go live.' : 'Set up call forwarding to continue.'}</strong>{' '}
                      {forwardingState === 'configured'
                        ? 'It only takes 30 seconds. Call your business number from another phone.'
                        : 'Forward missed calls to RingBooker first, then return here to start your 14-day trial.'}
                    </p>
                    <a className="btn user-save" href="/user/go-live#go-live-forwarding">
                      {forwardingState === 'configured' ? 'How to verify →' : 'Set up forwarding →'}
                    </a>
                  </section>
                ) : null}

                {showTrialCtaRowFinal ? (
                  <section className="billing-trial-cta" aria-label="Start trial">
                    <div className="billing-trial-cta__copy">
                      <h3>Start your 14-day free trial</h3>
                      <p>
                        No charge today · RingBooker answers live calls once your trial is active. Prices exclude applicable taxes.
                      </p>
                    </div>
                    {checkoutAvailable && availableBillingIntervals.length > 1 ? (
                      <div className="billing-trial-cta__toggle">
                        <div className="billing-cycle-pill" role="group" aria-label="Billing cycle">
                          <button
                            type="button"
                            data-active={effectiveBillingInterval === 'monthly'}
                            onClick={() => setBillingInterval('monthly')}
                          >
                            Monthly
                          </button>
                          <button
                            type="button"
                            data-active={effectiveBillingInterval === 'annual'}
                            onClick={() => setBillingInterval('annual')}
                            disabled={!canChooseAnnual}
                          >
                            Annual
                            {canChooseAnnual ? (
                              <span className="billing-cycle-pill__badge tag green">−20%</span>
                            ) : null}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="billing-trial-cta__action">
                      {checkoutAvailable ? (
                        <button
                          type="button"
                          className="btn user-save"
                          disabled={checkoutPlan !== null}
                          onClick={() => void openStartOrReactivateCheckout(currentPlan)}
                        >
                          {checkoutPlan ? 'Starting…' : 'Start 14-day trial'}
                        </button>
                      ) : (
                        <div>
                          <button type="button" className="btn" disabled>
                            Payment setup unavailable
                          </button>
                          <p className="sub" style={{ margin: '8px 0 0', maxWidth: 280 }}>
                            {checkoutUnavailableCopy(billing?.checkoutDisabledReason)}
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}

                <div className="business-subtabs billing-subtabs" role="tablist" aria-label="Billing sections">
                  <button
                    type="button"
                    role="tab"
                    id="billing-tab-overview"
                    aria-selected={billingTab === 'overview'}
                    aria-controls="billing-panel-overview"
                    className={`business-subtab${billingTab === 'overview' ? ' active' : ''}`}
                    onClick={() => selectBillingTab('overview')}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="billing-tab-plans"
                    aria-selected={billingTab === 'plans'}
                    aria-controls="billing-panel-plans"
                    className={`business-subtab${billingTab === 'plans' ? ' active' : ''}`}
                    onClick={() => selectBillingTab('plans')}
                  >
                    Plans
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="billing-tab-history"
                    aria-selected={billingTab === 'history'}
                    aria-controls="billing-panel-history"
                    className={`business-subtab${billingTab === 'history' ? ' active' : ''}`}
                    onClick={() => selectBillingTab('history')}
                  >
                    History
                  </button>
                </div>

                <div className="billing-tab-panels">
                  {billingTab === 'overview' ? (
                    <div role="tabpanel" id="billing-panel-overview" aria-labelledby="billing-tab-overview">
                      {!isEnterprisePlan ? (
                        <>
                          <div className="billing-overview-actions">
                            <div className="billing-action-card">
                              <div className="billing-action-card__head">
                                <h3>Payment method</h3>
                                {hasPaymentMethod ? (
                                  <>
                                    <span className="tag green" style={{ marginTop: 6, display: 'inline-flex' }}>
                                      Added ✓
                                    </span>
                                    <p className="sub">
                                      Payment method is on file. Manage billing to view or update card details.
                                    </p>
                                  </>
                                ) : paymentMethodStatus === 'pending' ? (
                                  <>
                                    <span className="tag orange" style={{ marginTop: 6, display: 'inline-flex' }}>
                                      Pending
                                    </span>
                                    <p className="sub">We are confirming your payment method. This usually updates within a minute.</p>
                                  </>
                                ) : (
                                  <>
                                    <span className="tag red" style={{ marginTop: 6, display: 'inline-flex' }}>
                                      Not added
                                    </span>
                                    <p className="sub">A card is required before RingBooker can answer real calls on your number.</p>
                                  </>
                                )}
                              </div>
                              <div className="billing-action-card__actions">
                                {hasPaymentMethod ? (
                                  <button type="button" className="btn" disabled={!manageBillingAvailable} onClick={() => void openManageBilling()}>
                                    {managingBilling ? 'Opening…' : 'Update card'}
                                  </button>
                                ) : checkoutAvailable ? (
                                  <button
                                    type="button"
                                    className="btn user-save"
                                    disabled={checkoutPlan !== null}
                                    onClick={() => void openStartOrReactivateCheckout(currentPlan)}
                                  >
                                    {checkoutPlan ? 'Starting…' : 'Add payment method'}
                                  </button>
                                ) : (
                                  <button type="button" className="btn" disabled>
                                    Payment setup unavailable
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="billing-action-card">
                              <div className="billing-action-card__head">
                                <h3>Phone forwarding</h3>
                                {forwardingState === 'verified' ? (
                                  <>
                                    <span className="tag green" style={{ marginTop: 6, display: 'inline-flex' }}>
                                      Verified ✓
                                    </span>
                                    <p className="sub">Forwarding is active and verified.</p>
                                  </>
                                ) : forwardingState === 'configured' ? (
                                  <>
                                    <span className="tag orange" style={{ marginTop: 6, display: 'inline-flex' }}>
                                      Pending verification
                                    </span>
                                    <p className="sub">Forwarding is configured — call your business number to verify.</p>
                                  </>
                                ) : (
                                  <>
                                    <span className="tag orange" style={{ marginTop: 6, display: 'inline-flex' }}>
                                      Not set up
                                    </span>
                                    <p className="sub">
                                      Forward missed calls from your business number to RingBooker to activate live answering.
                                    </p>
                                  </>
                                )}
                              </div>
                              {forwardingState === 'verified' ? null : (
                                <div className="billing-action-card__actions">
                                  {forwardingState === 'configured' ? (
                                    <a className="btn" href="/user/go-live#go-live-forwarding">
                                      Verify now →
                                    </a>
                                  ) : (
                                    <a className="btn" href="/user/go-live#go-live-forwarding">
                                      Open Go Live →
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="billing-overview-note" role="note">
                            <span className="billing-overview-note__icon" aria-hidden>
                              ⓘ
                            </span>
                            <span>
                              Your business number stays unchanged. Customers keep calling the same number they always have.
                            </span>
                          </div>

                          {manageBillingAvailable && ['active', 'trialing_valid'].includes(billingState) ? (
                            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              <button type="button" className="btn" disabled={managingBilling} onClick={() => void openManageBilling()}>
                                {managingBilling ? 'Opening…' : 'Manage billing & invoices'}
                              </button>
                            </div>
                          ) : null}

                          {showBillingIssueBanner ? (
                            <section className="billing-alert-strip" style={{ marginBottom: 16 }}>
                              <p style={{ margin: 0 }}>
                                <strong>{billingCopy.title}</strong> {billingCopy.body}
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {manageBillingAvailable ? (
                                  <button type="button" className="btn user-save" disabled={managingBilling} onClick={() => void openManageBilling()}>
                                    {managingBilling ? 'Opening…' : 'Resolve billing issue'}
                                  </button>
                                ) : checkoutAvailable ? (
                                  <button
                                    type="button"
                                    className="btn user-save"
                                    disabled={checkoutPlan !== null}
                                    onClick={() => void openReactivateCheckout()}
                                  >
                                    {checkoutPlan ? 'Starting…' : 'Resolve billing issue'}
                                  </button>
                                ) : (
                                  <a className="btn" href="/contact?topic=support">
                                    Contact support
                                  </a>
                                )}
                                {billingState === 'canceled' && checkoutAvailable ? (
                                  <button
                                    type="button"
                                    className="btn"
                                    disabled={checkoutPlan !== null}
                                    onClick={() => void openReactivateCheckout()}
                                  >
                                    {checkoutPlan ? 'Starting…' : 'Restart trial'}
                                  </button>
                                ) : null}
                              </div>
                            </section>
                          ) : null}
                        </>
                      ) : null}
                      {hasPaymentMethod && usage ? (
                        <section
                          className={`card usage-captured-card${usage.overCapturedCallerLimit ? ' usage-captured-card--over' : ''}${usage.nearCapturedCallerLimit && !usage.overCapturedCallerLimit ? ' usage-captured-card--near' : ''}`}
                          style={{ marginBottom: 16 }}
                        >
                          <div className="panel-head">
                            <div>
                              <h3>Captured calls this billing period</h3>
                              <p className="sub">
                                {usage.capturedCallersLimit == null
                                  ? `${usage.capturedCallersUsed} captured calls · Custom allowance`
                                  : `${usage.capturedCallersUsed} / ${usage.capturedCallersLimit} calls this billing period`}
                              </p>
                            </div>
                            <span
                              className={`tag ${usage.overCapturedCallerLimit ? 'orange' : usage.nearCapturedCallerLimit ? 'orange' : 'green'}`}
                            >
                              {usage.capturedCallerUsagePercent == null
                                ? 'Custom'
                                : `${usage.capturedCallerUsagePercent}%`}
                            </span>
                          </div>
                          <div className="usage-progress-track" aria-hidden="true">
                            <div
                              className={`usage-progress-fill ${usage.overCapturedCallerLimit ? 'usage-progress-fill--over' : usage.nearCapturedCallerLimit ? 'usage-progress-fill--near' : 'usage-progress-fill--ok'}`}
                              style={{ width: `${Math.min(100, usage.capturedCallerUsagePercent ?? 0)}%` }}
                            />
                          </div>
                          {usage.nearCapturedCallerLimit || usage.overCapturedCallerLimit ? (
                            <p
                              className="sub"
                              style={{
                                marginTop: 10,
                                color: usage.overCapturedCallerLimit
                                  ? 'var(--billing-danger-text, #b91c1c)'
                                  : 'var(--billing-warning-text, #92400e)',
                              }}
                            >
                              {usage.overCapturedCallerLimit
                                ? `You have ${Math.max(0, usage.capturedCallersUsed - (usage.capturedCallersLimit ?? usage.capturedCallersUsed))} overage captured calls this billing period - estimated charge: ${formatMoneyCents(Math.max(0, usage.capturedCallersUsed - (usage.capturedCallersLimit ?? usage.capturedCallersUsed)) * 75)}.`
                                : 'You are close to your captured call limit for this billing period.'}
                            </p>
                          ) : null}
                          {usage.capturedCallersLimit != null ? (
                            <p className="sub" style={{ marginTop: 8 }}>
                              Additional captured calls billed at $0.75 each at end of billing period.
                            </p>
                          ) : null}
                        </section>
                      ) : null}

                      {isEnterprisePlan ? (
                        <section className="card enterprise-managed-card" style={{ marginBottom: 16 }}>
                          <h3 style={{ marginTop: 0 }}>
                            {enterpriseApprovalPending
                              ? 'Your Custom setup is being prepared'
                              : 'Custom billing is managed by the RingBooker team'}
                          </h3>
                          {!enterpriseApprovalPending ? (
                            <p className="sub">
                              Your Custom account uses managed setup for routing, integrations, call volume planning, and
                              billing changes.
                            </p>
                          ) : null}
                          <ul className="plan-includes-list" style={{ marginTop: enterpriseApprovalPending ? 10 : 12 }}>
                            {(enterpriseApprovalPending
                              ? [...ENTERPRISE_PENDING_BILLING_STATUS_LINES, ...CUSTOM_MANAGED_SETUP_ITEMS]
                              : CUSTOM_MANAGED_SETUP_ITEMS
                            ).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                          <div className="portal-card-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                            <a className="btn user-save" href="/contact?topic=sales">
                              Contact sales
                            </a>
                            <a className="btn" href="/contact?topic=implementation">
                              Contact implementation support
                            </a>
                          </div>
                        </section>
                      ) : null}

                      {showCheckoutError ? (
                        <section className="card" style={{ marginTop: 0 }}>
                          <h3>Payment setup could not start</h3>
                          <p className="sub">{checkoutError}</p>
                        </section>
                      ) : null}
                    </div>
                  ) : null}

                  {billingTab === 'plans' ? (
                    <div role="tabpanel" id="billing-panel-plans" aria-labelledby="billing-tab-plans">
                      {checkoutAvailable && availableBillingIntervals.length > 1 && !showTrialCtaRow ? (
                        <div className="billing-plans-head">
                          <p>Billing cycle for displayed prices, excluding tax</p>
                          <div className="billing-cycle-pill" role="group" aria-label="Billing cycle">
                            <button
                              type="button"
                              data-active={effectiveBillingInterval === 'monthly'}
                              onClick={() => setBillingInterval('monthly')}
                            >
                              Monthly
                            </button>
                            <button
                              type="button"
                              data-active={effectiveBillingInterval === 'annual'}
                              onClick={() => setBillingInterval('annual')}
                              disabled={!canChooseAnnual}
                            >
                              Annual <span className="tag green" style={{ marginLeft: 6 }}>−20%</span>
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="billing-plans-grid">
                        {BILLING_PLANS_CATALOG.map((plan) => {
                          const isCurrent = currentPlan === plan.key;
                          const isBusy = checkoutPlan === plan.key;
                          const isEnterprise = plan.key === 'enterprise';
                          const bigPrice =
                            plan.priceLabel ??
                            (effectiveBillingInterval === 'annual' && plan.annualPrice != null
                              ? `$${plan.annualPrice}`
                              : plan.monthlyPrice != null
                                ? `$${plan.monthlyPrice}`
                                : '—');
                          const priceNote =
                            plan.priceLabel || plan.monthlyPrice == null
                              ? null
                              : effectiveBillingInterval === 'annual'
                                ? 'per month · billed annually'
                                : 'per month';

                          let cta: ReactNode;
                          if (isEnterprise) {
                            cta = (
                              <a className="btn" href="/contact?topic=sales">
                                Talk to sales
                              </a>
                            );
                          } else if (isCurrent) {
                            if (!hasPaymentMethod) {
                              cta = (
                                <button
                                  type="button"
                                  className="btn user-save"
                                  disabled={isBusy || !checkoutAvailable}
                                  onClick={() => void openStartOrReactivateCheckout(plan.key)}
                                >
                                  {isBusy ? 'Starting…' : checkoutAvailable ? 'Start 14-day trial' : 'Payment setup unavailable'}
                                </button>
                              );
                            } else {
                              cta = (
                                <span className="btn user-save" style={{ opacity: 0.85, cursor: 'default' }} aria-current="true">
                                  Current plan
                                </span>
                              );
                            }
                          } else if (plan.key === 'professional' && currentPlan === 'starter') {
                            if (subscriptionBillingBlocked) {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Resolve billing first</span>;
                            } else if (planChangePending) {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Upgrade pending</span>;
                            } else if (selfServeUpgradeAvailable) {
                              cta = (
                                <button
                                  type="button"
                                  className="btn purple"
                                  disabled={upgradingPlan === 'professional'}
                                  onClick={() => void changePlan('professional')}
                                >
                                  {upgradingPlan === 'professional' ? 'Starting…' : 'Upgrade to Pro'}
                                </button>
                              );
                            } else if (manageBillingAvailable) {
                              cta = (
                                <button type="button" className="btn purple" disabled={managingBilling} onClick={() => void openManageBilling()}>
                                  {managingBilling ? 'Opening…' : 'Upgrade via billing portal'}
                                </button>
                              );
                            } else if (checkoutAvailable) {
                              cta = (
                                <button
                                  type="button"
                                  className="btn purple"
                                  disabled={isBusy}
                                  onClick={() => void openStartOrReactivateCheckout('professional')}
                                >
                                  {isBusy ? 'Starting…' : 'Set up billing for Pro'}
                                </button>
                              );
                            } else {
                              cta = (
                                <a className="btn" href="/contact?topic=sales">
                                  Contact us to upgrade
                                </a>
                              );
                            }
                          } else if (plan.key === 'starter' && currentPlan === 'professional') {
                            if (subscriptionBillingBlocked) {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Resolve billing first</span>;
                            } else if (planChangePending) {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Change pending</span>;
                            } else if (selfServeUpgradeAvailable) {
                              cta = (
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={upgradingPlan === 'starter'}
                                  onClick={() => void changePlan('starter')}
                                >
                                  {upgradingPlan === 'starter' ? 'Starting…' : 'Switch to Starter'}
                                </button>
                              );
                            } else if (manageBillingAvailable) {
                              cta = (
                                <button type="button" className="btn" disabled={managingBilling} onClick={() => void openManageBilling()}>
                                  {managingBilling ? 'Opening…' : 'Switch via billing portal'}
                                </button>
                              );
                            } else {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Plan change unavailable</span>;
                            }
                          } else {
                            cta = (
                              <a className="btn" href={`/contact?topic=sales&source=user_billing_plan_change&plan=${plan.key}`}>
                                Contact us to switch
                              </a>
                            );
                          }

                          const compactEnterpriseFeats = plan.key === 'enterprise' && plan.features.length <= 4;

                          return (
                            <div
                              className={`billing-plan-card${isCurrent ? ' billing-plan-card--current' : ''}${compactEnterpriseFeats ? ' billing-plan-card--feats-compact' : ''}`}
                              key={plan.key}
                            >
                              <div className="billing-plan-card__badge-row">
                                {isCurrent ? (
                                  <span className="tag purple">Current plan</span>
                                ) : plan.badge ? (
                                  <span className="tag purple">{plan.badge}</span>
                                ) : null}
                              </div>
                              <h4>{plan.key === 'professional' && currentPlan === 'starter' ? 'Upgrade to Professional' : plan.name}</h4>
                              <p className="billing-plan-card__desc">{plan.description}</p>
                              <div className="billing-plan-card__price">{bigPrice}</div>
                              {priceNote ? <p className="billing-plan-card__price-note">{priceNote}</p> : null}
                              {priceNote ? <p className="billing-plan-card__price-note">+ tax where applicable</p> : null}
                              <ul className="billing-plan-card__feats">
                                {plan.features.map((feature) => (
                                  <li key={feature}>{feature}</li>
                                ))}
                              </ul>
                              <div className="billing-plan-card__cta">{cta}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {billingTab === 'history' ? (
                    <div role="tabpanel" id="billing-panel-history" aria-labelledby="billing-tab-history">
                      <section className="card billing-history-compact" style={{ marginBottom: 16 }}>
                        <div className="panel-head">
                          <div>
                            <h3>Payments &amp; invoices</h3>
                            <p className="sub">Official payments and receipts from Paddle.</p>
                          </div>
                          {manageBillingAvailable ? (
                            <button type="button" className="btn" disabled={managingBilling} onClick={() => void openManageBilling()}>
                              {managingBilling ? 'Opening…' : 'Manage billing'}
                            </button>
                          ) : null}
                        </div>
                        {transactionsState.loading ? (
                          <p className="sub">Loading Paddle payment history…</p>
                        ) : transactionsState.available && transactionsState.rows.length > 0 ? (
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Receipt</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transactionsState.rows.map((row) => (
                                <tr key={row.id}>
                                  <td>{formatBillingDate(row.date, shopTimezone)}</td>
                                  <td>{row.description}</td>
                                  <td>{formatMoney(row.amount, row.currency)}</td>
                                  <td>
                                    <span className={`tag ${transactionStatusTone(row.status)}`}>{row.status}</span>
                                  </td>
                                  <td>
                                    {row.invoiceUrl ? (
                                      <a className="link" href={row.invoiceUrl} target="_blank" rel="noreferrer">
                                        View invoice
                                      </a>
                                    ) : row.receiptUrl ? (
                                      <a className="link" href={row.receiptUrl} target="_blank" rel="noreferrer">
                                        View receipt
                                      </a>
                                    ) : (
                                      <span className="sub">Available in Manage billing</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="sub">
                            {transactionsState.message ?? 'Official invoices and receipts are available in Manage billing.'}
                          </p>
                        )}
                      </section>
                      <section className="card billing-history-compact" style={{ marginBottom: 16 }}>
                        <div className="panel-head">
                          <div>
                            <h3>Overage charges</h3>
                            <p className="sub">Captured calls above your plan allowance.</p>
                          </div>
                        </div>
                        {overageChargesState.loading ? (
                          <p className="sub">Loading overage history…</p>
                        ) : overageChargesState.rows.length > 0 ? (
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Period</th>
                                <th>Overage calls</th>
                                <th>Amount</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {overageChargesState.rows.map((row) => (
                                <tr key={row.id}>
                                  <td>
                                    {formatBillingDate(row.periodStart, shopTimezone)} - {formatBillingDate(row.periodEnd, shopTimezone)}
                                  </td>
                                  <td>{row.overageCallers}</td>
                                  <td>{formatMoneyCents(row.amountCents)}</td>
                                  <td>
                                    <span className={`tag ${transactionStatusTone(row.status)}`}>{row.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="sub">{overageChargesState.message ?? 'No overage charges yet'}</p>
                        )}
                      </section>
                      {billingHistory.length > 0 ? (
                        <section className="card billing-history-compact" style={{ marginBottom: 16 }}>
                          <div className="panel-head">
                            <div>
                              <h3>{billing?.billingHistoryLabel ?? 'Account billing activity'}</h3>
                              <p className="sub">
                                This shows RingBooker account status changes.
                              </p>
                            </div>
                            {manageBillingAvailable ? (
                              <button type="button" className="btn" disabled={managingBilling} onClick={() => void openManageBilling()}>
                                {managingBilling ? 'Opening…' : 'Manage billing'}
                              </button>
                            ) : null}
                          </div>
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {billingHistory.map((row) => (
                                <tr key={`${row.date}-${row.description}`}>
                                  <td>{row.date}</td>
                                  <td>{row.description}</td>
                                  <td>{row.amount}</td>
                                  <td>
                                    <span className={`tag ${row.tone}`}>{row.status}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </section>
                      ) : (
                        <section className="card billing-history-compact" style={{ marginBottom: 16 }}>
                          <div className="panel-head">
                            <div>
                              <h3>{billing?.billingHistoryLabel ?? 'Account billing activity'}</h3>
                            </div>
                          </div>
                          <p className="sub" style={{ marginBottom: 0 }}>
                            Account billing activity appears after your first subscription event. Official invoices and payment receipts are available in billing management.
                          </p>
                        </section>
                      )}
                      <section className="card billing-history-compact" style={{ marginBottom: 16 }}>
                        <div className="panel-head">
                          <div>
                            <h3>Usage and overage FAQ</h3>
                          </div>
                        </div>
                        <div className="billing-faq-list">
                          {BILLING_USAGE_FAQ.map((item) => (
                            <details className="billing-faq-item" key={item.question}>
                              <summary className="billing-faq-q">{item.question}</summary>
                              <div className="billing-faq-a">
                                <p className="sub">{item.answer}</p>
                              </div>
                            </details>
                          ))}
                        </div>
                      </section>
                    </div>
                  ) : null}
                </div>
            </UserPortalPageContent>
          </main>
        </div>
        <UserPortalMobileTabbar active="billing" />
      </>
    </UserLayout>
  );
}
