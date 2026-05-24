'use client';

import { useEffect, useState } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'admin-sidebar-collapsed';
const THEME_KEY = 'admin-theme';

type AdminTheme = 'dark' | 'light';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function readTheme(): AdminTheme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function applyShellClasses(collapsed: boolean, theme: AdminTheme) {
  const root = document.documentElement;
  root.classList.toggle('sidebar-collapsed', collapsed);
  root.classList.toggle('admin-theme-light', theme === 'light');
}

export function AdminSidebarShellControls() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>('dark');

  useEffect(() => {
    const nextCollapsed = readCollapsed();
    const nextTheme = readTheme();
    setCollapsed(nextCollapsed);
    setTheme(nextTheme);
    applyShellClasses(nextCollapsed, nextTheme);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      applyShellClasses(next, readTheme());
      return next;
    });
  }

  function toggleTheme() {
    setTheme((prev) => {
      const next: AdminTheme = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      applyShellClasses(readCollapsed(), next);
      return next;
    });
  }

  return (
    <div aria-label="Admin display options" className="sidebar-shell-controls">
      <button
        type="button"
        className="sidebar-shell-btn"
        aria-pressed={collapsed}
        aria-label={collapsed ? 'Expand sidebar menu' : 'Collapse sidebar menu'}
        title={collapsed ? 'Expand menu' : 'Collapse menu'}
        onClick={toggleCollapsed}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          {collapsed ? (
            <path d="M13 5l6 7-6 7M5 5v14" />
          ) : (
            <path d="M11 19l-6-7 6-7M19 5v14" />
          )}
        </svg>
        <span className="sidebar-control-label">{collapsed ? 'Expand menu' : 'Collapse menu'}</span>
      </button>
      <button
        type="button"
        className="sidebar-shell-btn"
        aria-pressed={theme === 'light'}
        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        title={theme === 'light' ? 'Dark theme' : 'Light theme'}
        onClick={toggleTheme}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          {theme === 'light' ? (
            <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 1 0 9.8 9.8z" />
          ) : (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          )}
        </svg>
        <span className="sidebar-control-label">{theme === 'light' ? 'Dark theme' : 'Light theme'}</span>
      </button>
    </div>
  );
}
