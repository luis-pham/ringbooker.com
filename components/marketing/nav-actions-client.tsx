'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';

// ─── State Model ──────────────────────────────────────────────────────────────

export type NavStateType =
  | 'loading'
  | 'visitor'
  | 'setup_incomplete'
  | 'trial_user'
  | 'active_customer'
  | 'dashboard_user';

export type NavUserState =
  | { type: 'loading' }
  | { type: 'visitor' }
  | { type: 'setup_incomplete'; email: string; shopName: string; initials: string }
  | { type: 'trial_user'; email: string; shopName: string; initials: string; plan: string }
  | { type: 'active_customer'; email: string; shopName: string; initials: string; plan: string }
  | { type: 'dashboard_user'; email: string; shopName: string; initials: string; plan: string };

// ─── CTA Resolver ─────────────────────────────────────────────────────────────

/**
 * Central CTA decision function.
 * Maps nav state → primary CTA label + href.
 * Never shows visitor CTAs or "Sign In" to authenticated users.
 */
export function resolveNavCta(state: NavUserState): { label: string; href: string } {
  switch (state.type) {
    case 'visitor':
      return { label: 'Try a Live Demo', href: '/demo' };
    case 'setup_incomplete':
      return { label: 'Continue Setup', href: '/user/onboarding' };
    case 'trial_user':
      return { label: 'Open Dashboard', href: '/user' };
    case 'active_customer':
    case 'dashboard_user':
      return { label: 'Dashboard', href: '/user' };
    case 'loading':
      return { label: 'Dashboard', href: '/user' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(userName: string, email: string): string {
  if (userName.trim()) {
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0]! + parts[1][0]!).toUpperCase();
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getPlanLabel(plan: string): string {
  const labels: Record<string, string> = {
    starter: 'Starter',
    professional: 'Professional',
    enterprise: 'Enterprise',
  };
  return labels[plan] ?? plan;
}

/** Safari & older browsers may lack `AbortSignal.timeout`; avoid hanging fetches. */
function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

function dashboardFallbackFromEmail(email: string): NavUserState {
  return {
    type: 'dashboard_user',
    email,
    shopName: '',
    initials: getInitials('', email),
    plan: 'starter',
  };
}

type FetchNavStateOpts = {
  /** When set, non-401 failures keep the user in an authenticated nav instead of visitor. */
  confirmedUserEmail?: string;
};

async function fetchNavState(opts?: FetchNavStateOpts): Promise<NavUserState> {
  const fallbackEmail = opts?.confirmedUserEmail;
  try {
    const res = await fetch('/api/backend/user/nav-state', {
      cache: 'no-store',
      credentials: 'include',
      signal: abortAfter(12_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { type: 'visitor' };
    }
    if (!res.ok) {
      return fallbackEmail ? dashboardFallbackFromEmail(fallbackEmail) : { type: 'visitor' };
    }
    const data = (await res.json()) as {
      ok: boolean;
      email?: string;
      shopName?: string;
      userName?: string;
      plan?: string;
      onboardingRequired?: boolean;
      subscriptionStatus?: string | null;
    };
    if (!data.ok) {
      return fallbackEmail ? dashboardFallbackFromEmail(fallbackEmail) : { type: 'visitor' };
    }

    const email = data.email ?? '';
    const shopName = data.shopName ?? '';
    const userName = data.userName ?? '';
    const plan = data.plan ?? 'starter';
    const initials = getInitials(userName, email);

    if (data.onboardingRequired) {
      return { type: 'setup_incomplete', email, shopName, initials };
    }
    if (data.subscriptionStatus === 'trialing') {
      return { type: 'trial_user', email, shopName, initials, plan };
    }
    if (data.subscriptionStatus === 'active') {
      return { type: 'active_customer', email, shopName, initials, plan };
    }
    return { type: 'dashboard_user', email, shopName, initials, plan };
  } catch {
    return fallbackEmail ? dashboardFallbackFromEmail(fallbackEmail) : { type: 'visitor' };
  }
}

/**
 * Single resolver: cheap JWT session first, then account-aware nav-state.
 * Guests resolve from /auth/me only (no dependency on a slow /user/nav-state).
 */
async function resolveMarketingNavOnce(): Promise<NavUserState> {
  let meRes: Response;
  try {
    meRes = await fetch('/api/backend/auth/me', {
      credentials: 'include',
      cache: 'no-store',
      signal: abortAfter(6_000),
    });
  } catch {
    return { type: 'visitor' };
  }

  if (meRes.status === 401 || meRes.status === 403) {
    return { type: 'visitor' };
  }
  if (!meRes.ok) {
    return { type: 'visitor' };
  }

  const meJson = (await meRes.json().catch(() => null)) as {
    ok?: boolean;
    session?: { role?: string; email?: string };
  } | null;

  if (!meJson?.ok || !meJson.session || meJson.session.role !== 'user' || typeof meJson.session.email !== 'string') {
    return { type: 'visitor' };
  }

  return fetchNavState({ confirmedUserEmail: meJson.session.email });
}

/** One in-flight resolve shared by desktop + mobile nav (both call `useNavState`). */
let marketingNavInflight: Promise<NavUserState> | null = null;

export async function resolveMarketingNav(): Promise<NavUserState> {
  if (!marketingNavInflight) {
    marketingNavInflight = resolveMarketingNavOnce().finally(() => {
      marketingNavInflight = null;
    });
  }
  return marketingNavInflight;
}

/** Last resolved marketing nav (never `loading`). Survives route changes in the same tab to avoid nav skeleton flicker. */
let marketingNavResolvedCache: NavUserState | null = null;

// ─── Sign Out ─────────────────────────────────────────────────────────────────

/** Cleared on sign-out so the next session never inherits the previous user’s nav. */
export function clearMarketingNavCache() {
  marketingNavResolvedCache = null;
  marketingNavInflight = null;
}

async function handleSignOut() {
  try {
    clearMarketingNavCache();
    await fetch('/api/backend/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/';
  }
}

// ─── Avatar Dropdown ──────────────────────────────────────────────────────────

type AvatarMenuState = Exclude<NavUserState, { type: 'loading' } | { type: 'visitor' }>;

function IconArrowRightMini() {
  return (
    <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden>
      <path
        d="M3 8h9M8.5 3.5 13 8l-4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AvatarMenu({
  state,
  open,
  onClose,
}: {
  state: AvatarMenuState;
  open: boolean;
  onClose: () => void;
}) {
  const showUpgrade = state.type === 'trial_user' || (state.type === 'dashboard_user' && state.plan === 'starter');

  return (
    <div className={`mk-avatar-menu${open ? ' open' : ''}`} role="menu">
      <div className="mk-avatar-menu-inner">
        <div className="mk-avatar-head">
          <div className="mk-avatar-name">
            {state.shopName.trim() ? state.shopName : state.email}
          </div>
          {state.shopName.trim() ? (
            <div className="mk-avatar-email">{state.email}</div>
          ) : null}
          {'plan' in state && (
            <div className="mk-avatar-plan">{getPlanLabel(state.plan)}</div>
          )}
        </div>

        <div className="mk-avatar-items">
          <Link href="/user" className="mk-avatar-item" onClick={onClose}>
            <span>⚡</span> Dashboard
          </Link>
          {state.type === 'setup_incomplete' && (
            <Link href="/user/onboarding" className="mk-avatar-item" onClick={onClose}>
              <span>🔧</span> Continue Setup
            </Link>
          )}
          <Link href="/user/settings" className="mk-avatar-item" onClick={onClose}>
            <span>⚙️</span> Settings
          </Link>
          <Link href="/user/billing" className="mk-avatar-item" onClick={onClose}>
            <span>💳</span> Billing
          </Link>
          {showUpgrade && (
            <Link href="/pricing" className="mk-avatar-item mk-avatar-upgrade" onClick={onClose}>
              <span>✨</span> Upgrade Plan
            </Link>
          )}
        </div>

        <div className="mk-avatar-sep" />

        <div className="mk-avatar-items">
          <button className="mk-avatar-item mk-avatar-signout" onClick={handleSignOut}>
            <span><IconArrowRightMini /></span> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hook: shared nav state (desktop + mobile use same component instance per header) ──

export function useNavState() {
  const pathname = usePathname();
  const [state, setState] = useState<NavUserState>(() => marketingNavResolvedCache ?? { type: 'loading' });
  const genRef = useRef(0);

  useEffect(() => {
    const myGen = (genRef.current += 1);
    const hasCache = marketingNavResolvedCache !== null;
    if (!hasCache) {
      setState({ type: 'loading' });
    }
    const safetyTimer = window.setTimeout(() => {
      if (myGen !== genRef.current) return;
      setState((prev) => {
        if (prev.type !== 'loading') return prev;
        marketingNavResolvedCache = { type: 'visitor' };
        return { type: 'visitor' };
      });
    }, 12_000);
    void (async () => {
      const next = await resolveMarketingNav();
      if (myGen !== genRef.current) return;
      if (next.type !== 'loading') {
        marketingNavResolvedCache = next;
      }
      setState(next);
    })();
    return () => {
      window.clearTimeout(safetyTimer);
      genRef.current += 1;
    };
  }, [pathname]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        const myGen = (genRef.current += 1);
        void (async () => {
          const next = await resolveMarketingNav();
          if (myGen !== genRef.current) return;
          if (next.type !== 'loading') {
            marketingNavResolvedCache = next;
          }
          setState(next);
        })();
      }, 400);
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (debounce) clearTimeout(debounce);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return state;
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * State-aware nav actions — replaces the static Sign In / Start Free Trial buttons.
 * Renders correct CTAs per authentication + account state.
 */
export function NavActionsClient() {
  const state = useNavState();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (state.type === 'visitor') {
    return (
      <div className="mk-nav-actions">
        <Link href="/user/login" className="mk-nav-signin">Sign In</Link>
        <a href="/demo" className="mk-nav-cta mk-nav-cta-hide-sm" data-demo-picker>
          <DemoCtaPhoneIcon width={16} height={16} />
          Try a Live Demo
        </a>
      </div>
    );
  }

  if (state.type === 'loading') {
    return (
      <div className="mk-nav-actions">
        <div className="mk-nav-skel" aria-hidden="true" />
      </div>
    );
  }

  const cta = resolveNavCta(state);
  const showUpgradeCta = state.type === 'trial_user';

  return (
    <div className="mk-nav-actions" ref={containerRef}>
      {showUpgradeCta && (
        <Link href="/pricing" className="mk-nav-upgrade">Upgrade</Link>
      )}

      <Link href={cta.href} className="mk-nav-cta mk-nav-cta-hide-sm">
        {cta.label}
      </Link>

      <div className="mk-avatar-dd">
        <button
          className="mk-avatar-btn"
          aria-label="Account menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {state.initials}
        </button>
        <AvatarMenu
          state={state}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />
      </div>
    </div>
  );
}
