'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserPortalTheme = 'light' | 'dark';

const STORAGE_KEY = 'rb_user_portal_theme';

type UserThemeContextValue = {
  theme: UserPortalTheme;
  setTheme: (next: UserPortalTheme) => void;
  toggleTheme: () => void;
};

const UserThemeContext = createContext<UserThemeContextValue | null>(null);

export function UserThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<UserPortalTheme>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        setThemeState(stored);
      }
    } catch {
      // ignore
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.userTheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme, ready]);

  const setTheme = useCallback((next: UserPortalTheme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <UserThemeContext.Provider value={value}>{children}</UserThemeContext.Provider>;
}

export function useUserTheme(): UserThemeContextValue {
  const ctx = useContext(UserThemeContext);
  if (!ctx) {
    throw new Error('useUserTheme must be used within UserThemeProvider');
  }
  return ctx;
}
