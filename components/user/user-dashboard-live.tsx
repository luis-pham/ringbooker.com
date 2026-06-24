'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalPageContent } from '@/components/user/user-portal-page-content';
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
import { formatShopDateTime, formatShopLongDate, getShopLocalMonthPeriod, getShopTimezone } from '@/src/shared/timezone';

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
    address?: string | null;
    timezone: string;
    plan: string;
    active: boolean;
    allow_transfers?: boolean;
    handoff_phone?: string | null;
  };
  onboardingRequired?: boolean;
  onboardingCompleted?: boolean;
  usage?: {
    capturedCallersUsed: number;
    capturedCallersLimit: number | null;
    capturedCallerUsagePercent: number | null;
    voiceMinutesSoftLimit: number | null;
    nearCapturedCallerLimit: boolean;
    overCapturedCallerLimit: boolean;
  };
  goLive?: {
    liveCallsEnabled: boolean;
    primaryCta: GoLiveDashboardPrimaryCta | null;
    forwardingSetupVerified: boolean;
    forwardingConfigured?: boolean;
    hasForwardingNumber: boolean;
    paymentMethodValid: boolean;
    subscriptionActiveLike: boolean;
    emailVerified?: boolean;
    blockReason?: string;
    commercialGoLiveApproved?: boolean;
    commercialApprovalRequired?: boolean;
    /** ISO timestamp when live answering was enabled — optional until API provides it */
    activatedAt?: string | null;
    /** True when subscription is in a valid trialing window (for plan stat badge). */
    billingTrialing?: boolean;
    billing?: {
      subscriptionStatus?: string | null;
      paymentMethodStatus?: string | null;
      status?: string | null;
    } | null;
  } | null;
  overviewRail?: UserDashboardOverviewRail;
  /** Shop knowledge/integration snapshot for overview status (mirrors server-side checks). */
  overviewSnapshot?: {
    hasServices: boolean;
    hasHours: boolean;
    integrationConnected: boolean;
    integrationLabel: string;
  };
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

function IconCheckSmall() {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} aria-hidden>
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function IconLockSmall() {
  return (
    <svg viewBox="0 0 24 24" width={13} height={13} aria-hidden fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={5} y={10} width={14} height={10} rx={2} />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconQuickKnowledge() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

function IconQuickIntegrations() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

const BK_NUDGE_STORAGE_KEY = 'bk_nudge_dismissed';
const HANDOFF_BANNER_DISMISSED_KEY = 'handoff_banner_dismissed';
const LAST_KNOWN_PLAN_KEY = 'rba_last_known_plan';

function HandoffSetupBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="overview-bk-nudge-banner" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>&#128241;</span>
      <div style={{ flex: 1 }}>
        <strong style={{ fontSize: 14 }}>Set up call transfers</strong>
        <p style={{ margin: '2px 0 8px', fontSize: 13, color: 'var(--text-gray)' }}>
          When a caller asks to speak to you, RingBooker will call your direct mobile. Add your number to enable transfers.
        </p>
        <a href="/user/settings#call-handling" style={{ fontSize: 13, fontWeight: 500, color: 'var(--purple-dark)' }}>Add my number →</a>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: 18, lineHeight: 1 }}>×</button>
    </div>
  );
}

function UpgradeToProModal({ onDismiss, shopName }: { onDismiss: () => void; shopName: string }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Call transfers are now available</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-gray)', lineHeight: 1.5 }}>
          With your Professional plan, RingBooker can transfer calls directly to you when a caller asks to speak to someone. Add your direct mobile to get started.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/user/settings#call-handling" className="btn user-save" style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>Set up transfers →</a>
          <button type="button" onClick={onDismiss} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 14, color: 'var(--text-gray)' }}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

type OverviewState = {
  billingActive: boolean;
  forwardingConfigured: boolean;
  forwardingVerified: boolean;
  liveAnsweringOn: boolean;
  hasServices: boolean;
  hasHours: boolean;
  integrationConnected: boolean;
  integrationLabel: string;
};

function deriveOverviewState(data: UserDashboardResponse): OverviewState | null {
  if (!data.goLive) return null;
  const snap = data.overviewSnapshot;
  return {
    billingActive: data.goLive.paymentMethodValid && data.goLive.subscriptionActiveLike,
    forwardingConfigured: Boolean(data.goLive.forwardingConfigured),
    forwardingVerified: data.goLive.forwardingSetupVerified && data.goLive.hasForwardingNumber,
    liveAnsweringOn: data.goLive.liveCallsEnabled === true,
    hasServices: snap?.hasServices ?? false,
    hasHours: snap?.hasHours ?? false,
    integrationConnected: snap?.integrationConnected ?? false,
    integrationLabel: snap?.integrationLabel?.trim() ?? '',
  };
}

type OverviewShortcutRow = {
  icon: ReactNode;
  name: string;
  desc: string;
  href: string;
};

type ActivationChecklistRow = { id: string; name: string; desc: string | null; done: boolean; href: string; locked?: boolean };
type RenderedActivationChecklistRow = ActivationChecklistRow & { stepNumber: number; active: boolean };

function buildActivationChecklist(
  goLive: NonNullable<UserDashboardResponse['goLive']>,
  rail: UserDashboardOverviewRail | undefined,
): ActivationChecklistRow[] {
  const hasBilling = goLive.paymentMethodValid && goLive.subscriptionActiveLike;
  void rail;
  return [
    {
      id: 'forwarding',
      name: 'Forward missed calls to RingBooker',
      desc: 'One code to dial on your phone — takes 2 minutes',
      done: goLive.hasForwardingNumber,
      href: '/user/go-live#go-live-forwarding',
    },
    {
      id: 'forwarding_test',
      name: 'Verify forwarding',
      desc: goLive.forwardingConfigured && !goLive.forwardingSetupVerified
        ? 'Configured but not verified — call your business number to complete'
        : 'Call your business number to confirm calls reach RingBooker',
      done: goLive.forwardingSetupVerified,
      href: '/user/go-live#go-live-forwarding',
    },
    {
      id: 'billing',
      name: 'Add your card',
      desc: 'Starts your free 14-day trial — no charge today',
      done: hasBilling,
      href: '/user/billing',
    },
    {
      id: 'live_answering',
      name: 'Switch it on',
      desc: hasBilling && goLive.forwardingSetupVerified && goLive.emailVerified !== false
        ? 'RingBooker starts answering missed calls immediately'
        : goLive.emailVerified === false
          ? 'Confirm your email before switching on live answering'
          : 'Locked until billing and call forwarding are verified',
      done: goLive.liveCallsEnabled,
      href: '/user/go-live#go-live-forwarding',
      locked: !hasBilling || !goLive.forwardingSetupVerified || goLive.emailVerified === false,
    },
  ];
}

function OverviewQuickAccessCard({ rows }: { rows: OverviewShortcutRow[] }) {
  return (
    <div className="shortcuts-card overview-quick-access-card">
      <div className="quick-access-card-title">Quick access</div>
      {rows.map((s) => (
        <a key={s.href} className="sc-item overview-quick-access-item" href={s.href}>
          <div className="sc-icon">{s.icon}</div>
          <div className="sc-body">
            <div className="sc-name">{s.name}</div>
            <div className="sc-desc">{s.desc}</div>
          </div>
          <div className="sc-go" aria-hidden>
            ›
          </div>
        </a>
      ))}
    </div>
  );
}

function OverviewBkNudgeBanner(props: { onDismiss: () => void }) {
  const { onDismiss } = props;
  return (
    <div className="overview-bk-nudge" role="region" aria-label="Business Knowledge suggestion">
      <span className="overview-bk-nudge__icon" aria-hidden>
        ✨
      </span>
      <p className="overview-bk-nudge__text">
        Make your AI smarter — add staff, policies, and FAQs in Business Knowledge.
      </p>
      <a className="btn-primary-sm overview-bk-nudge__cta" href="/user/knowledge">
        Open Business Knowledge →
      </a>
      <button type="button" className="overview-bk-nudge-dismiss" aria-label="Dismiss" onClick={onDismiss}>
        ✕
      </button>
    </div>
  );
}

function OverviewSystemStatusCard(props: {
  state: OverviewState;
  totalCalls: number;
  shopTimezone: string;
  recentCalls: Array<{
    requestId?: string;
    startedAt?: string;
    callerPhone?: string;
    outcome?: string;
    subtitle?: string | null;
  }>;
}) {
  const { state, totalCalls, shopTimezone, recentCalls } = props;
  const showRecentCalls = recentCalls.length > 0;

  return (
    <section className="checklist-card overview-system-status-card">
      <div className="card-title">System status</div>
      <div className="card-sub">What&apos;s working and what needs attention.</div>
      <div className="overview-status-list">
        <div className="overview-status-row">
          <span
            className={`overview-status-dot ${state.liveAnsweringOn ? 'overview-status-dot--ok' : 'overview-status-dot--warn'}`}
            aria-hidden
          />
          <div className="overview-status-main">
            <div className="overview-status-label">Live answering</div>
            <div className="overview-status-desc">
              {state.liveAnsweringOn
                ? 'RingBooker is answering missed calls'
                : 'Not enabled — complete Go Live to activate'}
            </div>
          </div>
          <a className="overview-status-action" href="/user/go-live#go-live-forwarding">
            {state.liveAnsweringOn ? 'Manage' : 'Go to Go Live →'}
          </a>
        </div>
        <div className="overview-status-row">
          <span
            className={`overview-status-dot ${state.forwardingVerified ? 'overview-status-dot--ok' : 'overview-status-dot--warn'}`}
            aria-hidden
          />
          <div className="overview-status-main">
            <div className="overview-status-label">Call forwarding</div>
            <div className="overview-status-desc">
              {state.forwardingVerified
                ? 'Forwarding is active and verified'
                : "Forwarding not set up — calls won't reach RingBooker yet"}
            </div>
          </div>
          <a className="overview-status-action" href="/user/go-live#go-live-forwarding">
            {state.forwardingVerified ? 'Manage' : 'Fix →'}
          </a>
        </div>
        <div className="overview-status-row">
          <span
            className={`overview-status-dot ${state.integrationConnected ? 'overview-status-dot--ok' : 'overview-status-dot--neutral'}`}
            aria-hidden
          />
          <div className="overview-status-main">
            <div className="overview-status-label">Booking / calendar</div>
            <div className="overview-status-desc">
              {state.integrationConnected
                ? `Connected — ${state.integrationLabel || 'Integration on file'}`
                : "No integration — RingBooker can't check availability"}
            </div>
          </div>
          <a className="overview-status-action" href="/user/integrations#integrations">
            {state.integrationConnected ? 'Manage' : 'Connect →'}
          </a>
        </div>
        <div className="overview-status-row overview-status-row--last">
          <span
            className={`overview-status-dot ${state.hasServices && state.hasHours ? 'overview-status-dot--ok' : 'overview-status-dot--warn'}`}
            aria-hidden
          />
          <div className="overview-status-main">
            <div className="overview-status-label">AI knowledge</div>
            <div className="overview-status-desc">
              {state.hasServices && state.hasHours
                ? 'Hours and services are set'
                : 'Add hours and services so callers get accurate answers'}
            </div>
          </div>
          <a className="overview-status-action" href="/user/knowledge">
            Open →
          </a>
        </div>
      </div>
      {totalCalls === 0 ? (
        <p className="overview-status-zero-calls">
          No calls logged yet. Place a test call through your forwarding setup, or check back here once live traffic starts.
        </p>
      ) : null}
      {showRecentCalls ? (
        <div className="overview-status-recent">
          <h4 className="overview-rail-recent-title">Recent calls</h4>
          <div className="overview-rail-calls">
            {recentCalls.map((call, index) => {
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
          <a className="user-link" href="/user/calls" style={{ marginTop: 12, display: 'inline-block' }}>
            View all calls
          </a>
        </div>
      ) : null}
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

export function UserDashboardLive({ initialData = null }: { initialData?: UserDashboardResponse | null }) {
  const { setWorkspace } = useUserWorkspace();
  const [data, setData] = useState<UserDashboardResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
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

  const shopName = data?.shop?.name ?? (loading ? 'Overview' : 'Your business');
  const planLabel = useMemo(() => {
    const raw = data?.shop?.plan ?? 'starter';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [data?.shop?.plan]);

  const liveAnsweringOn = data?.goLive?.liveCallsEnabled === true;
  const enterpriseApprovalPending = data?.goLive?.commercialApprovalRequired === true;
  const isEnterprisePlan = data?.shop?.plan === 'enterprise';
  const usageOverLimitMode =
    data?.usage?.overCapturedCallerLimit && data?.goLive?.billingTrialing
      ? 'trial'
      : data?.usage?.overCapturedCallerLimit &&
          (data?.goLive?.blockReason === 'payment_method_required' ||
            data?.goLive?.blockReason === 'subscription_inactive' ||
            data?.goLive?.paymentMethodValid === false)
        ? 'payment_failed'
        : data?.usage?.overCapturedCallerLimit
          ? 'paid'
          : null;

  const dashboardReady = !loading && data?.ok === true;
  const billingActive = !!(data?.goLive?.paymentMethodValid && data?.goLive?.subscriptionActiveLike);
  const subscriptionStatus = data?.goLive?.billing?.subscriptionStatus ?? 'none';
  const paymentMethodStatus = data?.goLive?.billing?.paymentMethodStatus ?? 'none';
  const derivedBillingState = (() => {
    if (['past_due', 'unpaid'].includes(subscriptionStatus)) return 'billing_issue';
    if (subscriptionStatus === 'paused') return 'paused';
    if (['canceled', 'trial_expired'].includes(subscriptionStatus)) return 'reactivate';
    if (subscriptionStatus === 'trialing') return 'trialing';
    if (subscriptionStatus === 'active') return 'active';
    return 'none';
  })();
  const planTagLabel = (() => {
    if (derivedBillingState === 'trialing') return 'Trial';
    if (derivedBillingState === 'active') return 'Active';
    if (derivedBillingState === 'billing_issue') return 'Past due';
    if (derivedBillingState === 'paused') return 'Paused';
    if (derivedBillingState === 'reactivate') return 'Canceled';
    return null;
  })();
  const planTagClass = (() => {
    if (planTagLabel === 'Active') return 'green';
    if (planTagLabel === 'Trial') return 'orange';
    if (planTagLabel === 'Past due' || planTagLabel === 'Canceled') return 'red';
    if (planTagLabel === 'Paused') return 'orange';
    return 'green';
  })();
  const preLiveBillingCopy = (() => {
    if (derivedBillingState === 'billing_issue') {
      return {
        title: 'Billing issue',
        body: 'Update your payment method to restore live answering.',
        cta: 'Resolve billing issue',
      };
    }
    if (derivedBillingState === 'paused') {
      return {
        title: 'Live answering paused',
        body: 'Your subscription is paused. Resume to restore live answering.',
        cta: 'Manage billing',
      };
    }
    if (derivedBillingState === 'reactivate') {
      return {
        title: 'Subscription ended',
        body: 'Your trial or subscription has ended. Reactivate to restore live answering.',
        cta: 'Reactivate',
      };
    }
    return null;
  })();
  const expandedOverview =
    dashboardReady &&
    Boolean(data?.goLive) &&
    !data?.onboardingRequired &&
    !enterpriseApprovalPending &&
    (billingActive || liveAnsweringOn);

  const overviewState = useMemo(() => (data?.ok ? deriveOverviewState(data) : null), [data]);

  const [bkNudgeDismissed, setBkNudgeDismissed] = useState(false);
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(BK_NUDGE_STORAGE_KEY) === '1') {
        setBkNudgeDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const dismissBkNudge = useCallback(() => {
    try {
      localStorage.setItem(BK_NUDGE_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setBkNudgeDismissed(true);
  }, []);

  const [handoffBannerDismissed, setHandoffBannerDismissed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(HANDOFF_BANNER_DISMISSED_KEY) === '1') setHandoffBannerDismissed(true);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!data?.shop?.plan) return;
    try {
      if (typeof window === 'undefined') return;
      const lastPlan = localStorage.getItem(LAST_KNOWN_PLAN_KEY);
      const currentPlan = data.shop.plan;
      if (lastPlan === 'starter' && currentPlan === 'professional') {
        setShowUpgradeModal(true);
      }
      localStorage.setItem(LAST_KNOWN_PLAN_KEY, currentPlan);
    } catch { /* ignore */ }
  }, [data?.shop?.plan]);
  const dismissHandoffBanner = useCallback(() => {
    try { localStorage.setItem(HANDOFF_BANNER_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setHandoffBannerDismissed(true);
  }, []);
  const dismissUpgradeModal = useCallback(() => setShowUpgradeModal(false), []);

  const showBkNudgeBanner =
    expandedOverview &&
    overviewState &&
    !bkNudgeDismissed &&
    (!overviewState.liveAnsweringOn || !overviewState.hasServices || !overviewState.hasHours);

  const showHandoffBanner =
    expandedOverview &&
    liveAnsweringOn &&
    !handoffBannerDismissed &&
    data?.shop?.plan === 'professional' &&
    data?.shop?.allow_transfers === true &&
    !data?.shop?.handoff_phone;
  const topbarSubtitle = useMemo(() => {
    if (!data?.ok) return 'Track calls, bookings, and reminders.';
    if (data.onboardingRequired) return "Complete setup — then we'll walk you through go-live.";
    if (data.goLive?.commercialApprovalRequired) return 'Custom plan: we enable live answering after approval.';
    if (!liveAnsweringOn) return 'Finish setup to start answering calls';
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

  const activationChecklist = useMemo(() => {
    if (!data?.goLive) return [];
    return buildActivationChecklist(data.goLive, data.overviewRail);
  }, [data, data?.overviewRail]);
  const renderedChecklist = useMemo<RenderedActivationChecklistRow[]>(() => {
    const activeItem = activationChecklist.find((item) => !item.done && !item.locked) ?? null;
    const activeId = activeItem?.id ?? activationChecklist[activationChecklist.length - 1]?.id ?? null;
    return activationChecklist.map((item, index) => ({
      ...item,
      stepNumber: index + 1,
      locked: Boolean(item.locked),
      active: item.id === activeId,
    }));
  }, [activationChecklist]);

  const checklistDoneCount = renderedChecklist.filter((item) => item.done).length;
  const checklistProgress = renderedChecklist.length > 0 ? (checklistDoneCount / renderedChecklist.length) * 100 : 0;

  const shopTimezone = useMemo(() => getShopTimezone(data?.shop), [data?.shop]);

  const postLiveBannerSubtitle = useMemo(() => {
    const name = data?.shop?.name ?? 'Your business';
    const iso = data?.goLive?.activatedAt?.trim();
    if (iso) {
      const when = formatOverviewWhen(iso, shopTimezone);
      if (when) return `Answering calls since ${when} · ${name}`;
    }
    return `Answering calls on your business line · ${name}`;
  }, [data?.goLive?.activatedAt, data?.shop?.name, shopTimezone]);

  const overviewShortcutRows = useMemo<OverviewShortcutRow[]>(
    () => [
      {
        icon: <IconQuickBookings />,
        name: 'Open bookings',
        desc: 'Review upcoming appointments',
        href: '/user/bookings',
      },
      {
        icon: <IconQuickCalls />,
        name: 'Review call logs',
        desc: 'Calls, transcripts, missed recovery',
        href: '/user/calls',
      },
      {
        icon: <IconQuickKnowledge />,
        name: 'Business Knowledge',
        desc: 'Refine what AI knows',
        href: '/user/knowledge',
      },
      {
        icon: <IconQuickIntegrations />,
        name: 'Integrations',
        desc: 'Connect your booking system',
        href: '/user/integrations',
      },
    ],
    [],
  );

  const recentCallsForStatus = useMemo(() => {
    if (data?.overviewRail?.variant !== 'live') return [];
    return data.overviewRail.recentCalls;
  }, [data?.overviewRail]);

  const usageResetLabel = useMemo(() => {
    const { periodEnd } = getShopLocalMonthPeriod(new Date(), shopTimezone);
    return formatShopLongDate(periodEnd, shopTimezone);
  }, [shopTimezone]);

  return (
    <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-dashboard-live">
      <>
        {showUpgradeModal ? <UpgradeToProModal onDismiss={dismissUpgradeModal} shopName={data?.shop?.name ?? ''} /> : null}
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="overview" />
          <main className="main">
            <UserPortalTopbar
              title={shopName}
              subtitle={topbarSubtitle}
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />
            <UserPortalPageContent pageClass="page-overview">
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
            {dashboardReady && data.goLive ? (
              <div className="overview-page">
                {liveAnsweringOn ? (
                  null
                ) : !enterpriseApprovalPending ? (
                  <div className="overview-banner pre-live">
                    <span className="banner-action-needed">
                      <span className="banner-action-needed-dot" aria-hidden />
                      Action needed
                    </span>
                    <div className="banner-dot amber" aria-hidden />
                    <div className="banner-text">
                      <span className="banner-title">
                        {preLiveBillingCopy
                          ? preLiveBillingCopy.title
                          : !data.goLive.hasForwardingNumber
                            ? 'Set up call forwarding to get started'
                            : data.goLive.forwardingConfigured && !data.goLive.forwardingSetupVerified
                              ? 'Call forwarding not verified yet'
                              : data.goLive.forwardingSetupVerified && (!data.goLive.paymentMethodValid || !data.goLive.subscriptionActiveLike)
                                ? 'Forwarding verified — add your card to go live'
                                : 'Ready to go live'}
                      </span>
                      <span className="banner-sub">
                        {preLiveBillingCopy
                          ? preLiveBillingCopy.body
                          : !data.goLive.hasForwardingNumber
                            ? 'Forward missed calls to RingBooker before enabling live answering.'
                            : data.goLive.forwardingConfigured && !data.goLive.forwardingSetupVerified
                              ? 'Call your business number from another phone to confirm forwarding is working.'
                              : data.goLive.forwardingSetupVerified && (!data.goLive.paymentMethodValid || !data.goLive.subscriptionActiveLike)
                                ? 'Start your trial, then switch on live answering.'
                                : 'Billing and forwarding are ready. Switch on live answering when you are ready.'}
                      </span>
                    </div>
                    <div className="banner-actions portal-card-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {preLiveBillingCopy ? (
                        <a className="btn user-save" href="/user/billing">
                          {preLiveBillingCopy.cta} →
                        </a>
                      ) : !data.goLive.hasForwardingNumber ? (
                        <a className="btn user-save" href="/user/go-live#go-live-forwarding">
                          Set up forwarding →
                        </a>
                      ) : data.goLive.forwardingConfigured && !data.goLive.forwardingSetupVerified ? (
                        <a className="btn user-save" href="/user/go-live#go-live-forwarding">
                          Test forwarding →
                        </a>
                      ) : !data.goLive.paymentMethodValid || !data.goLive.subscriptionActiveLike ? (
                        <a className="btn user-save" href="/user/billing">
                          Start 14-day trial →
                        </a>
                      ) : (
                        <a className="btn user-save" href="/user/go-live#go-live-forwarding">
                          Switch it on →
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}
                {goLiveActionMessage || testCallStatus ? (
                  <div style={{ marginBottom: 16 }}>
                    {goLiveActionMessage ? (
                      <p className="overview-banner-footnote" style={{ margin: 0 }}>
                        {goLiveActionMessage}
                      </p>
                    ) : null}
                    {testCallStatus ? (
                      <p
                        className="overview-banner-test-status"
                        style={{ marginTop: goLiveActionMessage ? 8 : 0 }}
                      >
                        {testCallStatus}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {(() => {
                  const hasEverBeenLive = Boolean(data.goLive.liveCallsEnabled || data.goLive.activatedAt);
                  const gridClass = `overview-grid${hasEverBeenLive ? '' : ' overview-grid--full'}`;
                  return expandedOverview && overviewState ? (
                    <>
                      {showBkNudgeBanner ? <OverviewBkNudgeBanner onDismiss={dismissBkNudge} /> : null}
                      {showHandoffBanner ? <HandoffSetupBanner onDismiss={dismissHandoffBanner} /> : null}
                      <div className={gridClass}>
                        <div className="overview-left">
                          <OverviewSystemStatusCard
                            state={overviewState}
                            totalCalls={data?.metrics?.callCount ?? 0}
                            shopTimezone={shopTimezone}
                            recentCalls={recentCallsForStatus}
                          />
                        </div>
                        {hasEverBeenLive ? (
                          <div className="overview-right overview-rail">
                            <OverviewQuickAccessCard rows={overviewShortcutRows} />
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className={gridClass}>
                      <div className="overview-left">
                        <div className="checklist-card overview-go-live-checklist">
                          <div className="card-title">Go-live checklist</div>
                          <div className="cl-progress" aria-label={`${checklistDoneCount} of 4 done`}>
                            <div className="cl-progress-label">{checklistDoneCount} of 4 done</div>
                            <div className="cl-progress-track" aria-hidden>
                              <div className="cl-progress-fill" style={{ width: `${checklistProgress}%` }} />
                            </div>
                          </div>
                          <div className="card-sub">
                            Complete these steps to activate live answering on your business number.
                          </div>
                          {renderedChecklist.map((item) => (
                            <a
                              key={item.id}
                              className={`cl-item${item.done ? ' cl-item--done' : ''}${item.active ? ' cl-item--active' : ''}${item.locked ? ' cl-item--locked' : ''}`}
                              href={item.href}
                              aria-disabled={item.locked ? true : undefined}
                              tabIndex={item.locked ? -1 : undefined}
                            >
                              <div className={`cl-circle ${item.done ? 'done' : ''}${item.active ? ' active' : ''}${item.locked ? ' locked' : ''}`}>
                                {item.done ? <IconCheckSmall /> : item.locked ? <IconLockSmall /> : item.stepNumber}
                              </div>
                              <div className="cl-body">
                                <div className="cl-name-row">
                                  <div className="cl-name">{item.name}</div>
                                  {item.id === 'forwarding_test' && !item.done ? (
                                    <span className="cl-action-badge">
                                      <span className="cl-action-badge-dot" aria-hidden />
                                      Action needed
                                    </span>
                                  ) : null}
                                  {item.id === 'live_answering' && data.goLive?.emailVerified === false ? (
                                    <span className="cl-action-badge">
                                      <span className="cl-action-badge-dot" aria-hidden />
                                      Email required
                                    </span>
                                  ) : null}
                                </div>
                                {item.desc ? <div className="cl-desc">{item.desc}</div> : null}
                              </div>
                              <div className="cl-arrow" aria-hidden>
                                ›
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                      {hasEverBeenLive ? (
                        <div className="overview-right overview-rail">
                          <OverviewQuickAccessCard rows={overviewShortcutRows} />
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : null}
            {dashboardReady && expandedOverview ? (
              <section className="grid grid-4 overview-stats-grid">
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
                  <div className="stat-label">Calls</div>
                  <div className="stat-value">{data?.metrics?.callCount ?? 0}</div>
                  <div className="stat-meta">Total calls logged</div>
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
                  <div className="stat-label">Bookings</div>
                  <div className="stat-value">{data?.metrics?.bookingCount ?? 0}</div>
                  <div className="stat-meta">Captured this billing period</div>
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
                  <div className="stat-label">Missed</div>
                  <div className="stat-value">{data?.metrics?.missedCalls ?? 0}</div>
                  <div className="stat-meta">Calls not answered</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M4 19h16" />
                        <path d="M7 15l3-3 3 2 4-5" />
                      </svg>
                    </div>
                    {planTagLabel ? <span className={`tag ${planTagClass}`}>{planTagLabel}</span> : null}
                  </div>
                  <div className="stat-label">Plan</div>
                  <div className="stat-value">{planLabel}</div>
                  <div className="stat-meta">{data?.shop?.timezone ?? 'Timezone unavailable'}</div>
                </div>
              </section>
            ) : null}
            {dashboardReady && expandedOverview && data?.usage ? (
              <section
                className={`card usage-captured-card${data.usage.overCapturedCallerLimit ? ' usage-captured-card--over' : ''}${data.usage.nearCapturedCallerLimit && !data.usage.overCapturedCallerLimit ? ' usage-captured-card--near' : ''}`}
                style={{ marginTop: 18 }}
              >
                <div className="usage-captured-head">
                  <h3 className="usage-captured-title">Captured calls this billing period</h3>
                  <span className="usage-captured-summary">
                    {data.usage.capturedCallersLimit == null
                      ? `${data.usage.capturedCallersUsed} · Custom`
                      : `${data.usage.capturedCallersUsed} / ${data.usage.capturedCallersLimit} · ${data.usage.capturedCallerUsagePercent ?? 0}%`}
                  </span>
                </div>
                <div className="usage-progress-track" aria-hidden="true">
                  <div
                    className={`usage-progress-fill ${data.usage.overCapturedCallerLimit ? 'usage-progress-fill--over' : data.usage.nearCapturedCallerLimit ? 'usage-progress-fill--near' : 'usage-progress-fill--ok'}`}
                    style={{ width: `${Math.min(100, data.usage.capturedCallerUsagePercent ?? 0)}%` }}
                  />
                </div>
                <div className="usage-captured-footer">
                  <span className="usage-captured-reset">Resets {usageResetLabel}</span>
                </div>
                {data.usage.nearCapturedCallerLimit || data.usage.overCapturedCallerLimit ? (
                  <p
                    className={`sub usage-captured-warn${data.usage.overCapturedCallerLimit ? ' usage-captured-warn--over' : ' usage-captured-warn--near'}`}
                  >
                    {data.usage.overCapturedCallerLimit
                      ? usageOverLimitMode === 'trial'
                        ? 'Trial limit reached.'
                        : usageOverLimitMode === 'payment_failed'
                          ? 'Payment failed - calls paused.'
                          : 'Over limit - overage at $0.75/captured call.'
                      : 'You are close to your captured call limit for this billing period.'}
                    {data.usage.overCapturedCallerLimit ? (
                      <>
                        {' '}
                        <a href="/user/billing">
                          {usageOverLimitMode === 'trial'
                            ? 'Add payment method'
                            : usageOverLimitMode === 'payment_failed'
                              ? 'Update payment method'
                              : 'View billing'}
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </section>
            ) : null}
            {loading ? (
              <div className="note" style={{ marginTop: 18 }} aria-busy="true">
                Loading overview…
              </div>
            ) : null}
            </UserPortalPageContent>
          </main>
        </div>
        <UserPortalMobileTabbar active="overview" />
      </>
    </UserLayout>
  );
}
