'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';

import { getMarketingVerticalIcon } from '@/components/marketing/marketing-vertical-icon';
import type { MarketingVerticalIconId } from '@/components/marketing/marketing-vertical-icon';

export type HomeIndustryTab = {
  id: MarketingVerticalIconId;
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  demo_href: string;
  image: string;
  image_alt: string;
};

type IndustryTabId = HomeIndustryTab['id'];

interface IndustriesSectionProps {
  tabs: HomeIndustryTab[];
  aria_label: string;
  cta_label: string;
  className?: string;
}

export function HomeIndustriesSection({ tabs, aria_label, cta_label, className }: IndustriesSectionProps) {
  const baseId = useId();
  const [activeId, setActiveId] = useState<IndustryTabId>(tabs[0]?.id ?? 'nail-salon');
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const panelId = `${baseId}-panel`;

  if (!activeTab) return null;

  return (
    <div className={className ? `industries-tabs-wrap ${className}` : 'industries-tabs-wrap'}>
      <div className="industries-tabs" role="tablist" aria-label={aria_label}>
        {tabs.map(({ id, eyebrow }) => {
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
              {eyebrow}
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
          <Link href={activeTab.demo_href} className="btn-dark industries-panel-cta">
            {cta_label}
          </Link>
        </div>

        <div className="industries-panel-visual" data-vertical={activeTab.id}>
          <Image
            key={activeTab.id}
            src={activeTab.image}
            alt={activeTab.image_alt}
            fill
            className="industries-panel-photo"
            sizes="(max-width: 767px) 100vw, 420px"
          />
        </div>
      </div>
    </div>
  );
}
