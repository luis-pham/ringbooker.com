'use client';

import { useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalNav } from '@/components/user/user-portal-nav';

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

function IconExternalSmall() {
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden>
      <path
        d="M6 3h7v7M13 3 5 11"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Top 3 US wireless carriers — official call forwarding help (education only). */
const US_BIG3_CALL_FORWARDING_GUIDES = [
  {
    name: 'Verizon',
    url: 'https://www.verizon.com/support/call-forwarding/',
    hint: 'Wireless call forwarding FAQs, dial codes, and the My Verizon app.',
  },
  {
    name: 'AT&T',
    url: 'https://www.att.com/support/article/wireless/KM1011513',
    hint: 'Wireless call forwarding — setup is usually done from your handset.',
  },
  {
    name: 'T-Mobile',
    url: 'https://www.t-mobile.com/support/plans-features/calling-features',
    hint: 'Plans & calling features — find call or conditional forwarding for your device.',
  },
] as const;

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
      <>
      <div className="app-shell user-app-shell">
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
              <p>AI Receptionist is {data.shop?.active ? 'active' : 'paused'}. [{planLabel} plan].</p>
            </div>
            <UserPortalNav active="overview" />
            <div className="sidebar-spacer" />
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <div className="page-title">
              <h1>Overview:</h1>
              <p>Track calls, bookings, reminders, and AI performance for {shopName}.</p>
            </div>
            <div className="top-actions overview-top-actions">
              <a className="btn" href="/user/settings">Edit business info</a>
              <a className="btn purple" href="/user/bookings">View bookings</a>
              <button type="button" className="btn" onClick={signOut}>Sign out</button>
            </div>
          </div>
          <section className="grid grid-4">
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" /></svg></div><span className="tag green">Live</span></div><div className="stat-value">{data.metrics?.callCount ?? 0}</div><div className="stat-meta">Total calls logged for this shop</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><rect x={3} y={5} width={18} height={16} rx={2} /><path d="M16 3v4M8 3v4M3 10h18" /></svg></div><span className="tag purple">Booked</span></div><div className="stat-value">{data.metrics?.bookingCount ?? 0}</div><div className="stat-meta">Total bookings in your current shop</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z" /><path d="M4 8l8 6 8-6" /></svg></div><span className="tag orange">Needs follow-up</span></div><div className="stat-value">{data.metrics?.missedCalls ?? 0}</div><div className="stat-meta">Total missed calls (outcome = missed)</div></div>
            <div className="stat-card"><div className="stat-top"><div className="stat-icon"><svg viewBox="0 0 24 24"><path d="M4 19h16" /><path d="M7 15l3-3 3 2 4-5" /></svg></div><span className="tag green">{data.shop?.active ? 'Active' : 'Paused'}</span></div><div className="stat-value">{planLabel}</div><div className="stat-meta">{data.shop?.timezone ?? 'Timezone unavailable'}</div></div>
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
                  <a className="btn purple" href="/user/settings">Open</a>
                </div>
              </div>
            </div>

            <div className="card forward-guide-card">
              <div className="panel-head">
                <div>
                  <h3>Quick guide: Call forwarding</h3>
                  <p className="sub">
                    Forward your old business line to your RingBooker number so callers who still dial the old number reach your AI receptionist.
                  </p>
                </div>
                <span className="badge-right">Big 3 (US)</span>
              </div>
              {data.shop?.phone_number ? (
                <div className="forward-num" title="RingBooker destination number">
                  RingBooker number: {data.shop.phone_number}
                </div>
              ) : null}
              <p className="forward-guide-intro">
                The three largest US wireless carriers publish official wireless call-forwarding help. Open the link for the carrier that issued your SIM; dial codes and menus vary by phone and plan.
              </p>
              <div className="carrier-links">
                {US_BIG3_CALL_FORWARDING_GUIDES.map((row) => (
                  <a
                    key={row.name}
                    className="carrier-link"
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="carrier-link-row">
                      <strong>{row.name}</strong>
                      <span className="ext-ico" aria-hidden>
                        <IconExternalSmall />
                      </span>
                    </span>
                    <span className="carrier-hint carrier-hint-single">{row.hint}</span>
                  </a>
                ))}
              </div>
              <div className="carrier-callcenter-tip">
                <p className="carrier-tip-line">
                  <strong>Outside the Big 3 or outside the US:</strong> call your mobile carrier’s in-country customer support (the number on your SIM or in the carrier app) and ask how to enable call forwarding to your RingBooker number for your line and plan.
                </p>
              </div>
              <p className="forward-guide-disclaimer">
                RingBooker is not affiliated with any carrier; links are for reference only. Charges, plan limits, and feature availability depend on your contract — use the customer-care number on your SIM or in your carrier’s app when in doubt.
              </p>
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
