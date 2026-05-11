'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userBillingScripts, userBillingStyles } from '@/components/user/user-billing';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
import {
  BILLING_PLAN_CARD_FEATURES,
  CUSTOM_MANAGED_SETUP_ITEMS,
  ENTERPRISE_PENDING_BILLING_STATUS_LINES,
} from '@/components/user/user-plan-ux-copy';
import { formatShopDate, getShopTimezone } from '@/src/shared/timezone';

type ShopPlan = 'starter' | 'professional' | 'enterprise';
type BillingProvider = 'paddle' | 'stripe' | 'manual';
type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused'
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
      voiceMinutesUsed: number;
      voiceMinutesSoftLimit: number | null;
      nearCapturedCallerLimit: boolean;
      overCapturedCallerLimit: boolean;
      activeLiveCalls?: number;
      maxConcurrentLiveCalls?: number;
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

type BillingSubscriptionRow = NonNullable<NonNullable<UserBillingResponse['billing']>['subscription']>;

const PLAN_CATALOG: Array<{
  plan: ShopPlan;
  priceLine: string;
  features: string[];
}> = [
  {
    plan: 'starter',
    priceLine: '$79/mo',
    features: BILLING_PLAN_CARD_FEATURES.starter,
  },
  {
    plan: 'professional',
    priceLine: '$149/mo',
    features: BILLING_PLAN_CARD_FEATURES.professional,
  },
  {
    plan: 'enterprise',
    priceLine: 'Custom',
    features: BILLING_PLAN_CARD_FEATURES.enterprise,
  },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
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
      return 'red';
    case 'canceled':
    case 'paused':
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

function liveAnsweringMeta(enabled: boolean | undefined, hasPayment: boolean | undefined) {
  if (enabled === true) return 'RingBooker can answer real callers';
  if (!hasPayment) return 'Start trial before live answering';
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
  if (params.subscription.status === 'paused') return 'paused';
  if (params.subscription.status === 'canceled') return 'canceled';
  if (params.subscription.status === 'trialing' && params.hasPaymentMethod) return 'trialing_valid';
  if (params.subscription.status === 'active' && params.hasPaymentMethod) return 'active';
  return params.hasPaymentMethod ? 'setup_allowed_no_payment' : 'payment_method_required';
}

function billingUiCopy(state: BillingUiState) {
  switch (state) {
    case 'billing_not_configured':
      return {
        title: 'Start your 14-day trial',
        body: 'Your AI receptionist is ready for setup and test calls. To let RingBooker answer real calls on your business number, start your 14-day trial and complete phone forwarding.',
      };
    case 'setup_allowed_no_payment':
      return {
        title: 'Start your 14-day trial',
        body: 'Your AI receptionist is ready for setup and test calls. To let RingBooker answer real calls on your business number, start your 14-day trial and complete phone forwarding.',
      };
    case 'payment_method_required':
      return {
        title: 'Start your 14-day trial',
        body: 'Your AI receptionist is ready for setup and test calls. To let RingBooker answer real calls on your business number, start your 14-day trial and complete phone forwarding.',
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

function liveTrialDueTodayCopy(trialNoChargeUntilEndVerified?: boolean): string {
  return trialNoChargeUntilEndVerified
    ? "Due today: $0. You won't be charged until your 14-day trial ends. Final total may include applicable taxes based on your location."
    : 'Due today: $0. Final total may include applicable taxes based on your location.';
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
}: {
  initialData?: UserBillingResponse | null;
  initialTransactions?: BillingTransactionsResponse | null;
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
  }, [setWorkspace]);

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
  const hasPaymentMethod = data?.billing?.hasPaymentMethod === true;
  const liveEnabled = data?.billing?.liveCallsEnabled;
  const catalog = useMemo(() => PLAN_CATALOG.find((p) => p.plan === currentPlan) ?? PLAN_CATALOG[0], [currentPlan]);
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
    return catalog.priceLine;
  }, [currentPlan, subscription, catalog.priceLine]);

  const enterpriseApprovalPending = currentPlan === 'enterprise' && data?.billing?.commercialApprovalRequired === true;
  const isEnterprisePlan = currentPlan === 'enterprise';
  const billing = data?.billing ?? null;
  const usage = billing?.usage ?? null;
  const checkoutAvailable = data?.billing?.checkoutAvailable === true;
  const manageBillingAvailable = data?.billing?.manageBillingAvailable === true;
  const selfServeUpgradeAvailable = data?.billing?.selfServeUpgradeAvailable === true;
  const pendingPlanUpgrade = data?.billing?.pendingPlanUpgrade ?? null;
  const upgradePending =
    upgradePendingMessage != null || pendingPlanUpgrade?.targetPlan === 'professional';
  const availableBillingIntervals = data?.billing?.availableBillingIntervals ?? ['monthly'];
  const canChooseAnnual = checkoutAvailable && availableBillingIntervals.includes('annual');
  const effectiveBillingInterval =
    billingInterval === 'annual' && canChooseAnnual ? 'annual' : 'monthly';
  const billingState = resolveBillingUiState({ subscription, hasPaymentMethod, checkoutPlan });
  const billingCopy = billingUiCopy(billingState);
  const subscriptionBillingBlocked =
    subscription != null && ['past_due', 'paused', 'canceled'].includes(subscription.status);
  const showAddPaymentStrip =
    Boolean(data?.billing) &&
    !isEnterprisePlan &&
    !liveEnabled &&
    !hasPaymentMethod &&
    !subscriptionBillingBlocked;
  const showBillingOverviewCard =
    Boolean(data?.billing) &&
    !isEnterprisePlan &&
    !liveEnabled &&
    (hasPaymentMethod || subscriptionBillingBlocked);

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

  async function upgradeToProfessional() {
    if (!selfServeUpgradeAvailable) {
      setCheckoutError('Plan upgrade is not available right now. Resolve billing or contact support.');
      return;
    }
    setUpgradingPlan('professional');
    setCheckoutError(null);
    setUpgradePendingMessage(null);
    try {
      const response = await fetch('/api/backend/user/billing/upgrade', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_plan: 'professional',
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
        throw new Error(body.message ?? body.error ?? 'Plan upgrade could not start.');
      }
      setUpgradePendingMessage(
        body.message ?? 'Your upgrade is being processed. Professional features will unlock after billing is confirmed.',
      );
      await refreshBilling().catch(() => undefined);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'billing_upgrade_failed');
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

            {!loading && !data?.ok ? (
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
                    <div className="bst-value">{paymentCardValue(paymentMethodStatus)}</div>
                    <div className="bst-meta">{paymentCardMeta(paymentMethodStatus)}</div>
                  </div>
                  <div className="billing-status-card">
                    <div className="bst-label">Live answering</div>
                    <div className="bst-value">{liveAnsweringValue(liveEnabled)}</div>
                    <div className="bst-meta">{liveAnsweringMeta(liveEnabled, hasPaymentMethod)}</div>
                  </div>
                </section>

                {billingNotice === 'checkout_success' ? (
                  <section className="billing-alert-strip" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }}>
                    <p>
                      <strong>Payment setup pending.</strong> We are waiting for billing to confirm your trial. Live answering stays off until billing and phone forwarding are complete.
                    </p>
                    <a className="btn purple" href="/user/go-live#go-live-forwarding">
                      Continue go-live setup
                    </a>
                  </section>
                ) : billingNotice === 'checkout_cancelled' ? (
                  <section className="billing-alert-strip">
                    <p>
                      <strong>Checkout was cancelled.</strong> Your live answering trial was not started. Setup and test calls still work.
                    </p>
                    {checkoutAvailable ? (
                      <button type="button" className="btn user-save" disabled={checkoutPlan !== null} onClick={() => void openCheckout(currentPlan)}>
                        {checkoutPlan ? 'Starting…' : 'Try again'}
                      </button>
                    ) : null}
                  </section>
                ) : billingNotice === 'manage_returned' ? (
                  <section className="billing-alert-strip" style={{ borderColor: '#bfdbfe', background: '#eff6ff', color: '#1e40af' }}>
                    <p>
                      <strong>Billing management closed.</strong> Changes made in billing management may take a minute to appear here.
                    </p>
                    <button type="button" className="btn" onClick={() => void refreshBilling()}>
                      Refresh status
                    </button>
                  </section>
                ) : null}

                {upgradePending ? (
                  <section className="billing-alert-strip" style={{ borderColor: '#bfdbfe', background: '#eff6ff', color: '#1e40af' }}>
                    <p>
                      <strong>Upgrade pending.</strong>{' '}
                      {upgradePendingMessage ??
                        'Your upgrade is being processed. Professional features will unlock after billing confirms the change.'}
                    </p>
                    <button type="button" className="btn" onClick={() => void refreshBilling()}>
                      Refresh status
                    </button>
                  </section>
                ) : null}

                {showAddPaymentStrip ? (
                  <section className="billing-alert-strip">
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <p style={{ margin: 0 }}>
                        <strong>Start your 14-day trial.</strong> Add a payment method to start your 14-day live answering trial.
                        RingBooker will not answer real calls on your business number until billing and phone forwarding are set up.
                      </p>
                      <div className="sub" style={{ marginTop: 10 }}>
                        {liveTrialDueTodayCopy(billing?.trialNoChargeUntilEndVerified)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                      {checkoutAvailable && availableBillingIntervals.length > 1 ? (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} aria-label="Billing interval">
                          <button
                            type="button"
                            className={`btn${effectiveBillingInterval === 'monthly' ? ' purple' : ''}`}
                            onClick={() => setBillingInterval('monthly')}
                          >
                            Monthly
                          </button>
                          <button
                            type="button"
                            className={`btn${effectiveBillingInterval === 'annual' ? ' purple' : ''}`}
                            onClick={() => setBillingInterval('annual')}
                            disabled={!canChooseAnnual}
                          >
                            Annual
                          </button>
                        </div>
                      ) : null}
                      {checkoutAvailable ? (
                        <button
                          type="button"
                          className="btn user-save"
                          disabled={checkoutPlan !== null}
                          onClick={() => void openCheckout(currentPlan)}
                        >
                          {checkoutPlan ? 'Starting…' : 'Start 14-day trial'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                          <button type="button" className="btn" disabled>
                            Payment setup unavailable
                          </button>
                          <span style={{ fontSize: 12 }}>{checkoutUnavailableCopy(billing?.checkoutDisabledReason)}</span>
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
                      <section className="card soft" style={{ marginBottom: 16 }}>
                        <h3 style={{ marginTop: 0 }}>Call forwarding & go live</h3>
                        <p className="sub">
                          Your RingBooker forwarding number and carrier steps live under Go live, so Billing stays focused on
                          your subscription and payment method.
                        </p>
                        <a className="btn" href="/user/go-live#go-live-forwarding">
                          Open Go live
                        </a>
                      </section>
                      {hasPaymentMethod && usage ? (
                        <section
                          className={`card usage-captured-card${usage.overCapturedCallerLimit ? ' usage-captured-card--over' : ''}${usage.nearCapturedCallerLimit && !usage.overCapturedCallerLimit ? ' usage-captured-card--near' : ''}`}
                          style={{ marginBottom: 16 }}
                        >
                          <div className="panel-head">
                            <div>
                              <h3>Captured callers this month</h3>
                              <p className="sub">
                                {usage.capturedCallersLimit == null
                                  ? `${usage.capturedCallersUsed} captured callers · Custom allowance`
                                  : `${usage.capturedCallersUsed} / ${usage.capturedCallersLimit} captured callers`}
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
                                color: usage.overCapturedCallerLimit ? '#b91c1c' : '#92400e',
                              }}
                            >
                              {usage.overCapturedCallerLimit
                                ? 'You have reached your monthly captured caller limit. Upgrade for more call coverage.'
                                : 'You are close to your monthly captured caller limit.'}
                            </p>
                          ) : null}
                          <p className="sub" style={{ marginTop: 8 }}>
                            Voice usage: {usage.voiceMinutesUsed} min
                            {usage.voiceMinutesSoftLimit
                              ? ` / ${usage.voiceMinutesSoftLimit} soft cap`
                              : ''}{' '}
                            · Active calls: {usage.activeLiveCalls ?? 0}/{usage.maxConcurrentLiveCalls ?? 0}
                          </p>
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

                      {showBillingOverviewCard ? (
                        <section className="card" style={{ marginBottom: 16 }}>
                          <h3 style={{ marginTop: 0 }}>{billingCopy.title}</h3>
                          <p className="sub">{billingCopy.body}</p>
                          {!hasPaymentMethod && !['past_due', 'paused', 'canceled'].includes(billingState) ? (
                            <p className="sub">{liveTrialDueTodayCopy(billing?.trialNoChargeUntilEndVerified)}</p>
                          ) : null}
                          {['active', 'trialing_valid'].includes(billingState) && manageBillingAvailable ? (
                            <p className="sub">Changes made in billing management may take a minute to appear here.</p>
                          ) : null}
                          {checkoutAvailable && availableBillingIntervals.length > 1 && !hasPaymentMethod ? (
                            <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }} aria-label="Billing interval">
                              <button
                                type="button"
                                className={`btn${effectiveBillingInterval === 'monthly' ? ' purple' : ''}`}
                                onClick={() => setBillingInterval('monthly')}
                              >
                                Monthly
                              </button>
                              <button
                                type="button"
                                className={`btn${effectiveBillingInterval === 'annual' ? ' purple' : ''}`}
                                onClick={() => setBillingInterval('annual')}
                                disabled={!canChooseAnnual}
                              >
                                Annual
                              </button>
                            </div>
                          ) : null}
                          {['active', 'trialing_valid'].includes(billingState) ? (
                            manageBillingAvailable ? (
                              <button
                                type="button"
                                className="btn user-save"
                                disabled={managingBilling}
                                onClick={() => void openManageBilling()}
                              >
                                {managingBilling ? 'Opening…' : 'Manage billing'}
                              </button>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                                <button type="button" className="btn" disabled>
                                  Manage billing unavailable
                                </button>
                                <p className="sub" style={{ margin: 0 }}>
                                  {manageBillingUnavailableCopy(billing?.manageBillingDisabledReason)}
                                </p>
                              </div>
                            )
                          ) : !checkoutAvailable && !manageBillingAvailable ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                              <button type="button" className="btn" disabled>
                                Payment setup unavailable
                              </button>
                              <p className="sub" style={{ margin: 0 }}>
                                {checkoutUnavailableCopy(billing?.checkoutDisabledReason)}
                              </p>
                            </div>
                          ) : ['past_due', 'paused'].includes(billingState) ? (
                            manageBillingAvailable ? (
                              <button
                                type="button"
                                className="btn user-save"
                                disabled={managingBilling}
                                onClick={() => void openManageBilling()}
                              >
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
                              <a className="btn" href="/contact?topic=support">Contact support</a>
                            )
                          ) : billingState === 'canceled' ? (
                            checkoutAvailable ? (
                              <button
                                type="button"
                                className="btn user-save"
                                disabled={checkoutPlan !== null}
                                onClick={() => void openReactivateCheckout()}
                              >
                                {checkoutPlan ? 'Starting…' : 'Restart 14-day trial'}
                              </button>
                            ) : (
                              <a className="btn" href="/contact?topic=support">Contact support</a>
                            )
                          ) : !hasPaymentMethod ? (
                            <button
                              type="button"
                              className="btn user-save"
                              disabled={checkoutPlan !== null}
                              onClick={() => void openCheckout(currentPlan)}
                            >
                              {checkoutPlan ? 'Starting…' : 'Start 14-day trial'}
                            </button>
                          ) : null}
                        </section>
                      ) : null}

                      {checkoutError ? (
                        <section className="card" style={{ marginTop: 0 }}>
                          <h3>Payment setup could not start</h3>
                          <p className="sub">{checkoutError}</p>
                        </section>
                      ) : null}
                    </div>
                  ) : null}

                  {billingTab === 'plans' ? (
                    <div role="tabpanel" id="billing-panel-plans" aria-labelledby="billing-tab-plans">
                      <section className="pricing-mini" style={{ marginBottom: 16 }}>
                        {PLAN_CATALOG.map((plan) => {
                          const isCurrent = currentPlan === plan.plan;
                          const isBusy = checkoutPlan === plan.plan;
                          const isEnterprise = plan.plan === 'enterprise';

                          let cta: ReactNode;
                          if (isEnterprise) {
                            cta = (
                              <a className="btn" href="/contact">
                                Contact us
                              </a>
                            );
                          } else if (isCurrent) {
                            if (!hasPaymentMethod) {
                              cta = (
                                <button
                                  type="button"
                                  className="btn user-save"
                                  disabled={isBusy || !checkoutAvailable}
                                  onClick={() => void openCheckout(plan.plan)}
                                >
                                  {isBusy ? 'Starting…' : checkoutAvailable ? 'Start 14-day trial' : 'Payment setup unavailable'}
                                </button>
                              );
                            } else {
                              cta = (
                                <span className="btn" style={{ opacity: 0.85, cursor: 'default' }} aria-current="true">
                                  Current plan
                                </span>
                              );
                            }
                          } else if (plan.plan === 'professional' && currentPlan === 'starter') {
                            if (subscriptionBillingBlocked) {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Resolve billing first</span>;
                            } else if (upgradePending) {
                              cta = <span className="btn" style={{ opacity: 0.85, cursor: 'default' }}>Upgrade pending</span>;
                            } else if (selfServeUpgradeAvailable) {
                              cta = (
                                <button
                                  type="button"
                                  className="btn user-save"
                                  disabled={upgradingPlan === 'professional'}
                                  onClick={() => void upgradeToProfessional()}
                                >
                                  {upgradingPlan === 'professional' ? 'Starting…' : 'Upgrade to Professional'}
                                </button>
                              );
                            } else {
                              cta = (
                                <a className="btn" href="/contact?intent=sales&source=user_billing_upgrade&plan=professional">
                                  Contact us to upgrade
                                </a>
                              );
                            }
                          } else {
                            cta = (
                              <a className="btn" href={`/contact?intent=sales&source=user_billing_plan_change&plan=${plan.plan}`}>
                                Contact us to switch
                              </a>
                            );
                          }

                          return (
                            <div className={`price-mini${isCurrent ? ' featured' : ''}`} key={plan.plan}>
                              <div className="price-mini-body">
                                {isCurrent ? (
                                  <span className="tag purple" style={{ marginBottom: 8, display: 'inline-flex' }}>
                                    Current plan
                                  </span>
                                ) : null}
                                <h4 style={{ margin: 0 }}>
                                  {plan.plan === 'professional' && currentPlan === 'starter'
                                    ? 'Upgrade to Professional'
                                    : planDisplayName(plan.plan)}
                                </h4>
                                <div className="amt">{plan.priceLine}</div>
                                <ul>
                                  {plan.features.map((feature) => (
                                    <li key={feature}>{feature}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="price-mini-cta">{cta}</div>
                            </div>
                          );
                        })}
                      </section>

                      <section className="card soft billing-plan-includes-card">
                        <div className="panel-head">
                          <div>
                            <h3>Current plan includes</h3>
                          </div>
                        </div>
                        <ul className="plan-includes-list">
                          <li>AI phone answering</li>
                          <li>Booking request capture</li>
                          <li>Missed-call follow-up</li>
                          <li>Call summaries</li>
                          <li>SMS workflows where enabled for your plan</li>
                        </ul>
                        <p className="plan-includes-foot">Billing is managed securely by our payment provider.</p>
                      </section>
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
                    </div>
                  ) : null}
                </div>
            <div className="footer-inline">
              <span>RingBooker · {data?.shop?.name ?? 'Your business'}</span>
            </div>
          </main>
        </div>
        <UserPortalMobileTabbar active="billing" />
      </>
    </UserLayout>
  );
}
