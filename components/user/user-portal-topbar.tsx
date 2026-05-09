'use client';

import type { ReactNode } from 'react';

import { UserPortalThemeToggle } from '@/components/user/user-portal-theme-toggle';

export type UserPortalTopbarUserSummary = {
  displayName: string;
  subtitle?: string;
  initials?: string;
};

type UserPortalTopbarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  actionsClassName?: string;
  /** Shown on desktop only (hidden below 861px) — matches enterprise header chip pattern. */
  userSummary?: UserPortalTopbarUserSummary | null;
};

function chipInitials(displayName: string, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim().slice(0, 2).toUpperCase();
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? '?';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return (a + (b ?? '')).toUpperCase();
}

export function UserPortalTopbar({ title, subtitle, actions, actionsClassName, userSummary }: UserPortalTopbarProps) {
  return (
    <div className="topbar">
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="topbar-trailing">
        {userSummary ? (
          <div className="topbar-user-chip" aria-hidden={false}>
            <div className="topbar-user-chip-meta">
              <p className="topbar-user-chip-name">{userSummary.displayName}</p>
              {userSummary.subtitle ? <p className="topbar-user-chip-sub">{userSummary.subtitle}</p> : null}
            </div>
            <div className="topbar-user-chip-avatar">{chipInitials(userSummary.displayName, userSummary.initials)}</div>
          </div>
        ) : null}
        <UserPortalThemeToggle />
        {actions ? <div className={`top-actions${actionsClassName ? ` ${actionsClassName}` : ''}`}>{actions}</div> : null}
      </div>
    </div>
  );
}
