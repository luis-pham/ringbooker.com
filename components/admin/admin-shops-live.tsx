'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { adminShopsScripts, adminShopsStyles } from '@/components/admin/admin-shops';

type Shop = {
  id: string;
  name: string;
  phone_number: string;
  user_phone: string;
  plan: string;
  active: boolean;
  totalCalls?: number;
  latestCallAt?: string;
  latestCallOutcome?: string;
};

function formatDateTime(value?: string) {
  if (!value) return 'No calls yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
}

function statusTagClass(shop: Shop) {
  if (!shop.active) return 'tag red';
  if ((shop.totalCalls ?? 0) === 0) return 'tag blue';
  if (shop.latestCallOutcome === 'missed' || shop.latestCallOutcome === 'error') return 'tag orange';
  return 'tag green';
}

function statusLabel(shop: Shop) {
  if (!shop.active) return 'Inactive';
  if ((shop.totalCalls ?? 0) === 0) return 'Onboarding';
  if (shop.latestCallOutcome === 'missed') return 'Needs review';
  if (shop.latestCallOutcome === 'error') return 'Watch';
  return 'Healthy';
}

export function AdminShopsLive() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createUserPhone, setCreateUserPhone] = useState('');

  async function reloadShops() {
    const response = await fetch('/api/backend/admin/shops');
    const body = (await response.json()) as { ok: boolean; shops?: Shop[]; error?: string };
    if (!body.ok) {
      setError(body.error ?? 'unable_to_load');
      return;
    }
    setShops(body.shops ?? []);
  }

  useEffect(() => {
    void reloadShops().catch(() => setError('network_error'));
  }, []);

  async function onCreateShop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/backend/admin/shops', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          phone_number: createPhone,
          user_phone: createUserPhone,
          timezone: 'America/Los_Angeles',
          plan: 'starter',
        }),
      });
      const body = (await response.json()) as { ok: boolean; error?: string };
      if (!body.ok) {
        setError(body.error ?? 'create_failed');
        return;
      }
      setCreateName('');
      setCreatePhone('');
      setCreateUserPhone('');
      await reloadShops();
    } catch {
      setError('network_error');
    } finally {
      setCreating(false);
    }
  }

  const metrics = useMemo(() => {
    const totalCalls = shops.reduce((sum, shop) => sum + (shop.totalCalls ?? 0), 0);
    return {
      total: shops.length,
      active: shops.filter((shop) => shop.active).length,
      needsAttention: shops.filter((shop) => ['missed', 'error'].includes(shop.latestCallOutcome ?? '')).length,
      totalCalls,
    };
  }, [shops]);

  return (
    <AdminLayout styles={adminShopsStyles} scripts={adminShopsScripts} scriptPrefix="admin-shops-live" bodyClass="app-body">
      <div className="app-shell">
        <aside className="sidebar"><div className="brand"><div className="brand-mark"><div className="brand-ripple r3" /><div className="brand-ripple r2" /><div className="brand-core"><svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg></div></div><span>RingBooker Admin</span></div><div className="workspace"><h3>Operations overview</h3><p>Monitor salons, jump into details fast, and review calls without losing context.</p></div><div className="nav-label">Backoffice</div><div className="nav-list"><a className="nav-item " href="/admin"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" /></svg></div><span>Overview</span></a><a className="nav-item active" href="/admin/shops"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span>Shops</span></a><a className="nav-item " href="/admin/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span>Calls &amp; Incidents</span></a><a className="nav-item " href="/admin/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /></svg></div><span>Billing</span></a><a className="nav-item " href="/admin/users"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy={7} r={3} /><path d="M20 8v6" /><path d="M17 11h6" /></svg></div><span>Users &amp; Roles</span></a><a className="nav-item " href="/admin/system-health"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span>System Health</span></a></div><div className="sidebar-foot"><strong>Fast drill-down.</strong><small>Open a shop account or jump directly to its calls and transcript preview without leaving the admin flow.</small></div></aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Shop accounts.</h1>
              <p>Create, inspect, and monitor every salon account running on RingBooker. Rows are now action-oriented so you can move straight from a shop to detail or calls.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/calls">All calls</a>
            </div>
          </div>

          {error ? <div className="note" style={{ marginBottom: 18 }}>Unable to load shops: {error}</div> : null}

          <section className="grid grid-3">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 10l2-5h14l2 5" /><path d="M4 10h16v10H4z" /><path d="M9 20v-6h6v6" /></svg></div><span className="tag green">{metrics.active} active</span></div><div className="stat-value">{metrics.total}</div><div className="stat-meta">Total shops in the admin roster</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.1 5.18 2 2 0 0 1 5.08 3h3a2 2 0 0 1 2 1.72l.42 3a2 2 0 0 1-.57 1.73l-1.27 1.27a16 16 0 0 0 6.44 6.44l1.27-1.27a2 2 0 0 1 1.73-.57l3 .42A2 2 0 0 1 22 16.92Z" /></svg></div><span className="tag purple">Network calls</span></div><div className="stat-value">{metrics.totalCalls}</div><div className="stat-meta">Recent calls observed across loaded shops</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M3 12h4l2-5 4 10 2-5h6" /></svg></div><span className="tag orange">Review</span></div><div className="stat-value">{metrics.needsAttention}</div><div className="stat-meta">Shops with missed or errored latest calls</div></div>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>Create shop</h3>
                <p className="sub">Quick-create a new salon account, then move straight into detail setup.</p>
              </div>
            </div>
            <form onSubmit={onCreateShop} className="form-grid">
              <div className="field"><label>Shop name</label><input required value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Shop name" /></div>
              <div className="field"><label>Shop phone</label><input required value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} placeholder="+1 714 555 0100" /></div>
              <div className="field"><label>User phone</label><input required value={createUserPhone} onChange={(e) => setCreateUserPhone(e.target.value)} placeholder="+1 714 555 0199" /></div>
              <div className="field" style={{ alignSelf: 'end' }}><button className="btn purple" disabled={creating} type="submit">{creating ? 'Creating...' : 'Create shop'}</button></div>
            </form>
          </section>

          <section className="card" style={{ marginTop: 18 }}>
            <div className="panel-head">
              <div>
                <h3>All shops</h3>
                <p className="sub">Each row is clickable. Use the right-side buttons when you want to jump directly into calls for that shop.</p>
              </div>
            </div>
            {shops.length === 0 ? (
              <div className="empty">No shops found yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Calls</th>
                    <th>Latest call</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id}>
                      <td>
                        <div className="item-main">
                          <div className="avatar">{shop.name.slice(0, 2).toUpperCase()}</div>
                          <div>
                            <h4 style={{ margin: 0 }}>
                              <a href={`/admin/shops/${shop.id}`}>{shop.name}</a>
                            </h4>
                            <p>{shop.phone_number} · User {shop.user_phone}</p>
                          </div>
                        </div>
                      </td>
                      <td><span className="tag purple">{shop.plan}</span></td>
                      <td><span className={statusTagClass(shop)}>{statusLabel(shop)}</span></td>
                      <td>{shop.totalCalls ?? 0}</td>
                      <td>{formatDateTime(shop.latestCallAt)}</td>
                      <td>
                        <div className="top-actions" style={{ justifyContent: 'flex-start' }}>
                          <a className="btn" href={`/admin/shops/${shop.id}`}>Open detail</a>
                          <a className="btn ghost" href={`/admin/calls?shopId=${encodeURIComponent(shop.id)}`}>View calls</a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>
      </div>
    </AdminLayout>
  );
}
