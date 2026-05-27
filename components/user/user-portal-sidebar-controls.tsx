'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  applyUserSidebarCollapsed,
  persistUserSidebarCollapsed,
  readUserSidebarCollapsed,
} from '@/lib/user-portal-sidebar-preference';

type UserSidebarCollapsedContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  showSidebarTooltip: (label: string, target: HTMLElement) => void;
  hideSidebarTooltip: () => void;
};

const UserSidebarCollapsedContext = createContext<UserSidebarCollapsedContextValue | null>(null);

function canUseDesktopSidebarTooltip(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 861px)').matches;
}

export function UserSidebarCollapsedProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  useEffect(() => {
    const next = readUserSidebarCollapsed();
    setCollapsed(next);
    applyUserSidebarCollapsed(next);
  }, []);

  useEffect(() => {
    if (!collapsed) setTooltip(null);
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      persistUserSidebarCollapsed(next);
      applyUserSidebarCollapsed(next);
      return next;
    });
    setTooltip(null);
  }, []);

  const showSidebarTooltip = useCallback((label: string, target: HTMLElement) => {
    if (!canUseDesktopSidebarTooltip()) return;
    const rect = target.getBoundingClientRect();
    setTooltip({
      label,
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }, []);

  const hideSidebarTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      toggleCollapsed,
      showSidebarTooltip,
      hideSidebarTooltip,
    }),
    [collapsed, toggleCollapsed, showSidebarTooltip, hideSidebarTooltip],
  );

  return (
    <UserSidebarCollapsedContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && tooltip
        ? createPortal(
            <div
              className="user-portal-sidebar-tooltip"
              role="tooltip"
              style={{ top: tooltip.top, left: tooltip.left }}
            >
              {tooltip.label}
            </div>,
            document.body,
          )
        : null}
    </UserSidebarCollapsedContext.Provider>
  );
}

export function useUserSidebarCollapsed(): UserSidebarCollapsedContextValue {
  const ctx = useContext(UserSidebarCollapsedContext);
  if (!ctx) {
    throw new Error('useUserSidebarCollapsed must be used within UserSidebarCollapsedProvider');
  }
  return ctx;
}

export function useSidebarNavTooltipHandlers(label: string) {
  const { collapsed, showSidebarTooltip, hideSidebarTooltip } = useUserSidebarCollapsed();

  const showFromTarget = useCallback(
    (target: HTMLElement) => {
      if (!collapsed) return;
      showSidebarTooltip(label, target);
    },
    [collapsed, label, showSidebarTooltip],
  );

  return {
    onMouseEnter: (event: MouseEvent<HTMLElement>) => showFromTarget(event.currentTarget),
    onMouseLeave: hideSidebarTooltip,
    onFocus: (event: FocusEvent<HTMLElement>) => showFromTarget(event.currentTarget),
    onBlur: hideSidebarTooltip,
  };
}

export function UserPortalSidebarCollapseToggle() {
  const { collapsed, toggleCollapsed, showSidebarTooltip, hideSidebarTooltip } = useUserSidebarCollapsed();
  const tooltipLabel = collapsed ? 'Expand menu' : 'Collapse menu';

  return (
    <button
      type="button"
      className="sidebar-collapse-btn"
      aria-pressed={collapsed}
      aria-label={collapsed ? 'Expand sidebar menu' : 'Collapse sidebar menu'}
      title={collapsed ? tooltipLabel : undefined}
      onClick={toggleCollapsed}
      onMouseEnter={(event) => {
        if (collapsed) showSidebarTooltip(tooltipLabel, event.currentTarget);
      }}
      onMouseLeave={hideSidebarTooltip}
      onFocus={(event) => {
        if (collapsed) showSidebarTooltip(tooltipLabel, event.currentTarget);
      }}
      onBlur={hideSidebarTooltip}
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
