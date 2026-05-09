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

type UserBillingResponse = {
  ok: boolean;
  shop?: {
    id: string;
    name: string;
    plan: ShopPlan;
    active: boolean;
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
      currentPeriodEnd?: string | null;
      trialEndsAt?: string | null;
      paymentMethodStatus?: 'none' | 'pending' | 'valid' | 'failed' | 'unknown';
      cancelAtPeriodEnd: boolean;
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

type BillingSubscriptionRow = NonNullable<NonNullable<UserBillingResponse['billing']>['subscription']>;

const PLAN_CATALOG: Array<{
  plan: ShopPlan;
  priceLine: string;
  features: string[];
}> = [
  {
    plan: 'starter',
    priceLine: '$79/mo',
    features: [
      'AI answers calls 24/7',
      'Booking + confirmations',
      '1 number included',
      'Basic call logs',
    ],
  },
  {
    plan: 'professional',
    priceLine: '$149/mo',
    features: [
      'Everything in Starter',
      'Reminder SMS',
      'Customer memory',
      'Bilingual summaries',
    ],
  },
  {
    plan: 'enterprise',
    priceLine: 'Custom',
    features: [
      'Multi-location setup',
      'Custom integrations',
      'Higher call volume',
      'Concierge onboarding',
    ],
  },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
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
) {
  if (!subscription) return 'Start a subscription to unlock invoices and renewals.';
  if (subscription.status === 'trialing' && typeof trialDaysRemaining === 'number') {
    return `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} left in trial`;
  }
  if (subscription.status === 'trialing') return 'Trial in progress';
  if (subscription.currentPeriodEnd) return `Renews around ${formatDate(subscription.currentPeriodEnd)}`;
  return subscription.trialEndsAt ? `Trial ends ${formatDate(subscription.trialEndsAt)}` : 'Subscription details update after billing.';
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
  return 'Required before live answering';
}

function liveAnsweringValue(enabled: boolean | undefined) {
  if (enabled === true) return 'Enabled';
  if (enabled === false) return 'Disabled';
  return 'Not available';
}

function liveAnsweringMeta(enabled: boolean | undefined, hasPayment: boolean | undefined) {
  if (enabled === true) return 'RingBooker can answer real callers';
  if (!hasPayment) return 'Add payment method to go live';
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
      return 'Paid';
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
        title: 'Add a payment method to go live',
        body: 'You can continue setup and test calls without a card. Start secure Paddle checkout when you are ready for RingBooker to answer real callers.',
      };
    case 'setup_allowed_no_payment':
      return {
        title: 'Setup and test calls are available',
        body: 'No card is needed for setup or test calls. Add a payment method only when you are ready for RingBooker to answer real callers.',
      };
    case 'payment_method_required':
      return {
        title: 'Add a payment method to go live',
        body: 'No card is needed for setup and test calls. A payment method is required before RingBooker answers real callers on your business number.',
      };
    case 'checkout_pending':
      return {
        title: 'Starting secure checkout',
        body: 'Paddle will collect your payment method. Live answering will remain off until the webhook-confirmed billing state is valid.',
      };
    case 'trialing_valid':
      return {
        title: 'Payment method added',
        body: 'Your trial is active and billing is ready. Finish forwarding verification before enabling live answering.',
      };
    case 'active':
      return {
        title: 'Subscription active',
        body: 'Billing is valid. Live answering still depends on forwarding verification and the go-live switch.',
      };
    case 'past_due':
      return {
        title: 'Billing issue blocks live answering',
        body: 'Your subscription is past due. Update billing before RingBooker can answer real callers.',
      };
    case 'paused':
      return {
        title: 'Subscription paused',
        body: 'Live answering is blocked while the subscription is paused.',
      };
    case 'canceled':
      return {
        title: 'Subscription canceled',
        body: 'Live answering is blocked. Reactivate billing before going live again.',
      };
  }
}

type BillingSectionTab = 'overview' | 'plans' | 'history';
type CheckoutNotice = 'success' | 'cancelled' | null;

function checkoutUnavailableCopy(reason?: string | null): string {
  if (reason === 'billing_checkout_disabled') {
    return 'Payment setup is temporarily unavailable. Setup and test calls still work; contact support if you are ready to go live.';
  }
  return 'Payment setup is not available for this account yet. Contact support if you are ready to go live.';
}

export function UserBillingLive() {
  const { workspace, setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<UserBillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<ShopPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<CheckoutNotice>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const [billingTab, setBillingTab] = useState<BillingSectionTab>('overview');

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
  }, [refreshBilling]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#go-live-forwarding') {
      window.location.replace(`${window.location.origin}/user/go-live#go-live-forwarding`);
    }
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    if (checkout === 'success') {
      setCheckoutNotice('success');
    } else if (checkout === 'cancelled' || checkout === 'canceled') {
      setCheckoutNotice('cancelled');
    }
  }, []);

  const subscription = data?.billing?.subscription ?? null;
  const currentPlan = subscription?.plan ?? data?.shop?.plan ?? 'starter';
  const paymentMethodStatus = data?.billing?.paymentMethodStatus ?? subscription?.paymentMethodStatus ?? 'none';
  const hasPaymentMethod = data?.billing?.hasPaymentMethod === true;
  const liveEnabled = data?.billing?.liveCallsEnabled;
  const catalog = useMemo(() => PLAN_CATALOG.find((p) => p.plan === currentPlan) ?? PLAN_CATALOG[0], [currentPlan]);

  const billingHistory = useMemo(() => {
    if (!subscription) return [];
    const rows = [];
    const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt ?? null;
    rows.push({
      date: formatDate(periodEnd),
      description: `${planDisplayName(subscription.plan)} plan`,
      amount: subscription.amount > 0 ? formatMoney(subscription.amount, subscription.currency) : '$0',
      status: getStatusLabel(subscription.status),
      tone: getStatusTone(subscription.status),
    });
    if (subscription.currentPeriodEnd) {
      rows.push({
        date: formatDate(subscription.currentPeriodEnd),
        description: 'Upcoming renewal window',
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
  const checkoutAvailable = data?.billing?.checkoutAvailable === true;
  const availableBillingIntervals = data?.billing?.availableBillingIntervals ?? ['monthly'];
  const canChooseAnnual = checkoutAvailable && availableBillingIntervals.includes('annual');
  const effectiveBillingInterval =
    billingInterval === 'annual' && canChooseAnnual ? 'annual' : 'monthly';
  const billingState = resolveBillingUiState({ subscription, hasPaymentMethod, checkoutPlan });
  const billingCopy = billingUiCopy(billingState);

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
      };
      if (!response.ok || !body.ok || !body.checkoutUrl) {
        throw new Error(body.error ?? 'checkout_failed');
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
      };
      if (!response.ok || !body.ok || !body.checkoutUrl) {
        throw new Error(body.error ?? 'checkout_failed');
      }
      window.location.href = body.checkoutUrl;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'checkout_failed');
    } finally {
      setCheckoutPlan(null);
    }
  }

  const subTagClass = `tag ${subscriptionStatusTone(subscription?.status, Boolean(subscription))}`;

  return (
    <UserLayout styles={userBillingStyles} scripts={userBillingScripts} scriptPrefix="user-billing-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="billing" />
          <main className="main billing-page">
            <UserPortalTopbar
              title="Billing"
              subtitle="Summary above; tabs for account usage, plans, and billing history. Forwarding is under Go live."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />

            {loading ? (
              <section className="card">
                <p className="sub">Loading billing details…</p>
              </section>
            ) : !data?.ok ? (
              <section className="card">
                <h3>Unable to load billing</h3>
                <p className="sub">{data?.error ?? 'unknown_error'}</p>
              </section>
            ) : (
              <>
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
                    <div className="bst-meta">{subscriptionCardMeta(subscription, data.billing?.trialDaysRemaining)}</div>
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

                {checkoutNotice === 'success' ? (
                  <section className="billing-alert-strip" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }}>
                    <p>
                      <strong>Payment method submitted.</strong> Paddle is confirming your billing status. Live answering stays off until billing is verified and forwarding setup is complete.
                    </p>
                    <a className="btn purple" href="/user/go-live#go-live-forwarding">
                      Continue go-live setup
                    </a>
                  </section>
                ) : checkoutNotice === 'cancelled' ? (
                  <section className="billing-alert-strip">
                    <p>
                      <strong>Checkout was cancelled.</strong> No payment method was added. Setup and test calls still work; add a payment method when you are ready to go live.
                    </p>
                    {checkoutAvailable ? (
                      <button type="button" className="btn purple" disabled={checkoutPlan !== null} onClick={() => void openCheckout(currentPlan)}>
                        {checkoutPlan ? 'Starting…' : 'Try again'}
                      </button>
                    ) : null}
                  </section>
                ) : null}

                {data.billing && !isEnterprisePlan && !liveEnabled && !hasPaymentMethod ? (
                  <section className="billing-alert-strip">
                    <p>
                      <strong>Add a payment method to go live.</strong> Setup and test calls still work without a card. Live answering on your business number starts only after billing, forwarding, and verification are complete.
                    </p>
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
                        className="btn purple"
                        disabled={checkoutPlan !== null}
                        onClick={() => void openCheckout(currentPlan)}
                      >
                        {checkoutPlan ? 'Starting…' : 'Add payment method'}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <button type="button" className="btn" disabled>
                          Payment setup unavailable
                        </button>
                        <span style={{ fontSize: 12 }}>{checkoutUnavailableCopy(data.billing.checkoutDisabledReason)}</span>
                      </div>
                    )}
                  </section>
                ) : null}

                <div className="billing-tab-strip" role="tablist" aria-label="Billing sections">
                  <button
                    type="button"
                    role="tab"
                    id="billing-tab-overview"
                    aria-selected={billingTab === 'overview'}
                    aria-controls="billing-panel-overview"
                    className={`billing-tab${billingTab === 'overview' ? ' active' : ''}`}
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
                    className={`billing-tab${billingTab === 'plans' ? ' active' : ''}`}
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
                    className={`billing-tab${billingTab === 'history' ? ' active' : ''}`}
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
                      {hasPaymentMethod && data.billing?.usage ? (
                        <section
                          className={`card usage-captured-card${data.billing.usage.overCapturedCallerLimit ? ' usage-captured-card--over' : ''}${data.billing.usage.nearCapturedCallerLimit && !data.billing.usage.overCapturedCallerLimit ? ' usage-captured-card--near' : ''}`}
                          style={{ marginBottom: 16 }}
                        >
                          <div className="panel-head">
                            <div>
                              <h3>Captured callers this month</h3>
                              <p className="sub">
                                {data.billing.usage.capturedCallersLimit == null
                                  ? `${data.billing.usage.capturedCallersUsed} captured callers · Custom allowance`
                                  : `${data.billing.usage.capturedCallersUsed} / ${data.billing.usage.capturedCallersLimit} captured callers`}
                              </p>
                            </div>
                            <span
                              className={`tag ${data.billing.usage.overCapturedCallerLimit ? 'orange' : data.billing.usage.nearCapturedCallerLimit ? 'orange' : 'green'}`}
                            >
                              {data.billing.usage.capturedCallerUsagePercent == null
                                ? 'Custom'
                                : `${data.billing.usage.capturedCallerUsagePercent}%`}
                            </span>
                          </div>
                          <div className="usage-progress-track" aria-hidden="true">
                            <div
                              className={`usage-progress-fill ${data.billing.usage.overCapturedCallerLimit ? 'usage-progress-fill--over' : data.billing.usage.nearCapturedCallerLimit ? 'usage-progress-fill--near' : 'usage-progress-fill--ok'}`}
                              style={{ width: `${Math.min(100, data.billing.usage.capturedCallerUsagePercent ?? 0)}%` }}
                            />
                          </div>
                          {data.billing.usage.nearCapturedCallerLimit || data.billing.usage.overCapturedCallerLimit ? (
                            <p
                              className="sub"
                              style={{
                                marginTop: 10,
                                color: data.billing.usage.overCapturedCallerLimit ? '#b91c1c' : '#92400e',
                              }}
                            >
                              {data.billing.usage.overCapturedCallerLimit
                                ? 'You have reached your monthly captured caller limit. Upgrade for more call coverage.'
                                : 'You are close to your monthly captured caller limit.'}
                            </p>
                          ) : null}
                          <p className="sub" style={{ marginTop: 8 }}>
                            Voice usage: {data.billing.usage.voiceMinutesUsed} min
                            {data.billing.usage.voiceMinutesSoftLimit
                              ? ` / ${data.billing.usage.voiceMinutesSoftLimit} soft cap`
                              : ''}{' '}
                            · Active calls: {data.billing.usage.activeLiveCalls ?? 0}/{data.billing.usage.maxConcurrentLiveCalls ?? 0}
                          </p>
                        </section>
                      ) : null}

                      {enterpriseApprovalPending ? (
                        <section className="card" style={{ marginBottom: 16, borderColor: '#ddd6fe', background: '#faf5ff' }}>
                          <h3 style={{ marginTop: 0 }}>Custom billing is managed by the RingBooker team</h3>
                          <p className="sub">
                            Your Custom setup is being prepared through sales and implementation. We will confirm contract, invoice, routing, and go-live details before live answering is enabled.
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
                            <a className="btn purple" href="/contact?topic=sales">Contact sales</a>
                            <a className="btn" href="/contact?topic=implementation">Contact implementation support</a>
                          </div>
                        </section>
                      ) : null}

                      {data?.billing && !isEnterprisePlan && !liveEnabled ? (
                        <section className="card" style={{ marginBottom: 16 }}>
                          <h3 style={{ marginTop: 0 }}>{billingCopy.title}</h3>
                          <p className="sub">{billingCopy.body}</p>
                          {data.billing.trialNoChargeUntilEndVerified ? (
                            <p className="sub">Paddle is configured to collect your payment method now and charge after the trial ends.</p>
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
                          {!checkoutAvailable ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                              <button type="button" className="btn" disabled>
                                Payment setup unavailable
                              </button>
                              <p className="sub" style={{ margin: 0 }}>
                                {checkoutUnavailableCopy(data.billing.checkoutDisabledReason)}
                              </p>
                            </div>
                          ) : ['past_due', 'paused', 'canceled'].includes(billingState) ? (
                            <button
                              type="button"
                              className="btn purple"
                              disabled={checkoutPlan !== null}
                              onClick={() => void openReactivateCheckout()}
                            >
                              {checkoutPlan ? 'Starting…' : 'Resolve billing issue'}
                            </button>
                          ) : !hasPaymentMethod ? (
                            <button
                              type="button"
                              className="btn purple"
                              disabled={checkoutPlan !== null}
                              onClick={() => void openCheckout(currentPlan)}
                            >
                              {checkoutPlan ? 'Starting…' : 'Add payment method'}
                            </button>
                          ) : null}
                        </section>
                      ) : null}

                      {checkoutError ? (
                        <section className="card" style={{ marginTop: 0 }}>
                          <h3>Checkout could not start</h3>
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
                                  className="btn purple"
                                  disabled={isBusy || !checkoutAvailable}
                                  onClick={() => void openCheckout(plan.plan)}
                                >
                                  {isBusy ? 'Starting…' : checkoutAvailable ? 'Add payment method' : 'Payment setup unavailable'}
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
                            cta = (
                              <a className="btn" href="/contact?intent=sales&source=user_billing_upgrade&plan=professional">
                                Contact us to upgrade
                              </a>
                            );
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
                                <h4 style={{ margin: 0 }}>{planDisplayName(plan.plan)}</h4>
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

                      <section className="card soft">
                        <div className="panel-head">
                          <div>
                            <h3>Current plan includes</h3>
                            <p className="sub">What you get with RingBooker on your current plan tier.</p>
                          </div>
                        </div>
                        <ul className="plan-includes-list">
                          <li>AI phone answering</li>
                          <li>Booking request capture</li>
                          <li>Missed-call follow-up</li>
                          <li>Call summaries</li>
                          <li>SMS workflows where enabled for your plan</li>
                        </ul>
                        <p className="plan-includes-foot">Billing is managed securely through Paddle.</p>
                      </section>
                    </div>
                  ) : null}

                  {billingTab === 'history' ? (
                    <div role="tabpanel" id="billing-panel-history" aria-labelledby="billing-tab-history">
                      {billingHistory.length > 0 ? (
                        <section className="card billing-history-compact" style={{ marginBottom: 16 }}>
                          <div className="panel-head">
                            <div>
                              <h3>Billing history</h3>
                              <p className="sub">Recent subscription activity and renewal timing.</p>
                            </div>
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
                              <h3>Billing history</h3>
                            </div>
                          </div>
                          <p className="sub" style={{ marginBottom: 0 }}>
                            No invoices yet. Your invoices and subscription events will appear here after your first billing
                            period.
                          </p>
                        </section>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}

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
