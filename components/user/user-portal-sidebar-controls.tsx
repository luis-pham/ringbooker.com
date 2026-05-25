'use client';

import { useEffect, useState } from 'react';

import {
  applyUserSidebarCollapsed,
  persistUserSidebarCollapsed,
  readUserSidebarCollapsed,
} from '@/lib/user-portal-sidebar-preference';

export function useUserSidebarCollapsed(): { collapsed: boolean } {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const next = readUserSidebarCollapsed();
    setCollapsed(next);
    applyUserSidebarCollapsed(next);
  }, []);

  return { collapsed };
}

export function UserPortalSidebarCollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readUserSidebarCollapsed());
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      persistUserSidebarCollapsed(next);
      applyUserSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <button
      type="button"
      className="sidebar-collapse-btn"
      aria-pressed={collapsed}
      aria-label={collapsed ? 'Expand sidebar menu' : 'Collapse sidebar menu'}
      title={collapsed ? 'Expand menu' : 'Collapse menu'}
      onClick={toggleCollapsed}
    >
      <svg viewBox="0 0 24 24" aria-hidden>
        {collapsed ? (
          <path d="M13 5l6 7-6 7M5 5v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M11 19l-6-7 6-7M19 5v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span className="sidebar-collapse-label">{collapsed ? 'Expand menu' : 'Collapse menu'}</span>
    </button>
  );
}
