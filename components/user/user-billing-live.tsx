'use client';

import { useEffect, useMemo, useState } from 'react';

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
      currency: string;
      interval: 'month' | 'year';
      currentPeriodEnd?: string | null;
      trialEndsAt?: string | null;
      cancelAtPeriodEnd: boolean;
    } | null;
  };
  error?: string;
};

const PLAN_CATALOG: Array<{
  plan: ShopPlan;
  priceLabel: string;
  description: string;
  features: string[];
}> = [
  {
    plan: 'starter',
    priceLabel: '$79',
    description: 'Core phone booking for smaller salons.',
    features: ['AI answers calls 24/7', 'Booking + confirmations', '1 number included or forwarding', 'Basic call logs'],
  },
  {
    plan: 'professional',
    priceLabel: '$149',
    description: 'Best fit for active salons that need reminders and memory.',
    features: ['Everything in Starter', 'Reminder SMS', 'Customer memory', 'Bilingual user summaries'],
  },
  {
    plan: 'enterprise',
    priceLabel: 'Custom',
    description: 'Multi-location rollout with deeper integrations.',
    features: ['Multi-location setup', 'Custom integrations', 'Higher call volume', 'Concierge onboarding'],
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

  useEffect(() => {
    let active = true;
    void fetch('/api/backend/user/billing')
      .then(async (response) => (await response.json()) as UserBillingResponse)
      .then((body) => {
        if (active) setData(body);
        if (active && body.ok && body.shop) {
          setWorkspace({
            shopName: body.shop.name,
            plan: body.shop.plan,
            active: body.shop.active,
          });
        }
      })
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
  }, []);

  const subscription = data?.billing?.subscription ?? null;
  const currentPlan = subscription?.plan ?? data?.shop?.plan ?? 'starter';

  const billingHistory = useMemo(() => {
    if (!subscription) return [];
    const rows = [];
    const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt ?? null;
    rows.push({
      date: formatDate(periodEnd),
      description: `${subscription.plan[0].toUpperCase()}${subscription.plan.slice(1)} plan`,
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

  async function openCheckout(plan: ShopPlan) {
    setCheckoutPlan(plan);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/backend/user/billing/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
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
        <main className="main">
          <UserPortalTopbar
            title="Billing, plan, and growth options."
            subtitle="Manage your RingBooker subscription using normalized billing data backed by the active provider."
          />

          {loading ? (
            <section className="card">
              <p className="sub">Loading billing details...</p>
            </section>
          ) : !data?.ok ? (
            <section className="card">
              <h3>Unable to load billing</h3>
              <p className="sub">{data?.error ?? 'unknown_error'}</p>
            </section>
          ) : (
            <>
              <section className="card billing-banner">
                <div>
                  <span className={`tag ${getStatusTone(subscription?.status)}`}>
                    {subscription ? `${currentPlan} plan` : 'No active subscription'}
                  </span>
                  <h3 style={{ fontSize: 30, marginTop: 14, marginBottom: 8, letterSpacing: '-1px' }}>
                    {subscription
                      ? 'Your AI phone agent billing is live and tracked in normalized subscription state.'
                      : 'Choose a plan to activate your billing account and launch your AI phone agent.'}
                  </h3>
                  <p>
                    Provider: <strong>{data.billing?.provider.toUpperCase()}</strong>
                    {data.billing?.customer?.providerCustomerId ? ` · Customer ID ${data.billing.customer.providerCustomerId}` : ''}
                  </p>
                </div>
                <div>
                  <div className="metric" style={{ fontSize: 44 }}>
                    {subscription ? formatMoney(subscription.amount, subscription.currency) : '$0'}
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0 }}>
                      {subscription ? ` / ${subscription.interval}` : ''}
                    </span>
                  </div>
                  <div className="metric-sub" style={{ color: 'rgba(255,255,255,.72)', marginTop: 6 }}>
                    {subscription?.trialEndsAt
                      ? `Trial ends: ${formatDate(subscription.trialEndsAt)}`
                      : `Next renewal: ${formatDate(subscription?.currentPeriodEnd)}`}
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <span className={`tag ${getStatusTone(subscription?.status)}`}>{getStatusLabel(subscription?.status)}</span>
                  </div>
                </div>
              </section>

              <section className="pricing-mini" style={{ marginTop: 18 }}>
                {PLAN_CATALOG.map((plan) => {
                  const isCurrent = currentPlan === plan.plan;
                  const isBusy = checkoutPlan === plan.plan;
                  return (
                    <div className={`price-mini${isCurrent ? ' featured' : ''}`} key={plan.plan}>
                      {isCurrent ? <span className="tag purple">Current plan</span> : null}
                      <h4 style={{ marginTop: isCurrent ? 10 : 0 }}>
                        {plan.plan[0].toUpperCase()}
                        {plan.plan.slice(1)}
                      </h4>
                      <div className="amt">{plan.priceLabel}</div>
                      <p className="sub" style={{ marginBottom: 12 }}>{plan.description}</p>
                      <ul>
                        {plan.features.map((feature) => (
                          <li key={feature}>{feature}</li>
                        ))}
                      </ul>
                      <div style={{ marginTop: 16 }}>
                        <button
                          type="button"
                          className={`btn${isCurrent ? '' : ' purple'}`}
                          onClick={() => void openCheckout(plan.plan)}
                          disabled={isBusy}
                        >
                          {isBusy ? 'Starting checkout...' : isCurrent ? 'Refresh plan checkout' : 'Choose this plan'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="card">
                  <div className="panel-head">
                    <div>
                      <h3>Billing history</h3>
                      <p className="sub">Latest normalized subscription state and upcoming period dates.</p>
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
                      {billingHistory.length > 0 ? (
                        billingHistory.map((row) => (
                          <tr key={`${row.date}-${row.description}`}>
                            <td>{row.date}</td>
                            <td>{row.description}</td>
                            <td>{row.amount}</td>
                            <td><span className={`tag ${row.tone}`}>{row.status}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>No billing events available yet. Start checkout to create the first subscription period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="card soft">
                  <div className="panel-head">
                    <div>
                      <h3>What your plan covers</h3>
                      <p className="sub">Real subscription scope for the current backend implementation.</p>
                    </div>
                  </div>
                  <div className="list">
                    <div className="list-item"><div className="item-main"><div className="avatar">☎</div><div><h4>Phone agent subscription</h4><p>Monthly billing attached to business <strong>{data.shop?.name}</strong></p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">API</div><div><h4>Provider-neutral billing model</h4><p>Internal records track provider, customer, and subscription IDs separately from the business profile</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">SMS</div><div><h4>Operational messaging stays in-app</h4><p>Billing state can change providers later without breaking booking, reminder, or callback workflows</p></div></div></div>
                  </div>
                </div>
              </section>

              {checkoutError ? (
                <section className="card" style={{ marginTop: 18 }}>
                  <h3>Checkout could not start</h3>
                  <p className="sub">{checkoutError}</p>
                </section>
              ) : null}
            </>
          )}

          <div className="footer-inline">
            <span>RingBooker user portal · live billing data</span>
            <span>Provider abstraction · normalized subscriptions</span>
          </div>
        </main>
      </div>
      <UserPortalMobileTabbar active="billing" />
      </>
    </UserLayout>
  );
}
