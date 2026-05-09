'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { useUserWorkspace } from '@/components/user/user-workspace-context';

type GoLiveDashboardPrimaryCta =
  | 'add_payment_method'
  | 'set_up_call_forwarding'
  | 'test_forwarding_setup'
  | 'enable_live_answering';

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
  onboardingRequired?: boolean;
  onboardingCompleted?: boolean;
  usage?: {
    capturedCallersUsed: number;
    capturedCallersLimit: number | null;
    capturedCallerUsagePercent: number | null;
    voiceMinutesUsed: number;
    voiceMinutesSoftLimit: number | null;
    nearCapturedCallerLimit: boolean;
    overCapturedCallerLimit: boolean;
    activeLiveCalls: number;
    maxConcurrentLiveCalls: number;
  };
  goLive?: {
    liveCallsEnabled: boolean;
    primaryCta: GoLiveDashboardPrimaryCta | null;
    forwardingSetupVerified: boolean;
    hasForwardingNumber: boolean;
    paymentMethodValid: boolean;
    subscriptionActiveLike: boolean;
    blockReason?: string;
    commercialGoLiveApproved?: boolean;
    commercialApprovalRequired?: boolean;
  } | null;
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
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [forwardingTestLoading, setForwardingTestLoading] = useState(false);
  const [enableLiveLoading, setEnableLiveLoading] = useState(false);
  const [goLiveActionMessage, setGoLiveActionMessage] = useState<string | null>(null);
  const [testCallStatus, setTestCallStatus] = useState<string | null>(null);
  const [testCallLoading, setTestCallLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    const response = await fetch('/api/backend/user/dashboard');
    const body = (await response.json()) as UserDashboardResponse;
    setData(body);
  }, []);

  useEffect(() => {
    let active = true;
    void loadDashboard()
      .catch(() => {
        if (active) setData({ ok: false, error: 'network_error' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!data?.ok || !data.shop || data.onboardingRequired) return;
    if (!data.goLive?.liveCallsEnabled) {
      setShowWelcomeBanner(false);
      return;
    }
    const startedKey = `ringbooker_welcome_started_${data.shop.id}`;
    const dismissedKey = `ringbooker_welcome_dismissed_${data.shop.id}`;
    try {
      const startedAt = Number(localStorage.getItem(startedKey) ?? '0');
      const dismissedAt = Number(localStorage.getItem(dismissedKey) ?? '0');
      const within24Hours = startedAt > 0 && Date.now() - startedAt < 24 * 60 * 60 * 1000;
      setShowWelcomeBanner(within24Hours && dismissedAt < startedAt);
    } catch {
      setShowWelcomeBanner(false);
    }
  }, [data]);

  const shopName = data?.shop?.name ?? 'Your business';
  const planLabel = useMemo(() => {
    const raw = data?.shop?.plan ?? 'starter';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [data?.shop?.plan]);

  const liveAnsweringOn = data?.goLive?.liveCallsEnabled === true;
  const enterpriseApprovalPending = data?.goLive?.commercialApprovalRequired === true;

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

  function dismissWelcomeBanner() {
    if (data?.shop?.id) {
      try {
        localStorage.setItem(`ringbooker_welcome_dismissed_${data.shop.id}`, String(Date.now()));
      } catch {
        // ignore localStorage failures
      }
    }
    setShowWelcomeBanner(false);
  }

  async function runForwardingConnectivityCheck() {
    setGoLiveActionMessage(null);
    setForwardingTestLoading(true);
    try {
      const response = await fetch('/api/backend/user/go-live/start-forwarding-test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        instruction?: string;
      } | null;
      if (!response.ok || !body?.ok) {
        if (body?.error === 'forwarding_number_required') {
          setGoLiveActionMessage(body.message ?? 'Provision your RingBooker forwarding number first.');
        } else if (body?.error === 'payment_method_required') {
          setGoLiveActionMessage(body.message ?? 'Add a valid payment method on the Billing page first.');
        } else {
          setGoLiveActionMessage(body?.message ?? 'Forwarding test could not start. Try again from your dashboard.');
        }
        return;
      }
      setGoLiveActionMessage(
        `${body.instruction ?? 'Call your current business number from another phone and let it forward to RingBooker.'} This page updates when RingBooker receives the forwarded call.`,
      );
      await loadDashboard();
    } catch {
      setGoLiveActionMessage('Network error. Please try again.');
    } finally {
      setForwardingTestLoading(false);
    }
  }

  async function requestDashboardTestCall() {
    setTestCallStatus(null);
    setTestCallLoading(true);
    try {
      const response = await fetch('/api/backend/user/test-calls/call-me', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string } | null;
      if (response.ok && body?.ok) {
        setTestCallStatus('Test call started. Please answer your phone.');
        return;
      }
      setTestCallStatus(body?.message ?? body?.error ?? 'Could not start a test call.');
    } catch {
      setTestCallStatus('Network error. Please try again.');
    } finally {
      setTestCallLoading(false);
    }
  }

  async function enableLiveAnswering() {
    setGoLiveActionMessage(null);
    setEnableLiveLoading(true);
    try {
      const response = await fetch('/api/backend/user/go-live/enable', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!response.ok || !body?.ok) {
        setGoLiveActionMessage(body?.message ?? 'Could not enable live answering yet.');
        return;
      }
      await loadDashboard();
    } catch {
      setGoLiveActionMessage('Network error. Please try again.');
    } finally {
      setEnableLiveLoading(false);
    }
  }

  function renderGoLivePrimaryControl() {
    const cta = data?.goLive?.primaryCta;
    if (!cta) return null;
    switch (cta) {
      case 'add_payment_method':
        return (
          <a className="btn purple" href="/user/billing">
            Add payment method to go live
          </a>
        );
      case 'set_up_call_forwarding':
        return (
          <a className="btn purple" href="/user/settings#go-live-forwarding">
            Set up call forwarding
          </a>
        );
      case 'test_forwarding_setup':
        return (
          <button
            type="button"
            className="btn purple"
            disabled={forwardingTestLoading}
            onClick={() => void runForwardingConnectivityCheck()}
          >
            {forwardingTestLoading ? 'Starting forwarding test…' : 'Test forwarding setup'}
          </button>
        );
      case 'enable_live_answering':
        return (
          <button
            type="button"
            className="btn purple"
            disabled={enableLiveLoading}
            onClick={() => void enableLiveAnswering()}
          >
            {enableLiveLoading ? 'Enabling…' : 'Enable live answering'}
          </button>
        );
      default:
        return null;
    }
  }

  const showGoLiveBanner =
    data?.ok &&
    !data.onboardingRequired &&
    data.goLive &&
    data.goLive.primaryCta !== null &&
    !data.goLive.liveCallsEnabled &&
    !enterpriseApprovalPending;

  return (
    <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-dashboard-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="overview" />
          <main className="main">
            <UserPortalTopbar
              title={shopName}
              subtitle="Track calls, bookings, and reminders."
              actions={
                <div className="overview-top-actions">
                  <a className="btn" href="/user/settings">
                    Edit business info
                  </a>
                  <a className="btn purple" href="/user/bookings">
                    View bookings
                  </a>
                  <button type="button" className="btn" onClick={signOut}>
                    Sign out
                  </button>
                </div>
              }
            />
            {loading ? (
              <section className="card" style={{ marginBottom: 18 }}>
                <p className="sub">Loading dashboard...</p>
              </section>
            ) : !data?.ok ? (
              <section className="card" style={{ marginBottom: 18 }}>
                <p className="sub">Unable to load user dashboard: {data?.error ?? 'unknown_error'}</p>
              </section>
            ) : (
              <>
            {enterpriseApprovalPending ? (
              <section className="card" style={{ marginBottom: 18, borderColor: '#ddd6fe', background: '#faf5ff' }}>
                <div className="panel-head">
                  <div>
                    <h3>Your Custom setup is being prepared</h3>
                    <p className="sub">
                      RingBooker is reviewing your locations, routing rules, and implementation plan. Our team will confirm your go-live timeline before live answering is enabled.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
                  <a className="btn purple" href="/contact?topic=implementation">Contact implementation support</a>
                  <a className="btn" href="/contact?topic=onboarding-call">Schedule onboarding call</a>
                </div>
              </section>
            ) : null}
            {showGoLiveBanner ? (
              <section className="card dashboard-banner-go-live" style={{ marginBottom: 18 }}>
                <div className="panel-head">
                  <div>
                    <h3>RingBooker is set up, but not live yet.</h3>
                    <p className="sub">
                      You can review test calls and summaries. Add a payment method when you&apos;re ready for RingBooker to answer real
                      callers on your business number. Your customers keep calling your current business number until you complete billing,
                      forwarding, and verification below.
                    </p>
                    {goLiveActionMessage ? (
                      <p className="sub" style={{ color: '#b45309', marginTop: 8 }}>
                        {goLiveActionMessage}
                      </p>
                    ) : null}
                    {testCallStatus ? (
                      <p className="sub" style={{ marginTop: 8 }}>
                        {testCallStatus}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
                  {renderGoLivePrimaryControl()}
                  <button type="button" className="btn" disabled={testCallLoading} onClick={() => void requestDashboardTestCall()}>
                    {testCallLoading ? 'Calling…' : 'Run another test call'}
                  </button>
                </div>
              </section>
            ) : null}
            {showWelcomeBanner && liveAnsweringOn ? (
              <section className="card" style={{ marginBottom: 18, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                <div className="panel-head">
                  <div>
                    <h3>🎉 Live answering is on</h3>
                    <p className="sub">
                      RingBooker can pick up forwarded calls on your current business number. You can keep refining services and rules
                      anytime.
                    </p>
                  </div>
                  <button className="btn" type="button" onClick={dismissWelcomeBanner}>
                    Dismiss ×
                  </button>
                </div>
              </section>
            ) : null}
            <section className="grid grid-4">
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" />
                    </svg>
                  </div>
                  <span className={`tag ${liveAnsweringOn ? 'green' : 'orange'}`}>
                    {liveAnsweringOn ? 'Live answering' : 'Not live'}
                  </span>
                </div>
                <div className="stat-value">{data?.metrics?.callCount ?? 0}</div>
                <div className="stat-meta">Total calls logged for this business</div>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <rect x={3} y={5} width={18} height={16} rx={2} />
                      <path d="M16 3v4M8 3v4M3 10h18" />
                    </svg>
                  </div>
                  <span className="tag purple">Booked</span>
                </div>
                <div className="stat-value">{data?.metrics?.bookingCount ?? 0}</div>
                <div className="stat-meta">Total bookings in your current business</div>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 6h16v12H4z" />
                      <path d="M4 8l8 6 8-6" />
                    </svg>
                  </div>
                  <span className="tag orange">Needs follow-up</span>
                </div>
                <div className="stat-value">{data?.metrics?.missedCalls ?? 0}</div>
                <div className="stat-meta">Total missed calls (outcome = missed)</div>
              </div>
              <div className="stat-card">
                <div className="stat-top">
                  <div className="stat-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M4 19h16" />
                      <path d="M7 15l3-3 3 2 4-5" />
                    </svg>
                  </div>
                  <span className="tag green">{data?.shop?.active ? 'Active' : 'Paused'}</span>
                </div>
                <div className="stat-value">{planLabel}</div>
                <div className="stat-meta">{data?.shop?.timezone ?? 'Timezone unavailable'}</div>
              </div>
            </section>
            {data?.usage ? (
              <section
                className={`card usage-captured-card${data.usage.overCapturedCallerLimit ? ' usage-captured-card--over' : ''}${data.usage.nearCapturedCallerLimit && !data.usage.overCapturedCallerLimit ? ' usage-captured-card--near' : ''}`}
                style={{ marginTop: 18 }}
              >
                <div className="panel-head">
                  <div>
                    <h3>Captured callers this month</h3>
                    <p className="sub">
                      {data.usage.capturedCallersLimit == null
                        ? `${data.usage.capturedCallersUsed} captured callers · Custom allowance`
                        : `${data.usage.capturedCallersUsed} / ${data.usage.capturedCallersLimit} captured callers`}
                    </p>
                  </div>
                  <span className={`tag ${data.usage.overCapturedCallerLimit ? 'orange' : data.usage.nearCapturedCallerLimit ? 'orange' : 'green'}`}>
                    {data.usage.capturedCallerUsagePercent == null ? 'Custom' : `${data.usage.capturedCallerUsagePercent}%`}
                  </span>
                </div>
                <div className="usage-progress-track" aria-hidden="true">
                  <div
                    className={`usage-progress-fill ${data.usage.overCapturedCallerLimit ? 'usage-progress-fill--over' : data.usage.nearCapturedCallerLimit ? 'usage-progress-fill--near' : 'usage-progress-fill--ok'}`}
                    style={{ width: `${Math.min(100, data.usage.capturedCallerUsagePercent ?? 0)}%` }}
                  />
                </div>
                {data.usage.nearCapturedCallerLimit || data.usage.overCapturedCallerLimit ? (
                  <p className="sub" style={{ marginTop: 10, color: data.usage.overCapturedCallerLimit ? '#b91c1c' : '#92400e' }}>
                    {data.usage.overCapturedCallerLimit
                      ? 'You have reached your monthly captured caller limit. Upgrade for more call coverage.'
                      : 'You are close to your monthly captured caller limit.'}
                  </p>
                ) : null}
                <p className="sub" style={{ marginTop: 8 }}>
                  Voice usage: {data.usage.voiceMinutesUsed} min{data.usage.voiceMinutesSoftLimit ? ` / ${data.usage.voiceMinutesSoftLimit} soft cap` : ''} · Active calls: {data.usage.activeLiveCalls}/{data.usage.maxConcurrentLiveCalls}
                </p>
              </section>
            ) : null}
            <section className="call-grid" style={{ marginTop: 18 }}>
              <div className="card soft">
                <div className="panel-head">
                  <div>
                    <h3>Quick actions</h3>
                    <p className="sub">Jump straight into the business controls that matter most.</p>
                  </div>
                  <span className="badge-right">User portal</span>
                </div>
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
                    <a className="btn" href="/user/bookings">
                      Go
                    </a>
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
                    <a className="btn" href="/user/calls">
                      Go
                    </a>
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
                    <a className="btn" href="/user/settings">
                      Go
                    </a>
                  </div>
                </div>
              </div>
            </section>
            <div className="footer-inline">
              <span>RingBooker business panel</span>
              <span>Live data + restored shared styling</span>
            </div>
              </>
            )}
          </main>
        </div>
        <UserPortalMobileTabbar active="overview" />
      </>
    </UserLayout>
  );
}
