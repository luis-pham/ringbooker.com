'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { CallForwardingSetup } from '@/components/user/call-forwarding-setup';

import { UserLayout } from '@/components/user/user-layout';
import { userBillingScripts, userBillingStyles } from '@/components/user/user-billing';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
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
    requiresPaymentMethodBeforeGoLive?: boolean;
    trialNoChargeUntilEndVerified?: boolean;
    checkoutAvailable?: boolean;
    manageBillingAvailable?: boolean;
    forwardingNumber?: string | null;
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

export function UserBillingLive() {
  const { workspace, setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<UserBillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<ShopPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [provisionForwardingLoading, setProvisionForwardingLoading] = useState(false);
  const [provisionForwardingError, setProvisionForwardingError] = useState<string | null>(null);

  const refreshBilling = useCallback(async () => {
    const response = await fetch('/api/backend/user/billing');
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

  const showPaymentAlert = !hasPaymentMethod || !subscription;
  const forwardingNumber = data?.billing?.forwardingNumber?.trim() ?? '';

  async function provisionForwardingFromBilling() {
    setProvisionForwardingLoading(true);
    setProvisionForwardingError(null);
    try {
      const response = await fetch('/api/backend/user/phone-numbers/provision-forwarding-number', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmGoLiveIntent: true }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        forwardingNumber?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        if (body?.error === 'payment_method_required') {
          setProvisionForwardingError('Add a payment method before provisioning a forwarding number.');
        } else if (body?.error === 'confirmation_required') {
          setProvisionForwardingError('Confirmation failed. Please try again.');
        } else {
          setProvisionForwardingError(body?.error ?? 'Could not create forwarding number.');
        }
        return;
      }
      await refreshBilling();
    } finally {
      setProvisionForwardingLoading(false);
    }
  }

  async function openCheckout(plan: ShopPlan) {
    setCheckoutPlan(plan);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/backend/user/billing/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        },
        body: JSON.stringify({ plan }),
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
          <UserPortalSidebar
            active="billing"
            workspaceOverride={{
              shopName: data?.shop?.name ?? workspace.shopName,
              plan: data?.shop?.plan ?? workspace.plan,
              active: data?.shop?.active ?? workspace.active,
            }}
          />
          <main className="main billing-page">
            <UserPortalTopbar
              title="Billing"
              subtitle="Manage your plan, payment method, and subscription."
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

                {data?.billing && !liveEnabled && showPaymentAlert ? (
                  <section className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0 }}>Add a payment method to go live</h3>
                    <p className="sub">
                      No card is needed for setup and test calls. A payment method is required before RingBooker answers real callers on your business number.
                    </p>
                    {subscription ? (
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

                {data?.billing && !liveEnabled && hasPaymentMethod && !forwardingNumber ? (
                  <section className="card" style={{ marginBottom: 16 }} id="go-live-forwarding">
                    <h3 style={{ marginTop: 0 }}>Set up call forwarding</h3>
                    <p className="sub">
                      RingBooker will create a forwarding number used only behind the scenes. Your customers will keep calling your current business number.
                    </p>
                    <button
                      type="button"
                      className="btn purple"
                      disabled={provisionForwardingLoading}
                      onClick={() => void provisionForwardingFromBilling()}
                    >
                      {provisionForwardingLoading ? 'Setting up your forwarding number...' : 'Set up call forwarding'}
                    </button>
                    {provisionForwardingError ? (
                      <p className="sub" style={{ color: '#b45309', marginTop: 12 }}>
                        {provisionForwardingError}{' '}
                        <a href="/user/billing">Review billing</a>
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {data?.billing && !liveEnabled && hasPaymentMethod && forwardingNumber ? (
                  <section className="card" style={{ marginBottom: 16 }}>
                    <h3 style={{ marginTop: 0 }}>Your RingBooker forwarding number is ready</h3>
                    <p className="sub">
                      Forward missed, busy, overflow, or after-hours calls from your current business number to this RingBooker forwarding number.
                    </p>
                    <div
                      style={{
                        border: '1px solid #bfdbfe',
                        background: '#eff6ff',
                        borderRadius: 12,
                        padding: 12,
                        marginTop: 10,
                        fontSize: 14,
                        color: '#1e3a5f',
                        lineHeight: 1.5,
                      }}
                    >
                      Your customers keep calling your current business number. This forwarding number is used only behind the scenes.
                    </div>
                    <p className="sub" style={{ marginTop: 14 }}>
                      <strong>RingBooker forwarding number:</strong>{' '}
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{forwardingNumber}</span>
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, alignItems: 'center' }}>
                      <button type="button" className="btn" disabled title="Forwarding verification is coming next. Live answering stays off.">
                        I&apos;ve set up forwarding
                      </button>
                      <a href="/contact" style={{ fontWeight: 600 }}>
                        Need help? Contact support
                      </a>
                    </div>
                    <p className="sub" style={{ marginTop: 8, marginBottom: 16 }}>
                      We&apos;ll verify forwarding in a later step — RingBooker won&apos;t enable live answering yet.
                    </p>
                    <CallForwardingSetup
                      ringbookerNumber={forwardingNumber}
                      callForwardingPageUrl="/current-number/call-forwarding"
                      initialMethod="forward"
                      suppressForwardingTestCta
                      onComplete={() => {}}
                      onSkip={() => {}}
                    />
                  </section>
                ) : null}

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
                            disabled={isBusy}
                            onClick={() => void openCheckout(plan.plan)}
                          >
                            {isBusy ? 'Starting…' : 'Add payment method'}
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
                        <button
                          type="button"
                          className="btn purple"
                          disabled={isBusy}
                          onClick={() => void openCheckout('professional')}
                        >
                          {isBusy ? 'Starting…' : 'Upgrade to Professional'}
                        </button>
                      );
                    } else {
                      cta = (
                        <button
                          type="button"
                          className="btn purple"
                          disabled={isBusy}
                          onClick={() => void openCheckout(plan.plan)}
                        >
                          {isBusy ? 'Starting…' : `Choose ${planDisplayName(plan.plan)}`}
                        </button>
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

                {checkoutError ? (
                  <section className="card" style={{ marginTop: 16 }}>
                    <h3>Checkout could not start</h3>
                    <p className="sub">{checkoutError}</p>
                  </section>
                ) : null}
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
