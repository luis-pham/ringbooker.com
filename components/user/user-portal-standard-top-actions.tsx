'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

/** Wrapper class for the account shortcut in the portal top bar (theme/notifications alignment). */
export const USER_PORTAL_TOPBAR_ACTIONS_CLASS = 'portal-top-account';

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
      />
    </svg>
  );
}

async function signOut() {
  try {
    await fetch('/api/backend/auth/logout', { method: 'POST' });
  } finally {
    window.location.href = '/user/login';
  }
}

export function UserPortalStandardTopActions() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="portal-top-account-dd" ref={wrapRef}>
      <button
        type="button"
        className="portal-top-account-btn"
        aria-label="Account"
        title="Account"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <AccountIcon />
      </button>
      <div className={`portal-top-account-menu${open ? ' open' : ''}`} role="menu">
        <div className="portal-top-account-menu-inner">
          <Link
            href="/user/account"
            className="portal-top-account-menu-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            type="button"
            className="portal-top-account-menu-item portal-top-account-menu-item--logout"
            role="menuitem"
            onClick={() => void signOut()}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
