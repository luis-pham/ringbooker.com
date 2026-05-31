'use client';

import {
  IconBuildingHospital,
  IconMassage,
  IconPalette,
  IconScissors,
  IconVaccine,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useId, useState } from 'react';

const INDUSTRY_TABS = [
  {
    id: 'nail-salon',
    label: 'Nail Salon',
    Icon: IconPalette,
    title: 'Nail Salon',
    description:
      'Nail salons field fast walk-in checks, gel and acrylic pricing questions, and overflow calls when every station is booked. RingBooker answers with your menu, hours, and availability rules — then captures booking intent when your team is heads-down on clients.',
    tags: ['Walk-in availability', 'Gel & acrylic Q&A', 'Peak-hour overflow'],
    demoHref: '/demo/nail-salon',
  },
  {
    id: 'hair-salon',
    label: 'Hair Salon',
    Icon: IconScissors,
    title: 'Hair Salon',
    description:
      'Hair salons juggle stylist preference, chair timing, and color consultations that need more than a one-line answer. RingBooker routes calls by your rules, holds the right context, and hands off cleanly when a human should close the booking.',
    tags: ['Stylist preference', 'Chair availability', 'Color consultations'],
    demoHref: '/demo/hair-salon',
  },
  {
    id: 'day-spa',
    label: 'Day Spa',
    Icon: IconMassage,
    title: 'Day Spa',
    description:
      'Day spas get treatment selection questions, duration and package clarifications, and requests for a specific therapist. RingBooker talks through your service menu, confirms availability, and sends summaries your front desk can act on.',
    tags: ['Treatment selection', 'Duration questions', 'Therapist preference'],
    demoHref: '/demo/day-spa',
  },
  {
    id: 'med-spa',
    label: 'Med Spa',
    Icon: IconVaccine,
    title: 'Med Spa',
    description:
      'Med spa calls are consult-led, high-ticket, and often start with pricing scope before anyone commits. RingBooker qualifies intent, schedules consults within your policies, and keeps sensitive conversations professional.',
    tags: ['Consult scheduling', 'Pricing inquiries', 'High-ticket qualification'],
    demoHref: '/demo/med-spa',
  },
  {
    id: 'beauty-clinic',
    label: 'Beauty Clinic',
    Icon: IconBuildingHospital,
    title: 'Beauty Clinic',
    description:
      'Beauty clinics run multi-step journeys — initial consults, treatment plans, and follow-up calls across weeks. RingBooker keeps context across each touchpoint so callers never repeat themselves.',
    tags: ['Consults', 'Follow-up calls', 'Multi-step journeys'],
    demoHref: '/demo/beauty-clinic',
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
        {INDUSTRY_TABS.map(({ id, label, Icon }) => {
          const isActive = id === activeId;
          const tabId = `${baseId}-tab-${id}`;

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
              <Icon aria-hidden="true" stroke={1.75} />
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
      >
        <div className="industries-panel-head">
          <div className="industries-panel-icon" aria-hidden="true">
            <activeTab.Icon stroke={1.75} />
          </div>
          <div className="industries-panel-copy">
            <h3>{activeTab.title}</h3>
            <p className="industries-panel-desc">{activeTab.description}</p>
          </div>
        </div>
        <div className="industries-panel-chips" aria-label={`${activeTab.title} call patterns`}>
          {activeTab.tags.map((tag) => (
            <span key={tag} className="industries-panel-chip">
              {tag}
            </span>
          ))}
        </div>
        <Link href={activeTab.demoHref} className="btn-outline industries-panel-cta">
          Try live demo
        </Link>
      </div>
    </div>
  );
}
