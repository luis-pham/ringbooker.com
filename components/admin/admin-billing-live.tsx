'use client';

import { useEffect, useState } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
import { adminBillingScripts, adminBillingStyles } from '@/components/admin/admin-billing';

type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused'
  | 'unknown';

type AdminBillingResponse = {
  ok: boolean;
  metrics?: {
    subscriptionCount: number;
    activeSubscriptions: number;
    pastDueSubscriptions: number;
    mrr: number;
  };
  subscriptions?: Array<{
    id: string;
    shopId: string;
    shopName: string;
    provider: 'paddle' | 'stripe' | 'manual';
    plan: 'starter' | 'professional' | 'enterprise';
    status: BillingSubscriptionStatus;
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    currentPeriodEnd?: string | null;
  }>;
  error?: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getStatusTone(status: BillingSubscriptionStatus) {
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
      return 'blue';
  }
}

export function AdminBillingLive() {
  const [data, setData] = useState<AdminBillingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch('/api/backend/admin/billing')
      .then(async (response) => (await response.json()) as AdminBillingResponse)
      .then((body) => {
        if (active) setData(body);
      })
      .catch(() => {
        if (active) setData({ ok: false, error: 'network_error' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminLayout styles={[...adminBillingStyles, ...adminSidebarAddonStyles]} scripts={adminBillingScripts} scriptPrefix="admin-billing-live" bodyClass="app-body">
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Billing operations.</h1>
              <p>Track subscriptions, revenue, conversion, and provider-level readiness from normalized backend records.</p>
            </div>
          </div>

          {loading ? (
            <section className="card"><p className="sub">Loading billing operations...</p></section>
          ) : !data?.ok ? (
            <section className="card"><h3>Unable to load billing</h3><p className="sub">{data?.error ?? 'unknown_error'}</p></section>
          ) : (
            <>
              <section className="grid grid-3">
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag green">MRR</span></div><div className="stat-value">{formatMoney(data.metrics?.mrr ?? 0, 'USD')}</div><div className="stat-meta">Normalized monthly recurring revenue</div></div>
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span className="tag purple">Live</span></div><div className="stat-value">{data.metrics?.activeSubscriptions ?? 0}</div><div className="stat-meta">Active or trialing subscriptions</div></div>
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span className="tag orange">Attention</span></div><div className="stat-value">{data.metrics?.pastDueSubscriptions ?? 0}</div><div className="stat-meta">Past due subscriptions requiring follow-up</div></div>
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="card">
                  <div className="panel-head"><div><h3>Subscription ledger</h3><p className="sub">Live normalized billing status by shop.</p></div></div>
                  <table className="table">
                    <thead><tr><th>Shop</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {data.subscriptions && data.subscriptions.length > 0 ? (
                        data.subscriptions.map((subscription) => (
                          <tr key={subscription.id}>
                            <td>
                              <strong>{subscription.shopName}</strong>
                              <div className="sub" style={{ marginTop: 4 }}>{subscription.provider.toUpperCase()} · renews {formatDate(subscription.currentPeriodEnd)}</div>
                            </td>
                            <td>{subscription.plan}</td>
                            <td>{formatMoney(subscription.amount, subscription.currency)} / {subscription.interval}</td>
                            <td><span className={`tag ${getStatusTone(subscription.status)}`}>{subscription.status}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4}>No subscriptions synced yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="card soft">
                  <div className="panel-head"><div><h3>Migration-safe billing model</h3><p className="sub">What is already live in the current implementation.</p></div></div>
                  <div className="list">
                    <div className="list-item"><div className="item-main"><div className="avatar">DB</div><div><h4>Provider mapping tables</h4><p>`billing_customers` and `billing_subscriptions` are separate from `shops`, so provider IDs stay isolated.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">WEB</div><div><h4>Webhook normalization</h4><p>Paddle webhook events update internal billing state first, then sync plan and activation to the shop record.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">API</div><div><h4>Admin and user billing APIs</h4><p>Both panels read normalized data, which reduces future migration work when Stripe or another provider is added.</p></div></div></div>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </AdminLayout>
  );
}
