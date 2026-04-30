'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { useUserWorkspace } from '@/components/user/user-workspace-context';

type UserDashboardResponse = {
  ok: boolean;
  metrics?: {
    bookingCount: number;
    callCount: number;
    missedCalls: number;
  };
  shop?: {
    id: string;
    name: string;
    phone_number?: string;
    timezone: string;
    plan: string;
    active: boolean;
  };
  error?: string;
};

function IconQuickBookings() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
      <rect x={3} y={4} width={18} height={18} rx={2} fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M16 2v4M8 2v4M3 10h18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function IconQuickCalls() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </svg>
  );
}

function IconQuickSettings() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        d="M4 21v-7M4 10V3M12 21v-9M12 13V3M20 21v-5M20 16V3"
      />
      <circle cx={4} cy={14} r={2} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={12} cy={8} r={2} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={20} cy={17} r={2} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );
}

export function UserDashboardLive() {
  const { setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<UserDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/backend/user/dashboard')
      .then(async (response) => (await response.json()) as UserDashboardResponse)
      .then((body) => setData(body))
      .finally(() => setLoading(false));
  }, []);

  const shopName = data?.shop?.name ?? 'Your shop';
  const planLabel = useMemo(() => {
    const raw = data?.shop?.plan ?? 'starter';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [data?.shop?.plan]);

  useEffect(() => {
    if (!data?.ok || !data.shop) return;
    setWorkspace({
      shopName: data.shop.name,
      plan: data.shop.plan,
      active: data.shop.active,
    });
  }, [data, setWorkspace]);

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/user/login';
  }

  return (
    <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-dashboard-live">
      <>
      <div className="app-shell user-app-shell">
        <UserPortalSidebar
          active="overview"
          workspaceOverride={{ shopName, plan: data?.shop?.plan ?? 'starter', active: data?.shop?.active ?? true }}
        />
        <main className="main">
          {loading ? (
            <section className="card" style={{ marginBottom: 18 }}>
              <p className="sub">Loading dashboard...</p>
            </section>
          ) : !data?.ok ? (
            <section className="card" style={{ marginBottom: 18 }}>
              <p className="sub">Unable to load user dashboard: {data?.error ?? 'unknown_error'}</p>
            </section>
          ) : null}
          <UserPortalTopbar
            title={shopName}
            subtitle="Track calls, bookings, and reminders."
            actions={<div className="overview-top-actions">
              <a className="btn" href="/user/settings">Edit business info</a>
              <a className="btn purple" href="/user/bookings">View bookings</a>
              <button type="button" className="btn" onClick={signOut}>Sign out</button>
            </div>}
          />
          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">Live</span></div><div className="stat-value">{data?.metrics?.callCount ?? 0}</div><div className="stat-meta">Total calls logged for this shop</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">Booked</span></div><div className="stat-value">{data?.metrics?.bookingCount ?? 0}</div><div className="stat-meta">Total bookings in your current shop</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">Needs follow-up</span></div><div className="stat-value">{data?.metrics?.missedCalls ?? 0}</div><div className="stat-meta">Total missed calls (outcome = missed)</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">{data?.shop?.active ? 'Active' : 'Paused'}</span></div><div className="stat-value">{planLabel}</div><div className="stat-meta">{data?.shop?.timezone ?? 'Timezone unavailable'}</div></div>
          </section>
          <section className="call-grid" style={{ marginTop: 18 }}>
            <div className="card soft">
              <div className="panel-head"><div><h3>Quick actions</h3><p className="sub">Jump straight into the shop controls that matter most.</p></div><span className="badge-right">User portal</span></div>
              <div className="list">
                <div className="list-item">
                  <div className="item-main">
                    <div className="avatar quick-avatar--bookings" aria-hidden title="Bookings">
                      <IconQuickBookings />
                    </div>
                    <div>
                      <h4>Open bookings</h4>
                      <p>Review upcoming appointments and confirmations.</p>
                    </div>
                  </div>
                  <a className="btn" href="/user/bookings">Go</a>
                </div>
                <div className="list-item">
                  <div className="item-main">
                    <div className="avatar quick-avatar--calls" aria-hidden title="Calls">
                      <IconQuickCalls />
                    </div>
                    <div>
                      <h4>Review call logs</h4>
                      <p>Inspect calls, transcripts, and missed-call recovery.</p>
                    </div>
                  </div>
                  <a className="btn" href="/user/calls">Go</a>
                </div>
                <div className="list-item">
                  <div className="item-main">
                    <div className="avatar quick-avatar--settings" aria-hidden title="Settings">
                      <IconQuickSettings />
                    </div>
                    <div>
                      <h4>Update business settings</h4>
                      <p>Hours, services, AI greeting, and transfer rules.</p>
                    </div>
                  </div>
                  <a className="btn" href="/user/settings">Go</a>
                </div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker shop panel</span><span>Live data + restored shared styling</span></div>
        </main>
      </div>
      <UserPortalMobileTabbar active="overview" />
      </>
    </UserLayout>
  );
}
