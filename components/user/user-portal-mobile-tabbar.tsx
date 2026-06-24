'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconAlertCircleFilled } from '@tabler/icons-react';

import type { UserPortalNavKey } from '@/components/user/user-portal-nav';
import { readCachedGoLiveNavVisible, writeCachedGoLiveNavVisible } from '@/components/user/user-portal-go-live-cache';

export type { UserPortalNavKey };

const BILLING_ALERT_NAV_VARIANTS = new Set(['billing_issue', 'past_due', 'paused', 'canceled', 'trial_expired']);
const BILLING_ALERT_SUBSCRIPTION_STATUSES = new Set(['past_due', 'unpaid', 'paused', 'canceled', 'trial_expired']);

type UserNavStateForMobileTabbar = {
  ok?: boolean;
  onboardingRequired?: boolean;
  liveCallsEnabled?: boolean;
  billingBannerVariant?: string | null;
  blockReason?: string | null;
  subscriptionStatus?: string | null;
  billingStatus?: string | null;
};

function shouldShowBillingAlertFromNavState(data: UserNavStateForMobileTabbar): boolean {
  const billingVariant = data.billingBannerVariant ?? '';
  const subscriptionStatus = data.subscriptionStatus ?? data.billingStatus ?? '';
  return (
    BILLING_ALERT_NAV_VARIANTS.has(billingVariant) ||
    BILLING_ALERT_SUBSCRIPTION_STATUSES.has(subscriptionStatus) ||
    Boolean(data.blockReason)
  );
}

type UserPortalMobileTabbarProps = {
  active: UserPortalNavKey;
};

function IconOverview(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={4} width={7} height={7} rx="1.5" />
      <rect x={14} y={4} width={7} height={4} rx="1.5" />
      <rect x={14} y={11} width={7} height={9} rx="1.5" />
      <rect x={3} y={14} width={7} height={6} rx="1.5" />
    </svg>
  );
}

function IconBookings(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={5} width={18} height={16} rx={2} />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function IconCalls(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 19a19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 2.8a2 2 0 0 1-.6 1.7L7.1 10a16 16 0 0 0 6.9 6.9l1.8-1.8a2 2 0 0 1 1.7-.6l2.8.4A2 2 0 0 1 22 16.9Z" />
    </svg>
  );
}

function IconKnowledge(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function IconIntegrations(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={3} />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconGoLive(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.682.305 1.348.53 1.99M9 18h4.17M14.21 9.09 15.25 7.05a2 2 0 0 1 2.83-.09l2.12 2.12a2 2 0 0 1 .09 2.83l-2.3 2.3M10.59 13.59 12 15l1.41 1.41" />
    </svg>
  );
}

function IconSettings(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
    </svg>
  );
}

function IconBilling(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x={3} y={5} width={18} height={14} rx={2} />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}

function IconAccount(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" />
      <circle cx={12} cy={7} r={4} fill="none" />
    </svg>
  );
}

function IconMore(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx={5} cy={12} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={12} cy={12} r={1.5} fill="currentColor" stroke="none" />
      <circle cx={19} cy={12} r={1.5} fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Fixed bottom navigation for /user/* on small viewports (see globals.css `.user-mobile-tabbar`). */
export function UserPortalMobileTabbar({ active }: UserPortalMobileTabbarProps) {
  const [showGoLive, setShowGoLive] = useState(() => active === 'go-live' || readCachedGoLiveNavVisible() === true);
  const [showBillingAlert, setShowBillingAlert] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (active === 'go-live') {
      setShowGoLive(true);
    } else {
      const cached = readCachedGoLiveNavVisible();
      if (cached !== null) {
        setShowGoLive(cached);
      }
    }

    void fetch('/api/backend/user/nav-state')
      .then(async (response) => (await response.json()) as UserNavStateForMobileTabbar)
      .then((body) => {
        if (cancelled || !body.ok) {
          return;
        }
        const next = Boolean(!body.onboardingRequired && !body.liveCallsEnabled);
        setShowBillingAlert(shouldShowBillingAlertFromNavState(body));
        writeCachedGoLiveNavVisible(next);
        if (active !== 'go-live') {
          setShowGoLive(next);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [active]);

  const item = (key: UserPortalNavKey, href: string, label: string, icon: ReactNode, billingAlert = false) => {
    const isActive = active === key;
    return (
      <Link
        key={key}
        href={href}
        prefetch
        className={`user-mobile-tabbar__link${isActive ? ' user-mobile-tabbar__link--active' : ''}`}
      >
        <span className="user-mobile-tabbar__icon" style={billingAlert ? { position: 'relative' } : undefined}>
          {icon}
          {billingAlert ? (
            <span aria-label="Billing needs attention" title="Billing needs attention" style={{ position: 'absolute', top: -4, right: -7, display: 'inline-flex', color: '#dc2626', background: 'var(--surface-card, #fff)', borderRadius: 999 }}>
              <IconAlertCircleFilled size={13} stroke={1.8} aria-hidden="true" />
            </span>
          ) : null}
        </span>
        <span className="user-mobile-tabbar__label">{label}</span>
      </Link>
    );
  };

  const setupSlot =
    showGoLive || active === 'go-live' ? (
      item('go-live', '/user/go-live', 'Go live', <IconGoLive />)
    ) : (
      item('knowledge', '/user/knowledge', 'Knowledge', <IconKnowledge />)
    );

  return (
    <nav className="user-mobile-tabbar" aria-label="User portal">
      {item('overview', '/user', 'Overview', <IconOverview />)}
      {item('calls', '/user/calls', 'Calls', <IconCalls />)}
      {item('bookings', '/user/bookings', 'Bookings', <IconBookings />)}
      {setupSlot}
      {item('more', '/user/more', 'More', <IconMore />, showBillingAlert)}
    </nav>
  );
}
