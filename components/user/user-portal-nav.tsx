'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconAlertCircleFilled } from '@tabler/icons-react';

import { readCachedGoLiveNavVisible, writeCachedGoLiveNavVisible } from '@/components/user/user-portal-go-live-cache';
import { useSidebarNavTooltipHandlers, useUserSidebarCollapsed } from '@/components/user/user-portal-sidebar-controls';

const BILLING_ALERT_NAV_VARIANTS = new Set(['billing_issue', 'past_due', 'paused', 'canceled', 'trial_expired']);
const BILLING_ALERT_SUBSCRIPTION_STATUSES = new Set(['past_due', 'unpaid', 'paused', 'canceled', 'trial_expired']);

type UserNavStateForPortalNav = {
  ok?: boolean;
  onboardingRequired?: boolean;
  liveCallsEnabled?: boolean;
  billingBannerVariant?: string | null;
  blockReason?: string | null;
  subscriptionStatus?: string | null;
  billingStatus?: string | null;
};

function shouldShowBillingAlertFromNavState(data: UserNavStateForPortalNav): boolean {
  const billingVariant = data.billingBannerVariant ?? '';
  const subscriptionStatus = data.subscriptionStatus ?? data.billingStatus ?? '';
  return (
    BILLING_ALERT_NAV_VARIANTS.has(billingVariant) ||
    BILLING_ALERT_SUBSCRIPTION_STATUSES.has(subscriptionStatus) ||
    Boolean(data.blockReason)
  );
}

export type UserPortalNavKey =
  | 'overview'
  | 'bookings'
  | 'calls'
  | 'knowledge'
  | 'integrations'
  | 'go-live'
  | 'ai-settings'
  | 'billing'
  | 'account'
  | 'more';

type UserPortalNavProps = {
  active: UserPortalNavKey;
};

function NavItem({
  navKey,
  href,
  label,
  icon,
  active,
  badgeCount,
  attentionDot,
  billingAlert,
}: {
  navKey: UserPortalNavKey;
  href: string;
  label: string;
  icon: ReactNode;
  active: UserPortalNavKey;
  badgeCount?: number;
  attentionDot?: boolean;
  billingAlert?: boolean;
}) {
  const { collapsed } = useUserSidebarCollapsed();
  const tooltipHandlers = useSidebarNavTooltipHandlers(label);
  const isActive = active === navKey;

  return (
    <Link
      href={href}
      prefetch
      className={`nav-item${isActive ? ' active' : ''}`}
      title={collapsed ? label : undefined}
      aria-label={label}
      {...tooltipHandlers}
    >
      <div className="nav-icon">{icon}</div>
      <span className="nav-item-label">{label}</span>
      {billingAlert ? (
        <span aria-label="Billing needs attention" title="Billing needs attention" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 6, color: '#dc2626' }}>
          <IconAlertCircleFilled size={13} stroke={1.8} aria-hidden="true" />
        </span>
      ) : null}
      {attentionDot ? <span className="nav-attention-dot" aria-label={`${label} needs attention`} /> : null}
      {badgeCount && badgeCount > 0 ? (
        <span
          className="nav-item-badge"
          aria-label={`${badgeCount > 9 ? '9+' : badgeCount} pending`}
          style={{
            background: '#dc2626',
            color: 'white',
            fontSize: 10,
            fontWeight: 600,
            minWidth: 16,
            height: 16,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 6,
            padding: '0 4px',
          }}
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

function navLink(
  key: UserPortalNavKey,
  href: string,
  label: string,
  icon: ReactNode,
  active: UserPortalNavKey,
  badgeCount?: number,
  attentionDot?: boolean,
  billingAlert?: boolean,
) {
  return (
    <NavItem
      key={key}
      navKey={key}
      href={href}
      label={label}
      icon={icon}
      active={active}
      badgeCount={badgeCount}
      attentionDot={attentionDot}
      billingAlert={billingAlert}
    />
  );
}

function IconOverview() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x={3} y={4} width={7} height={7} rx="1.5" />
      <rect x={14} y={4} width={7} height={4} rx="1.5" />
      <rect x={14} y={11} width={7} height={9} rx="1.5" />
      <rect x={3} y={14} width={7} height={6} rx="1.5" />
    </svg>
  );
}

function IconBookings() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function IconCalls() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" />
    </svg>
  );
}

function IconKnowledge() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}

function IconIntegrations() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx={12} cy={12} r={3} />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconGoLive() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.13 12.13 0 0 0 .7 1.99l-1 1.24a16 16 0 0 0 6 6l1.27-1a12 12 0 0 0 2 .7 2 2 0 0 1 1.72 2z" />
      <path d="M14.05 2a9 9 0 0 1 8 7.94" />
      <path d="M14.05 6A5 5 0 0 1 18 10" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
    </svg>
  );
}

function IconBilling() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x={3} y={5} width={18} height={14} rx={2} />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function IconAccount() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" />
      <circle cx={12} cy={7} r={4} fill="none" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx={5} cy={12} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={12} cy={12} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={19} cy={12} r={1.5} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Shared left-rail links for authenticated `/user/*` pages. */
export function UserPortalNav({ active }: UserPortalNavProps) {
  const [followUpCount, setFollowUpCount] = useState(0);
  const [showGoLive, setShowGoLive] = useState(() => active === 'go-live');
  const [goLiveNavResolved, setGoLiveNavResolved] = useState(() => active === 'go-live');
  const [showBillingAlert, setShowBillingAlert] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (active === 'go-live') {
      setShowGoLive(true);
      setGoLiveNavResolved(true);
    } else {
      const cached = readCachedGoLiveNavVisible();
      if (cached !== null) {
        setShowGoLive(cached);
        setGoLiveNavResolved(true);
      } else {
        setGoLiveNavResolved(false);
        setShowGoLive(false);
      }
    }

    void Promise.allSettled([
      fetch('/api/backend/user/calls/summary').then(async (response) => (await response.json()) as { ok?: boolean; followUpCount?: number }),
      fetch('/api/backend/user/nav-state').then(async (response) => (await response.json()) as UserNavStateForPortalNav),
    ])
      .then(([callsResult, navResult]) => {
        if (cancelled) return;
        if (callsResult.status === 'fulfilled' && callsResult.value.ok) {
          setFollowUpCount(callsResult.value.followUpCount ?? 0);
        }
        if (navResult.status === 'fulfilled' && navResult.value.ok) {
          const next = Boolean(!navResult.value.onboardingRequired && !navResult.value.liveCallsEnabled);
          setShowBillingAlert(shouldShowBillingAlertFromNavState(navResult.value));
          writeCachedGoLiveNavVisible(next);
          if (active !== 'go-live') {
            setShowGoLive(next);
          }
        }
        setGoLiveNavResolved(true);
      })
      .catch(() => {
        if (!cancelled) setGoLiveNavResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  const goLiveRow =
    showGoLive || active === 'go-live' ? (
      navLink('go-live', '/user/go-live', 'Go live', <IconGoLive />, active, undefined, true)
    ) : !goLiveNavResolved ? (
      <div className="nav-item nav-go-live-placeholder" aria-busy="true" aria-label="Loading navigation">
        <span className="nav-go-live-placeholder-track">
          <span className="nav-go-live-placeholder-bar" />
        </span>
      </div>
    ) : null;

  return (
    <div className="nav-section">
      <div className="nav-list">
        <div className="nav-label">Operate</div>
        {navLink('overview', '/user', 'Overview', <IconOverview />, active)}
        {navLink('calls', '/user/calls', 'Calls', <IconCalls />, active, followUpCount)}
        {navLink('bookings', '/user/bookings', 'Bookings', <IconBookings />, active)}
        <div className="nav-label">Setup</div>
        {goLiveRow}
        {navLink('knowledge', '/user/knowledge', 'Business Knowledge', <IconKnowledge />, active)}
        {navLink('integrations', '/user/integrations', 'Integrations', <IconIntegrations />, active)}
        <div className="nav-label">Account</div>
        {navLink('billing', '/user/billing', 'Billing', <IconBilling />, active, undefined, undefined, showBillingAlert)}
        {navLink('account', '/user/account', 'Account', <IconAccount />, active)}
      </div>
    </div>
  );
}

export { IconMore };
