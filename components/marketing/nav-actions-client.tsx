'use client';

import { useEffect, useRef, useState } from 'react';

// ─── State Model ──────────────────────────────────────────────────────────────

export type NavStateType =
  | 'loading'
  | 'visitor'
  | 'setup_incomplete'
  | 'trial_user'
  | 'active_customer'
  | 'dashboard_user'; // paid or plan-based, no subscription record

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
 * Never shows "Start Free Trial" or "Sign In" to authenticated users.
 */
export function resolveNavCta(state: NavUserState): { label: string; href: string } {
  switch (state.type) {
    case 'visitor':
      return { label: 'Start Free Trial →', href: '/user/signup' };
    case 'setup_incomplete':
      return { label: 'Continue Setup →', href: '/user/onboarding' };
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

// ─── State Fetcher ────────────────────────────────────────────────────────────

async function fetchNavState(): Promise<NavUserState> {
  try {
    const res = await fetch('/api/backend/user/nav-state', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return { type: 'visitor' };
    if (!res.ok) return { type: 'visitor' };
    const data = (await res.json()) as {
      ok: boolean;
      email?: string;
      shopName?: string;
      userName?: string;
      plan?: string;
      onboardingRequired?: boolean;
      subscriptionStatus?: string | null;
    };
    if (!data.ok) return { type: 'visitor' };

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
    return { type: 'visitor' };
  }
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

async function handleSignOut() {
  try {
    await fetch('/api/backend/auth/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/';
  }
}

// ─── Avatar Dropdown ──────────────────────────────────────────────────────────

function AvatarMenu({
  state,
  open,
  onClose,
}: {
  state: Exclude<NavUserState, { type: 'loading' } | { type: 'visitor' }>;
  open: boolean;
  onClose: () => void;
}) {
  const showUpgrade = state.type === 'trial_user' || (state.type === 'dashboard_user' && state.plan === 'starter');

  return (
    <div className={`mk-avatar-menu${open ? ' open' : ''}`} role="menu">
      <div className="mk-avatar-menu-inner">
        {/* User identity header */}
        <div className="mk-avatar-head">
          <div className="mk-avatar-name">{state.shopName || state.email}</div>
          <div className="mk-avatar-email">{state.email}</div>
          {'plan' in state && (
            <div className="mk-avatar-plan">{getPlanLabel(state.plan)}</div>
          )}
        </div>

        {/* Nav links (doubles as mobile nav) */}
        <div className="mk-avatar-items mk-avatar-mobile-nav">
          <a href="/#features" className="mk-avatar-item" onClick={onClose}>Features</a>
          <a href="/#industries" className="mk-avatar-item" onClick={onClose}>Industries</a>
          <a href="/pricing" className="mk-avatar-item" onClick={onClose}>Pricing</a>
          <a href="/how-it-works" className="mk-avatar-item" onClick={onClose}>How It Works</a>
        </div>

        <div className="mk-avatar-sep" />

        {/* Account links */}
        <div className="mk-avatar-items">
          <a href="/user" className="mk-avatar-item" onClick={onClose}>
            <span>⚡</span> Dashboard
          </a>
          {state.type === 'setup_incomplete' && (
            <a href="/user/onboarding" className="mk-avatar-item" onClick={onClose}>
              <span>🔧</span> Continue Setup
            </a>
          )}
          <a href="/user/settings" className="mk-avatar-item" onClick={onClose}>
            <span>⚙️</span> Settings
          </a>
          <a href="/user/billing" className="mk-avatar-item" onClick={onClose}>
            <span>💳</span> Billing
          </a>
          {showUpgrade && (
            <a href="/pricing" className="mk-avatar-item mk-avatar-upgrade" onClick={onClose}>
              <span>✨</span> Upgrade Plan
            </a>
          )}
        </div>

        <div className="mk-avatar-sep" />

        <div className="mk-avatar-items">
          <button className="mk-avatar-item mk-avatar-signout" onClick={handleSignOut}>
            <span>→</span> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * State-aware nav actions — replaces the static Sign In / Start Free Trial buttons.
 * Renders correct CTAs per authentication + account state.
 */
export function NavActionsClient() {
  const [state, setState] = useState<NavUserState>({ type: 'loading' });
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNavState().then(setState);
  }, []);

  // Close dropdown on outside click
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

  // ── Visitor state ──
  if (state.type === 'visitor') {
    return (
      <div className="mk-nav-actions">
        <a href="/user/login" className="mk-nav-signin">Sign In</a>
        <a href="/user/signup" className="mk-nav-cta">Start Free Trial →</a>
      </div>
    );
  }

  // ── Loading state — show nothing to avoid flash ──
  if (state.type === 'loading') {
    return (
      <div className="mk-nav-actions">
        <div className="mk-nav-skel" aria-hidden="true" />
      </div>
    );
  }

  // ── Authenticated states ──
  const cta = resolveNavCta(state);
  const showUpgradeCta = state.type === 'trial_user';

  return (
    <div className="mk-nav-actions" ref={containerRef}>
      {/* Upgrade secondary CTA for trial users */}
      {showUpgradeCta && (
        <a href="/pricing" className="mk-nav-upgrade">Upgrade</a>
      )}

      {/* Primary CTA */}
      <a href={cta.href} className="mk-nav-cta">
        {cta.label}
      </a>

      {/* Avatar button + dropdown */}
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
