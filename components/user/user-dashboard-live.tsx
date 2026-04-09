'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';

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
    timezone: string;
    plan: string;
    active: boolean;
  };
  error?: string;
};

export function UserDashboardLive() {
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

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/user/login';
  }

  if (loading) {
    return (
      <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-dashboard-live">
        <section className="card" style={{ margin: 24 }}>
          <p className="sub">Loading dashboard...</p>
        </section>
      </UserLayout>
    );
  }

  if (!data?.ok) {
    return (
      <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-dashboard-live">
        <section className="card" style={{ margin: 24 }}>
          <p className="sub">Unable to load user dashboard: {data?.error ?? 'unknown_error'}</p>
        </section>
      </UserLayout>
    );
  }

  return (
    <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-dashboard-live">
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
              <h3>{shopName}</h3>
              <p>AI Phone Agent is {data.shop?.active ? 'active' : 'paused'}. {planLabel} plan.</p>
            </div>
            <div className="nav-section">
              <div className="nav-label">User Portal</div>
              <div className="nav-list">
                <a className="nav-item active" href="/user"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={4} width={7} height={7} rx="1.5" /><rect x={14} y={4} width={7} height={4} rx="1.5" /><rect x={14} y={11} width={7} height={9} rx="1.5" /><rect x={3} y={14} width={7} height={6} rx="1.5" /></svg></div><span>Overview</span></a>
                <a className="nav-item" href="/user/bookings"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span>Bookings</span></a>
                <a className="nav-item" href="/user/calls"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span>Calls &amp; Transcripts</span></a>
                <a className="nav-item" href="/user/settings"><div className="nav-icon"><svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" /></svg></div><span>Settings</span></a>
                <a className="nav-item" href="/user/billing"><div className="nav-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={14} rx={2} /><path d="M3 10h18" /><path d="M7 15h4" /></svg></div><span>Billing</span></a>
              </div>
            </div>
            <div className="sidebar-spacer" />
            <div className="sidebar-foot">
              <strong>Live shop metrics enabled.</strong>
              <small>Review real bookings, calls, and missed-call recovery without leaving the panel.</small>
            </div>
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Your salon, in one glance.</h1>
              <p>Track calls, bookings, reminders, and AI performance for {shopName}.</p>
            </div>
            <div className="top-actions">
              <a className="btn" href="/user/settings">Edit business info</a>
              <a className="btn purple" href="/user/bookings">View bookings</a>
              <button type="button" className="btn" onClick={signOut}>Sign out</button>
            </div>
          </div>
          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">Live</span></div><div className="stat-value">{data.metrics?.callCount ?? 0}</div><div className="stat-meta">Calls answered by RingBooker</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">Booked</span></div><div className="stat-value">{data.metrics?.bookingCount ?? 0}</div><div className="stat-meta">Bookings tracked in your current shop</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">Needs follow-up</span></div><div className="stat-value">{data.metrics?.missedCalls ?? 0}</div><div className="stat-meta">Missed calls still waiting for recovery</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">{data.shop?.active ? 'Active' : 'Paused'}</span></div><div className="stat-value">{planLabel}</div><div className="stat-meta">{data.shop?.timezone ?? 'Timezone unavailable'}</div></div>
          </section>
          <section className="call-grid" style={{ marginTop: 18 }}>
            <div className="card call-live">
              <div className="live-label"><span className="dot" /> Shop overview</div>
              <div className="live-name">{shopName}</div>
              <div className="live-copy">Your user portal styling is back on this live dashboard, and the numbers below now come from the real `/api/backend/user/dashboard` response.</div>
              <div className="subtitle-box"><div className="mini">Current snapshot</div><p>{data.metrics?.callCount ?? 0} calls answered, {data.metrics?.bookingCount ?? 0} bookings, {data.metrics?.missedCalls ?? 0} missed calls needing attention.</p></div>
              <div className="wave"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
            </div>
            <div className="card soft">
              <div className="panel-head"><div><h3>Quick actions</h3><p className="sub">Jump straight into the shop controls that matter most.</p></div><span className="badge-right">User portal</span></div>
              <div className="list">
                <div className="list-item"><div className="item-main"><div className="avatar">BK</div><div><h4>Open bookings</h4><p>Review upcoming appointments and confirmations.</p></div></div><a className="btn" href="/user/bookings">Go</a></div>
                <div className="list-item"><div className="item-main"><div className="avatar">CL</div><div><h4>Review call logs</h4><p>Inspect calls, transcripts, and missed-call recovery.</p></div></div><a className="btn" href="/user/calls">Go</a></div>
                <div className="list-item"><div className="item-main"><div className="avatar">ST</div><div><h4>Update business settings</h4><p>Hours, services, AI greeting, and transfer rules.</p></div></div><a className="btn purple" href="/user/settings">Open</a></div>
              </div>
            </div>
          </section>
          <div className="footer-inline"><span>RingBooker shop panel</span><span>Live data + restored shared styling</span></div>
        </main>
      </div>
    </UserLayout>
  );
}
