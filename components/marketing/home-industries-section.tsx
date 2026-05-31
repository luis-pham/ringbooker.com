'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';

import { getMarketingVerticalIcon } from '@/components/marketing/marketing-vertical-icon';
import type { MarketingVerticalIconId } from '@/components/marketing/marketing-vertical-icon';

const INDUSTRY_TABS = [
  {
    id: 'nail-salon' as const satisfies MarketingVerticalIconId,
    label: 'Nail Salon',
    eyebrow: 'Nail Salon',
    title: 'Walk-ins, gel & peak-hour calls',
    description:
      'High call volume during peak hours. Callers asking about walk-in availability, gel vs. acrylic, and current wait times. RingBooker handles the queue so your techs stay focused on the client in the chair — not the phone.',
    tags: ['Walk-in availability', 'Gel & acrylic Q&A', 'Peak-hour overflow'],
    demoHref: '/demo/nail-salon',
    imageSrc: '/images/industries/nail.webp',
    imageAlt: 'Nail salon with manicure stations during a busy service day',
  },
  {
    id: 'hair-salon' as const satisfies MarketingVerticalIconId,
    label: 'Hair Salon',
    eyebrow: 'Hair Salon',
    title: 'Stylist preference & chair time',
    description:
      'Complex booking flows where callers want a specific stylist or service. RingBooker qualifies the request — stylist preference, color vs. cut, chair availability — and books the right slot without putting anyone on hold.',
    tags: ['Stylist preference', 'Chair availability', 'Color consultations'],
    demoHref: '/demo/hair-salon',
    imageSrc: '/images/industries/hair_shop.webp',
    imageAlt: 'Hair salon styling chairs and mirrors in a modern shop',
  },
  {
    id: 'day-spa' as const satisfies MarketingVerticalIconId,
    label: 'Day Spa',
    eyebrow: 'Day Spa',
    title: 'Treatment bookings & intake',
    description:
      'Treatment bookings need more conversation — duration, therapist gender preference, and availability windows. RingBooker handles the full intake naturally, without rushing the caller or losing the booking.',
    tags: ['Treatment selection', 'Duration questions', 'Therapist preference'],
    demoHref: '/demo/day-spa',
    imageSrc: '/images/industries/spa.webp',
    imageAlt: 'Day spa treatment room with calm lighting and fresh linens',
  },
  {
    id: 'med-spa' as const satisfies MarketingVerticalIconId,
    label: 'Med Spa',
    eyebrow: 'Med Spa',
    title: 'Consult-led, high-ticket calls',
    description:
      'High-ticket services mean callers research before committing. Pricing sensitivity, consult scheduling, and qualification are the primary call drivers. RingBooker handles it confidently — without overselling.',
    tags: ['Consult scheduling', 'Pricing inquiries', 'High-ticket qualification'],
    demoHref: '/demo/med-spa',
    imageSrc: '/images/industries/med_spa.webp',
    imageAlt: 'Med spa consult room with treatment equipment',
  },
  {
    id: 'beauty-clinic' as const satisfies MarketingVerticalIconId,
    label: 'Beauty Clinic',
    eyebrow: 'Beauty Clinic',
    title: 'Consults & follow-up journeys',
    description:
      'Multi-step patient journeys — initial consults, treatment plans, and follow-up calls across weeks. RingBooker keeps context across each touchpoint so callers never have to repeat themselves.',
    tags: ['Consults', 'Follow-up calls', 'Multi-step journeys'],
    demoHref: '/demo/beauty-clinic',
    imageSrc: '/images/industries/beauty_clinic.webp',
    imageAlt: 'Beauty clinic reception and consult area',
  },
] as const;

type IndustryTabId = (typeof INDUSTRY_TABS)[number]['id'];

export function HomeIndustriesSection({ className }: { className?: string }) {
  const baseId = useId();
  const [activeId, setActiveId] = useState<IndustryTabId>('nail-salon');
  const activeTab = INDUSTRY_TABS.find((tab) => tab.id === activeId) ?? INDUSTRY_TABS[0];
  const panelId = `${baseId}-panel`;

  return (
    <div className={className ? `industries-tabs-wrap ${className}` : 'industries-tabs-wrap'}>
      <div className="industries-tabs" role="tablist" aria-label="Salon verticals">
        {INDUSTRY_TABS.map(({ id, label }) => {
          const isActive = id === activeId;
          const tabId = `${baseId}-tab-${id}`;
          const TabIcon = getMarketingVerticalIcon(id);

          return (
            <button
              key={id}
              type="button"
              id={tabId}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              className={`industries-tab-btn${isActive ? ' is-active' : ''}`}
              onClick={() => setActiveId(id)}
            >
              <TabIcon aria-hidden="true" stroke={1.75} />
              {label}
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${activeTab.id}`}
        className="industries-panel"
        data-vertical={activeTab.id}
      >
        <div className="industries-panel-copy">
          <div className="industries-panel-eyebrow">{activeTab.eyebrow}</div>
          <h3>{activeTab.title}</h3>
          <p className="industries-panel-desc">{activeTab.description}</p>
          <div className="industries-panel-chips" aria-label={`${activeTab.eyebrow} call patterns`}>
            {activeTab.tags.map((tag) => (
              <span key={tag} className="industries-panel-chip">
                {tag}
              </span>
            ))}
          </div>
          <Link href={activeTab.demoHref} className="btn-dark industries-panel-cta">
            Try live demo →
          </Link>
        </div>

        <div className="industries-panel-visual" data-vertical={activeTab.id}>
          <Image
            key={activeTab.id}
            src={activeTab.imageSrc}
            alt={activeTab.imageAlt}
            fill
            className="industries-panel-photo"
            sizes="(max-width: 767px) 100vw, 420px"
          />
        </div>
      </div>
    </div>
  );
}
