'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  applyUserSidebarCollapsed,
  persistUserSidebarCollapsed,
  readUserSidebarCollapsed,
} from '@/lib/user-portal-sidebar-preference';

type UserSidebarCollapsedContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const UserSidebarCollapsedContext = createContext<UserSidebarCollapsedContextValue | null>(null);

export function UserSidebarCollapsedProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const next = readUserSidebarCollapsed();
    setCollapsed(next);
    applyUserSidebarCollapsed(next);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persistUserSidebarCollapsed(next);
      applyUserSidebarCollapsed(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed,
    }),
    [collapsed, toggleCollapsed],
  );

  return (
    <UserSidebarCollapsedContext.Provider value={value}>{children}</UserSidebarCollapsedContext.Provider>
  );
}

export function useUserSidebarCollapsed(): UserSidebarCollapsedContextValue {
  const ctx = useContext(UserSidebarCollapsedContext);
  if (!ctx) {
    throw new Error('useUserSidebarCollapsed must be used within UserSidebarCollapsedProvider');
  }
  return ctx;
}

export function UserPortalSidebarCollapseToggle() {
  const { collapsed, toggleCollapsed } = useUserSidebarCollapsed();

  return (
    <button
      type="button"
      className="sidebar-collapse-btn"
      aria-pressed={collapsed}
      aria-label={collapsed ? 'Expand sidebar menu' : 'Collapse sidebar menu'}
      title={collapsed ? 'Expand menu' : 'Collapse menu'}
      data-tooltip={collapsed ? 'Expand menu' : undefined}
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
