'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import { AdminLayout } from '@/components/admin/admin-layout';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { adminSidebarAddonStyles } from '@/components/admin/admin-sidebar-styles';
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const createDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = createDialogRef.current;
    if (!el) return;
    if (createDialogOpen) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [createDialogOpen]);

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
      setCreateDialogOpen(false);
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

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <AdminLayout
      styles={[...adminShopsStyles, ...adminSidebarAddonStyles]}
      scripts={adminShopsScripts}
      scriptPrefix="admin-shops-live"
      bodyClass="app-body"
    >
      <div className="app-shell">
        <AdminSidebar />
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Shop accounts.</h1>
              <p>Create, inspect, and monitor every salon account running on RingBooker. Rows are now action-oriented so you can move straight from a shop to detail or calls.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/admin/calls">
                All calls
              </a>
              <button type="button" className="btn ghost" onClick={() => void signOut()}>
                Sign out
              </button>
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
                <h3>All shops</h3>
                <p className="sub">Each row is clickable. Use the right-side buttons when you want to jump directly into calls for that shop.</p>
              </div>
              <button
                type="button"
                className="btn-icon purple"
                title="New shop"
                aria-label="New shop"
                onClick={() => setCreateDialogOpen(true)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M3 10l2-5h14l2 5" />
                  <path d="M4 10h16v10H4z" />
                  <path d="M9 20v-6h6v6" />
                  <path d="M12 10v8M8 14h8" />
                </svg>
              </button>
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

          <dialog
            ref={createDialogRef}
            className="rb-admin-modal"
            onClose={() => setCreateDialogOpen(false)}
          >
            <div className="rb-admin-modal-head">
              <div>
                <h3 style={{ margin: '0 0 6px' }}>New shop</h3>
                <p className="sub" style={{ margin: 0 }}>
                  Quick-create a salon account, then open detail for full setup.
                </p>
              </div>
              <button type="button" className="btn ghost" onClick={() => createDialogRef.current?.close()}>
                Close
              </button>
            </div>
            <div className="rb-admin-modal-body">
              <form onSubmit={onCreateShop} className="form-grid">
                <div className="field">
                  <label>Shop name</label>
                  <input
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Shop name"
                  />
                </div>
                <div className="field">
                  <label>Shop phone</label>
                  <input
                    required
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="+1 714 555 0100"
                  />
                </div>
                <div className="field">
                  <label>User phone</label>
                  <input
                    required
                    value={createUserPhone}
                    onChange={(e) => setCreateUserPhone(e.target.value)}
                    placeholder="+1 714 555 0199"
                  />
                </div>
                <div className="top-actions" style={{ gridColumn: '1 / -1', marginTop: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn ghost" onClick={() => createDialogRef.current?.close()}>
                    Cancel
                  </button>
                  <button className="btn purple" disabled={creating} type="submit">
                    {creating ? 'Creating…' : 'Create shop'}
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        </main>
      </div>
    </AdminLayout>
  );
}
