'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { useUserWorkspace } from '@/components/user/user-workspace-context';
import { CUSTOM_MANAGED_SETUP_ITEMS, ENTERPRISE_PENDING_OVERVIEW_STATUS_LINES } from '@/components/user/user-plan-ux-copy';
import { formatShopDateTime, getShopTimezone } from '@/src/shared/timezone';

type GoLiveDashboardPrimaryCta =
  | 'add_payment_method'
  | 'set_up_call_forwarding'
  | 'test_forwarding_setup'
  | 'enable_live_answering';

export type UserDashboardResponse = {
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
  overviewRail?: UserDashboardOverviewRail;
  error?: string;
};

type UserDashboardOverviewRail =
  | {
      variant: 'setup';
      title: string;
      subtitle?: string;
      checklist: Array<{ id: string; title: string; done: boolean; href: string; detail?: string }>;
    }
  | {
      variant: 'live';
      title: string;
      subtitle?: string;
      health: Array<{
        id: string;
        label: string;
        state: 'ok' | 'warn' | 'neutral';
        detail?: string;
        href?: string;
      }>;
      recentCalls: Array<{
        requestId?: string;
        startedAt?: string;
        callerPhone?: string;
        outcome?: string;
        subtitle?: string | null;
      }>;
      tip?: string;
    };

function formatOverviewPhone(phone: string | undefined): string {
  if (!phone?.trim()) return 'Unknown caller';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const n = digits.slice(1);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatOverviewOutcome(outcome: string | undefined): string {
  if (!outcome) return 'Logged';
  const map: Record<string, string> = {
    missed: 'Missed',
    completed: 'Completed',
    transferred_to_owner: 'Transferred',
    booking_created: 'Booking created',
    booking_link_sent: 'Booking link sent',
    voicemail: 'Voicemail',
    abandoned: 'Abandoned',
    failed: 'Failed',
  };
  return map[outcome] ?? outcome.replace(/_/g, ' ');
}

function formatOverviewWhen(iso: string | undefined, timeZone: string): string {
  if (!iso) return '';
  return formatShopDateTime(iso, timeZone);
}

function truncateOverviewText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Full KPI dashboard only after live answering is on — keeps onboarding / go-live focused on next steps. */
function userOverviewPhase(data: UserDashboardResponse | null): 'onboarding' | 'activation' | 'live' | null {
  if (!data?.ok) return null;
  if (data.onboardingRequired) return 'onboarding';
  if (data.goLive?.liveCallsEnabled === true) return 'live';
  return 'activation';
}

function DashboardOverviewRailCard(props: { rail: UserDashboardOverviewRail; shopTimezone: string }) {
  const { rail, shopTimezone } = props;

  if (rail.variant === 'setup') {
    return (
      <section className="card soft overview-rail-card">
        <div className="panel-head" style={{ marginBottom: 14 }}>
          <div>
            <h3>{rail.title}</h3>
            {rail.subtitle ? <p className="sub">{rail.subtitle}</p> : null}
          </div>
        </div>
        <ul className="overview-rail-checklist">
          {rail.checklist.map((step) => (
            <li key={step.id} className={`overview-rail-step ${step.done ? 'done' : ''}`}>
              <span className="overview-rail-step-mark" aria-hidden />
              <div>
                <p className="overview-rail-step-title">
                  {step.done ? (
                    step.title
                  ) : (
                    <a href={step.href}>{step.title}</a>
                  )}
                </p>
                {!step.done ? <p className="overview-rail-step-meta">{step.detail ?? 'Tap to open and complete.'}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="card soft overview-rail-card">
      <div className="panel-head" style={{ marginBottom: 14 }}>
        <div>
          <h3>{rail.title}</h3>
          {rail.subtitle ? <p className="sub">{rail.subtitle}</p> : null}
        </div>
      </div>
      <div className="overview-rail-health">
        {rail.health.map((row) => (
          <div key={row.id} className="overview-rail-health-row">
            <span className={`overview-rail-dot ${row.state}`} title={row.state} aria-hidden />
            <div className="overview-rail-health-main">
              <div className="overview-rail-health-label">{row.label}</div>
              <div className="overview-rail-health-detail">
                {row.detail ? <span>{row.detail}</span> : null}
                {row.href ? (
                  <>
                    {row.detail ? ' · ' : null}
                    <a href={row.href}>Open</a>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {rail.recentCalls.length > 0 ? (
        <div className="overview-rail-recent">
          <h4 className="overview-rail-recent-title">Recent calls</h4>
          <div className="overview-rail-calls">
            {rail.recentCalls.map((call, index) => {
              const key = call.requestId ?? `${call.startedAt ?? 'call'}-${index}`;
              const line1 = `${formatOverviewPhone(call.callerPhone)} · ${formatOverviewWhen(call.startedAt, shopTimezone) || 'Recent'}`;
              const line2Parts = [formatOverviewOutcome(call.outcome)];
              if (call.subtitle?.trim()) line2Parts.push(truncateOverviewText(call.subtitle, 72));
              return (
                <a key={key} href="/user/calls" className="overview-rail-call">
                  <div className="overview-rail-call-main">{line1}</div>
                  <div className="overview-rail-call-sub">{line2Parts.join(' · ')}</div>
                </a>
              );
            })}
          </div>
          <a className="subtle-link" href="/user/calls" style={{ marginTop: 12, display: 'inline-block' }}>
            View all calls
          </a>
        </div>
      ) : null}
      {rail.tip ? <p className="overview-rail-tip">{rail.tip}</p> : null}
    </section>
  );
}

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

export function UserDashboardLive({ initialData = null }: { initialData?: UserDashboardResponse | null }) {
  const { setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<UserDashboardResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
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
    if (initialData) return;
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
  }, [initialData, loadDashboard]);

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

  const shopName = data?.shop?.name ?? (loading ? 'Overview' : 'Your business');
  const planLabel = useMemo(() => {
    const raw = data?.shop?.plan ?? 'starter';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [data?.shop?.plan]);

  const liveAnsweringOn = data?.goLive?.liveCallsEnabled === true;
  const enterpriseApprovalPending = data?.goLive?.commercialApprovalRequired === true;
  const isEnterprisePlan = data?.shop?.plan === 'enterprise';

  const overviewPhase = useMemo(() => userOverviewPhase(data), [data]);
  /** While loading, `data` is null so phase is unknown — do not assume the full KPI layout (avoids a flash). */
  const dashboardReady = !loading && data?.ok === true;
  const simplifiedOverview =
    dashboardReady && (overviewPhase === 'onboarding' || overviewPhase === 'activation');

  const topbarSubtitle = useMemo(() => {
    if (!data?.ok) return 'Track calls, bookings, and reminders.';
    if (data.onboardingRequired) return "Complete setup — then we'll walk you through go-live.";
    if (data.goLive?.commercialApprovalRequired) return 'Custom plan: we enable live answering after approval.';
    if (!liveAnsweringOn) return 'Next: finish go-live so RingBooker can answer your business line.';
    return 'Track calls, bookings, and reminders.';
  }, [data?.ok, data?.onboardingRequired, data?.goLive?.commercialApprovalRequired, liveAnsweringOn]);

  useEffect(() => {
    if (!data?.ok || !data.shop) return;
    setWorkspace({
      shopName: data.shop.name,
      plan: data.shop.plan,
      active: data.shop.active,
    });
  }, [data, setWorkspace]);

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
          <a className="btn user-save" href="/user/billing">
            Start 14-day trial
          </a>
        );
      case 'set_up_call_forwarding':
        return (
          <a className="btn purple" href="/user/go-live#go-live-forwarding">
            Set up call forwarding
          </a>
        );
      case 'test_forwarding_setup':
        return (
          <button
            type="button"
            className="btn user-save"
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

  function getGoLiveBannerCopy() {
    switch (data?.goLive?.primaryCta) {
      case 'add_payment_method':
        return "No card needed during setup. Add billing and phone forwarding when you're ready to go live — your business number stays unchanged until then.";
      case 'set_up_call_forwarding':
        return 'Your billing is ready. Next, set up call forwarding so callers to your current business number can reach RingBooker behind the scenes.';
      case 'test_forwarding_setup':
        return 'Run a quick test to confirm calls are routing correctly. Your business number stays unchanged until you go live.';
      case 'enable_live_answering':
        return 'Billing and forwarding are ready. Enable live answering when you want RingBooker to start answering real callers on your business number.';
      default:
        return 'Finish the remaining go-live steps below when you are ready for RingBooker to answer real callers on your business number.';
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
              subtitle={topbarSubtitle}
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />
            {!loading && !data?.ok ? (
              <section className="card" style={{ marginBottom: 18 }}>
                <p className="sub">Unable to load user dashboard: {data?.error ?? 'unknown_error'}</p>
              </section>
            ) : null}
            {isEnterprisePlan && !data?.onboardingRequired ? (
              <section className="card enterprise-managed-card" style={{ marginBottom: 18 }}>
                <div className="panel-head">
                  <div>
                    <h3>{enterpriseApprovalPending ? 'Your Custom setup is being prepared' : 'Your Custom setup is managed by RingBooker'}</h3>
                    {!enterpriseApprovalPending ? (
                      <p className="sub">
                        Your account can include managed routing, integrations, multilingual routing, higher call volume
                        planning, and implementation support.
                      </p>
                    ) : null}
                </div>
                </div>
                <ul className="plan-includes-list" style={{ marginTop: enterpriseApprovalPending ? 10 : 12 }}>
                  {(enterpriseApprovalPending
                    ? [...ENTERPRISE_PENDING_OVERVIEW_STATUS_LINES, ...CUSTOM_MANAGED_SETUP_ITEMS]
                    : CUSTOM_MANAGED_SETUP_ITEMS
                  ).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="dashboard-card-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
                  <a className="btn user-save" href="/contact?topic=implementation">
                    Contact implementation support
                  </a>
                  <a className="btn" href="/contact?topic=onboarding-call">
                    Schedule onboarding call
                  </a>
                </div>
              </section>
            ) : null}
            {showGoLiveBanner ? (
              <section className="card dashboard-banner-go-live" style={{ marginBottom: 18 }}>
                <div className="panel-head">
                  <div>
                    <h3>RingBooker is set up, but not live yet.</h3>
	                    <p className="sub">
	                      {getGoLiveBannerCopy()}
	                      {data?.goLive?.primaryCta === 'test_forwarding_setup' ||
	                      data?.goLive?.primaryCta === 'add_payment_method'
	                        ? ''
	                        : ' Your customers keep calling your current business number until you complete the remaining go-live steps below.'}
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
                <div className="dashboard-card-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
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
            {dashboardReady && !simplifiedOverview ? (
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
            ) : null}
            {dashboardReady && !simplifiedOverview && data?.usage ? (
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
            {dashboardReady ? (
            <section
              className={`call-grid${simplifiedOverview ? ' call-grid-phase-simple' : ''}`}
              style={{ marginTop: simplifiedOverview ? 12 : 18 }}
            >
              {simplifiedOverview ? (
                <>
                  {data?.overviewRail ? (
                    <DashboardOverviewRailCard rail={data.overviewRail} shopTimezone={getShopTimezone(data.shop)} />
                  ) : null}
                  <div className="card soft">
                    <div className="panel-head">
                      <div>
                        <h3>Shortcuts</h3>
                        <p className="sub">
                          {overviewPhase === 'onboarding'
                            ? 'Optional — finish the checklist above first.'
                            : 'Optional — your go-live steps above are the priority.'}
                        </p>
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
                          <div className="avatar quick-avatar--settings" aria-hidden title="Business Knowledge">
                            <IconQuickSettings />
                          </div>
                          <div>
                            <h4>Business Knowledge</h4>
                            <p>Services, hours, policies, and how your AI sounds on calls.</p>
                          </div>
                        </div>
                        <a className="btn" href="/user/knowledge">
                          Go
                        </a>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                          <div className="avatar quick-avatar--settings" aria-hidden title="Business Knowledge">
                            <IconQuickSettings />
                          </div>
                          <div>
                            <h4>Business Knowledge</h4>
                            <p>Services, hours, policies, and how your AI sounds on calls.</p>
                          </div>
                        </div>
                        <a className="btn" href="/user/knowledge">
                          Go
                        </a>
                      </div>
                    </div>
                  </div>
                  {data?.overviewRail ? (
                    <DashboardOverviewRailCard rail={data.overviewRail} shopTimezone={getShopTimezone(data.shop)} />
                  ) : null}
                </>
              )}
            </section>
            ) : loading ? (
              <div className="note" style={{ marginTop: 18 }} aria-busy="true">
                Loading overview…
              </div>
            ) : null}
          </main>
        </div>
        <UserPortalMobileTabbar active="overview" />
      </>
    </UserLayout>
  );
}
