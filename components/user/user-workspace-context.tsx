'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const USER_WORKSPACE_CACHE_KEY = 'rb_user_workspace_cache';

type UserWorkspaceState = {
  shopName: string;
  plan: string;
  active: boolean;
};

type UserWorkspaceContextValue = {
  workspace: UserWorkspaceState;
  setWorkspace: (next: Partial<UserWorkspaceState>) => void;
};

const DEFAULT_WORKSPACE: UserWorkspaceState = {
  shopName: 'Your Shop',
  plan: 'starter',
  active: true,
};

const UserWorkspaceContext = createContext<UserWorkspaceContextValue | null>(null);

type NavStateResponse = {
  ok: boolean;
  shopName?: string;
  plan?: string;
};

function isPublicUserAuthPath(pathname: string): boolean {
  return (
    pathname === '/user/login' ||
    pathname === '/user/signup' ||
    pathname === '/user/forgot-password' ||
    pathname === '/user/reset-password'
  );
}

export function UserWorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [workspace, setWorkspaceState] = useState<UserWorkspaceState>(DEFAULT_WORKSPACE);

  function setWorkspace(next: Partial<UserWorkspaceState>) {
    setWorkspaceState((current) => {
      const merged = { ...current, ...next };
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(USER_WORKSPACE_CACHE_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(USER_WORKSPACE_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as Partial<UserWorkspaceState>;
          setWorkspaceState((current) => ({ ...current, ...cached }));
        }
      } catch {
        // ignore cache parse errors
      }
    }

  }, []);

  useEffect(() => {
    if (!pathname.startsWith('/user')) return;
    if (isPublicUserAuthPath(pathname)) return;

    let canceled = false;
    void fetch('/api/backend/user/nav-state')
      .then(async (response) => (await response.json()) as NavStateResponse)
      .then((body) => {
        if (canceled || !body.ok) return;
        const next: Partial<UserWorkspaceState> = {
          shopName: body.shopName?.trim() || undefined,
          plan: body.plan?.trim() || undefined,
        };
        setWorkspace(next);
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [pathname]);

  const value = useMemo<UserWorkspaceContextValue>(
    () => ({
      workspace,
      setWorkspace,
    }),
    [workspace],
  );

  return <UserWorkspaceContext.Provider value={value}>{children}</UserWorkspaceContext.Provider>;
}

export function useUserWorkspace() {
  const ctx = useContext(UserWorkspaceContext);
  if (!ctx) {
    throw new Error('useUserWorkspace must be used within UserWorkspaceProvider');
  }
  return ctx;
}
