'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

export type UserPortalNavKey = 'overview' | 'bookings' | 'calls' | 'settings' | 'billing' | 'account';

type UserPortalNavProps = {
  active: UserPortalNavKey;
};

function navLink(key: UserPortalNavKey, href: string, label: string, icon: ReactNode, active: UserPortalNavKey) {
  const isActive = active === key;
  return (
    <Link key={key} className={`nav-item${isActive ? ' active' : ''}`} href={href}>
      <div className="nav-icon">{icon}</div>
      <span>{label}</span>
    </Link>
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

/** Shared left-rail links for authenticated `/user/*` pages. */
export function UserPortalNav({ active }: UserPortalNavProps) {
  return (
    <div className="nav-section">
      <div className="nav-label">User Portal</div>
      <div className="nav-list">
        {navLink('overview', '/user', 'Overview', <IconOverview />, active)}
        {navLink('bookings', '/user/bookings', 'Bookings', <IconBookings />, active)}
        {navLink('calls', '/user/calls', 'Calls & Transcripts', <IconCalls />, active)}
        {navLink('settings', '/user/settings', 'Settings', <IconSettings />, active)}
        {navLink('account', '/user/account', 'Account', <IconAccount />, active)}
        {navLink('billing', '/user/billing', 'Billing', <IconBilling />, active)}
      </div>
    </div>
  );
}
