'use client';

import type { UserPortalNavKey } from '@/components/user/user-portal-nav';
import { UserPortalNav } from '@/components/user/user-portal-nav';
import { useUserWorkspace } from '@/components/user/user-workspace-context';

type UserPortalSidebarProps = {
  active: UserPortalNavKey;
  workspaceOverride?: {
    shopName?: string;
    plan?: string;
    active?: boolean;
  };
};

function toPlanLabel(plan?: string) {
  const raw = (plan ?? 'starter').trim() || 'starter';
  return raw[0].toUpperCase() + raw.slice(1);
}

export function UserPortalSidebar({ active, workspaceOverride }: UserPortalSidebarProps) {
  const { workspace } = useUserWorkspace();
  const shopName = workspaceOverride?.shopName ?? workspace.shopName;
  const plan = workspaceOverride?.plan ?? workspace.plan;
  const isActive = workspaceOverride?.active ?? workspace.active;

  return (
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
          <div className="brand-text">
            <span className="brand-title">RingBooker</span>
            <p className="brand-tagline">User Portal</p>
          </div>
        </div>
        <div className="workspace">
          <h3>{shopName}</h3>
          <p>
            {isActive ? 'AI setup active' : 'Account paused'} · {toPlanLabel(plan)} plan
          </p>
        </div>
        <UserPortalNav active={active} />
        <div className="sidebar-spacer" />
      </div>
    </aside>
  );
}
