'use client';

import type { UserPortalNavKey } from '@/components/user/user-portal-nav';
import { UserPortalNav } from '@/components/user/user-portal-nav';
import { UserPortalNotifications } from '@/components/user/user-portal-notifications';
import {
  UserPortalSidebarCollapseToggle,
  useUserSidebarCollapsed,
} from '@/components/user/user-portal-sidebar-controls';
import { UserPortalThemeToggle } from '@/components/user/user-portal-theme-toggle';

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" fill="none" />
      <polyline points="16 17 21 12 16 7" fill="none" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

type UserPortalSidebarProps = {
  active: UserPortalNavKey;
};

export function UserPortalSidebar({ active }: UserPortalSidebarProps) {
  const { collapsed } = useUserSidebarCollapsed();

  async function signOut() {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
    window.location.href = '/user/login';
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-body">
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
            <div className="brand-text">
              <span className="brand-title">RingBooker</span>
            </div>
            <div className="brand-mobile-actions" aria-label="Quick actions">
              <UserPortalNotifications />
              <UserPortalThemeToggle />
            </div>
          </div>
          <UserPortalNav active={active} />
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-footer-controls">
            <UserPortalSidebarCollapseToggle />
          </div>
          <button
            type="button"
            className="sidebar-logout"
            title={collapsed ? 'Sign out' : undefined}
            onClick={() => void signOut()}
          >
            <IconLogout />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
