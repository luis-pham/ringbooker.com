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
    /** Paying subscribers only (status = 'active') */
    payingSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    /** MRR from paying (active-only) subscriptions — projected, not collected */
    mrr: number;
    /** Sum of all shop_overage_charges WHERE status = 'charged' (confirmed collected) */
    overageRevenue: number;
    /** mrr + overageRevenue — DB-based approximation of collected revenue */
    totalCollectedDb: number;
    /** Sum of all completed Paddle transactions (null if Paddle not configured) */
    grossCollectedPaddle: number | null;
    grossCollectedPaddleCachedAt: string | null;
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
    void (async () => {
      try {
        const response = await fetch('/api/backend/admin/billing');
        let body: AdminBillingResponse;
        try {
          body = (await response.json()) as AdminBillingResponse;
        } catch {
          body = { ok: false, error: `server_error_${response.status}` };
        }
        if (active) setData(body);
      } catch {
        if (active) setData({ ok: false, error: 'network_error' });
      } finally {
        if (active) setLoading(false);
      }
    })();

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
              {/* Row 1 — Subscriber counts */}
              <section className="grid grid-3">
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy={7} r={4} /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg></div><span className="tag green">Paying</span></div><div className="stat-value">{data.metrics?.payingSubscriptions ?? 0}</div><div className="stat-meta">Paying subscribers (status: active)</div></div>
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><circle cx={12} cy={12} r={10} /><path d="M12 8v4l3 3" /></svg></div><span className="tag purple">Trialing</span></div><div className="stat-value">{data.metrics?.trialingSubscriptions ?? 0}</div><div className="stat-meta">In free trial — $0 collected yet</div></div>
                <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span className="tag orange">Past due</span></div><div className="stat-value">{data.metrics?.pastDueSubscriptions ?? 0}</div><div className="stat-meta">Past due — follow-up required</div></div>
              </section>

              {/* Row 2 — Revenue figures */}
              <section className="grid grid-3" style={{ marginTop: 14 }}>
                <div className="stat-card">
                  <div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span className="tag green">MRR</span></div>
                  <div className="stat-value">{formatMoney(data.metrics?.mrr ?? 0, 'USD')}</div>
                  <div className="stat-meta">Projected MRR — paying subscribers only</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><circle cx={12} cy={12} r={10} /><path d="M12 6v6l4 2" /></svg></div><span className="tag blue">Overage</span></div>
                  <div className="stat-value">{formatMoney(data.metrics?.overageRevenue ?? 0, 'USD')}</div>
                  <div className="stat-meta">Confirmed charged overage fees (DB)</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg></div>
                    {data.metrics?.grossCollectedPaddle != null ? <span className="tag green">Paddle</span> : <span className="tag">No data</span>}
                  </div>
                  <div className="stat-value">
                    {data.metrics?.grossCollectedPaddle != null
                      ? formatMoney(data.metrics.grossCollectedPaddle, 'USD')
                      : '—'}
                  </div>
                  <div className="stat-meta">
                    Gross collected — Paddle transactions API
                    {data.metrics?.grossCollectedPaddleCachedAt
                      ? <> · cached {formatDate(data.metrics.grossCollectedPaddleCachedAt)}</>
                      : null}
                  </div>
                </div>
              </section>

              <section className="grid grid-2" style={{ marginTop: 18 }}>
                <div className="card">
                  <div className="panel-head"><div><h3>Subscription ledger</h3><p className="sub">Live normalized billing status by business.</p></div></div>
                  <table className="table">
                    <thead><tr><th>Business</th><th>Plan</th><th>Amount</th><th>Status</th></tr></thead>
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
                  <div className="panel-head"><div><h3>Revenue accuracy guide</h3><p className="sub">What each figure represents and when it can differ from Paddle.</p></div></div>
                  <div className="list">
                    <div className="list-item"><div className="item-main"><div className="avatar">MRR</div><div><h4>Projected — not collected</h4><p>Based on paying-only subscription records. Excludes trialing users. Annual plans are normalized to monthly.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">OVG</div><div><h4>Overage — confirmed DB</h4><p>Sum of <code>shop_overage_charges</code> where <code>status = charged</code>. Reflects actual Paddle charge attempts that completed.</p></div></div></div>
                    <div className="list-item"><div className="item-main"><div className="avatar">PAD</div><div><h4>Gross — Paddle API truth</h4><p>Paginated sum of all <code>status=completed</code> transactions from the Paddle API. Cached 5 min. Matches Paddle dashboard gross revenue.</p></div></div></div>
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
