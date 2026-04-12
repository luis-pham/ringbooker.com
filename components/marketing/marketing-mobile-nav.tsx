'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';

import { MARKETING_DEMO_NAV_ITEMS } from '@/lib/marketing-demo-nav';
import { MARKETING_INDUSTRY_NAV_ITEMS } from '@/lib/marketing-industry-nav';

import { useNavState } from '@/components/marketing/nav-actions-client';

type MarketingMobileNavProps = {
  active?: 'demo' | 'pricing' | 'how-it-works' | 'contact' | 'industry';
};

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
            <div className="mk-drawer-head">
              <span id={titleId} className="mk-drawer-title">
                Menu
              </span>
              <button
                type="button"
                className="mk-drawer-close"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <nav className="mk-drawer-scroll" aria-label="Marketing">
              <a href="/#features" className="mk-drawer-link" onClick={() => setOpen(false)}>
                Features
              </a>

              <div className="mk-drawer-subhead">Industries</div>
              <a
                href="/#industries"
                className={`mk-drawer-link mk-drawer-indent${active === 'industry' ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                Overview
              </a>
              {MARKETING_INDUSTRY_NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="mk-drawer-link mk-drawer-indent"
                  onClick={() => setOpen(false)}
                >
                  <span className="mk-drawer-ico">{item.icon}</span>
                  {item.label}
                </a>
              ))}

              <div className="mk-drawer-subhead">Live Demo</div>
              <a
                href="/demo"
                className={`mk-drawer-link mk-drawer-indent${active === 'demo' ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                Live Demo hub
              </a>
              {MARKETING_DEMO_NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="mk-drawer-link mk-drawer-indent"
                  onClick={() => setOpen(false)}
                >
                  <span className="mk-drawer-ico">{item.icon}</span>
                  {item.label}
                </a>
              ))}

              <a
                href="/pricing"
                className={`mk-drawer-link${active === 'pricing' ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                Pricing
              </a>
              <a
                href="/how-it-works"
                className={`mk-drawer-link${active === 'how-it-works' ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                How It Works
              </a>
              <a
                href="/contact"
                className={`mk-drawer-link${active === 'contact' ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                Contact
              </a>
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
