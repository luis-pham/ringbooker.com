'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { useNavState } from '@/components/marketing/nav-actions-client';

type MarketingMobileNavProps = {
  active?: 'demo' | 'pricing' | 'how-it-works' | 'contact' | 'industry';
};

const PRIMARY_NAV: {
  href: string;
  label: string;
  active?: MarketingMobileNavProps['active'];
}[] = [
  { href: '/#features', label: 'Features' },
  { href: '/#industries', label: 'Industries', active: 'industry' },
  { href: '/pricing', label: 'Pricing', active: 'pricing' },
  { href: '/how-it-works', label: 'How It Works', active: 'how-it-works' },
  { href: '/contact', label: 'Contact', active: 'contact' },
];

export function MarketingMobileNav({ active }: MarketingMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const state = useNavState();
  const titleId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="mk-nav-burger"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls={open ? 'mk-mobile-drawer' : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <>
          <div
            className="mk-drawer-backdrop"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            id="mk-mobile-drawer"
            className="mk-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="mk-drawer-head">
              <div className="mk-drawer-head-text">
                <span className="mk-drawer-eyebrow">RingBooker</span>
                <span id={titleId} className="mk-drawer-title">
                  Menu
                </span>
              </div>
              <button
                type="button"
                className="mk-drawer-close"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            <nav className="mk-drawer-nav" aria-label="Primary">
              {PRIMARY_NAV.map((item) => {
                const isActive = item.active !== undefined && active === item.active;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={`mk-drawer-navlink${isActive ? ' active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="mk-drawer-navlink-label">{item.label}</span>
                    <span className="mk-drawer-navlink-chevron" aria-hidden="true" />
                  </a>
                );
              })}
            </nav>

            <div className="mk-drawer-foot">
              <button
                type="button"
                className="mk-drawer-btn-demo"
                data-demo-picker
                onClick={() => setOpen(false)}
              >
                Try a Live Demo Call
              </button>
              {state.type === 'visitor' ? (
                <>
                  <a
                    href="/user/signup"
                    className="mk-drawer-btn-cta"
                    onClick={() => setOpen(false)}
                  >
                    Start Free Trial →
                  </a>
                  <a
                    href="/user/login"
                    className="mk-drawer-signin"
                    onClick={() => setOpen(false)}
                  >
                    Sign In
                  </a>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
