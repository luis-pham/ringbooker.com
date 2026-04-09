'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userBillingScripts, userBillingStyles } from '@/components/user/user-billing';

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
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-inner">
            <div className="brand">
              <div className="brand-mark">
                <div className="brand-ripple r3" />
                <div className="brand-ripple r2" />
                <div className="brand-core">
                  <svg viewBox="0 0 24 24">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#fff" stroke="none" />
                  </svg>
                </div>
              </div>
              <span>RingBooker</span>
            </div>
            <div className="workspace">
              <h3>{data?.shop?.name ?? 'Loading shop...'}</h3>
              <p>
                {loading
                  ? 'Syncing subscription details...'
                  : `${(data?.billing?.provider ?? 'manual').toUpperCase()} subscription ${
                      subscription ? getStatusLabel(subscription.status).toLowerCase() : 'not connected'
                    }`}
              </p>
            </div>
            <div className="nav-section">
              <div className="nav-label">User Portal</div>
              <div className="nav-list">
                <a className="nav-item" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a>
                <a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a>
                <a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a>
                <a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a>
                <a className="nav-item active" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a>
              </div>
            </div>
            <div className="sidebar-spacer" />
            <div className="sidebar-foot">
              <strong>Provider abstraction ready.</strong>
              <small>Subscription state is normalized in RingBooker, so Paddle can be swapped later without rewriting the user portal.</small>
            </div>
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Billing, plan, and growth options.</h1>
              <p>Manage your RingBooker subscription using normalized billing data backed by the active provider.</p>
            </div>
          </div>

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
                    <div className="list-item"><div className="item-main"><div className="avatar">☎</div><div><h4>Phone agent subscription</h4><p>Monthly billing attached to shop <strong>{data.shop?.name}</strong></p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">API</div><div><h4>Provider-neutral billing model</h4><p>Internal records track provider, customer, and subscription IDs separately from the shop profile</p></div></div></div>
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
    </UserLayout>
  );
}
