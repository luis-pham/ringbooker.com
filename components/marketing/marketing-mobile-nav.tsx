'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { useNavState } from '@/components/marketing/nav-actions-client';
import { MARKETING_INDUSTRY_NAV_ITEMS } from '@/lib/marketing-industry-nav';

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

function scrollToHomeHash(href: string) {
  if (!href.startsWith('/#')) return;
  const id = href.slice(2);
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.history.replaceState(null, '', href);
}

export function MarketingMobileNav({ active }: MarketingMobileNavProps) {
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const pathname = usePathname();
  const state = useNavState();
  const titleId = useId();

  useEffect(() => {
    setPortalReady(true);
  }, []);

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

  function onPrimaryNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    setOpen(false);
    if (!href.startsWith('/#')) return;
    if (pathname !== '/') return;
    e.preventDefault();
    requestAnimationFrame(() => scrollToHomeHash(href));
  }

  const drawer =
    open && portalReady ? (
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
            <a
              href="/"
              id={titleId}
              className="mk-nav-logo mk-drawer-head-logo"
              onClick={() => setOpen(false)}
            >
              <div className="mk-nav-logo-icon">
                <div className="mk-nav-ripple mk-nav-ripple-3" />
                <div className="mk-nav-ripple mk-nav-ripple-2" />
                <div className="mk-nav-ripple-core">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </div>
              </div>
              <span>RingBooker</span>
            </a>
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
                  onClick={(e) => onPrimaryNavClick(e, item.href)}
                >
                  <span className="mk-drawer-navlink-label">{item.label}</span>
                  <span className="mk-drawer-navlink-chevron" aria-hidden="true" />
                </a>
              );
            })}
            {MARKETING_INDUSTRY_NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="mk-drawer-navlink"
                onClick={() => setOpen(false)}
              >
                <span className="mk-drawer-navlink-label">
                  {item.icon} {item.label}
                </span>
                <span className="mk-drawer-navlink-chevron" aria-hidden="true" />
              </a>
            ))}
          </nav>

          <div className="mk-drawer-foot">
            <button
              type="button"
              className="mk-drawer-btn-demo"
              data-demo-picker
              onClick={() => setOpen(false)}
            >
              <DemoCtaPhoneIcon width={18} height={18} />
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
    ) : null;

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

      {portalReady && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}
