'use client';

import { useEffect, useState } from 'react';

import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';

const VERTICALS = [
  { icon: '💅', label: 'Nail Salon', sub: 'Booking, pricing, bilingual', href: '/demo/nail-salon', className: 'dpm-card-nail-salon' },
  { icon: '✂️', label: 'Hair Salon', sub: 'Stylist match, color, reschedule', href: '/demo/hair-salon', className: 'dpm-card-hair-salon' },
  { icon: '🧖', label: 'Day Spa', sub: 'Couples, packages, after-hours', href: '/demo/day-spa', className: 'dpm-card-day-spa' },
  { icon: '💉', label: 'Med Spa', sub: 'Consultation-first, provider handoff', href: '/demo/med-spa', className: 'dpm-card-med-spa' },
  { icon: '✨', label: 'Beauty Clinic', sub: 'Pre-care, session continuity', href: '/demo/beauty-clinic', className: 'dpm-card-beauty-clinic' },
];

function ArrowRightMini() {
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

export function DemoPickerModal({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-demo-picker]')) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="dpm-overlay" onClick={() => setOpen(false)}>
      <div
        className="dpm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose demo industry"
      >
        <button className="dpm-close" onClick={() => setOpen(false)} aria-label="Close">
          <svg viewBox="0 0 14 14" width="12" height="12"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <div className="dpm-head">
          <div className="dpm-eyebrow">
            <DemoCtaPhoneIcon width={14} height={14} />
            Live demo call
          </div>
          <h2 className="dpm-title">Which type of business would you like to hear?</h2>
          <p className="dpm-sub">We call the number you enter with a real AI voice — pick your industry below.</p>
        </div>
        <div className="dpm-grid">
          {VERTICALS.map((v) => (
            <a
              key={v.href}
              href={v.href}
              className={`dpm-card ${v.className}`}
            >
              <span className="dpm-icon">{v.icon}</span>
              <span className="dpm-label">{v.label}</span>
              <span className="dpm-card-sub">{v.sub}</span>
              <span className="dpm-arrow">
                <ArrowRightMini />
              </span>
            </a>
          ))}
        </div>
        <p className="dpm-note">Outbound demo only · Your real phone system is never changed</p>
      </div>
    </div>
  );
}
