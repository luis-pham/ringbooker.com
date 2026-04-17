'use client';

import { useCallback, useState } from 'react';

import type { ContentHubFaq } from '@/components/marketing/marketing-content-hub';

export type HtmlHubFaqProps = {
  items: ContentHubFaq[];
  /** Match static HTML: purple (default) or green accents */
  accent?: 'purple' | 'green';
};

/**
 * FAQ list matching static hub HTML (`faq-list` / `faq-q` / `.open` + rotate icon).
 */
export function HtmlHubFaq({ items, accent = 'purple' }: HtmlHubFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  if (items.length === 0) return null;

  const iconClass = accent === 'green' ? 'faq-icon faq-icon--green' : 'faq-icon';

  return (
    <div className="faq-list">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div className={`faq-item${isOpen ? ' open' : ''}`} key={item.q}>
            <button type="button" className="faq-q" onClick={() => toggle(i)} aria-expanded={isOpen}>
              {item.q}
              <span className={iconClass} aria-hidden>
                +
              </span>
            </button>
            <div className="faq-a">
              <p>{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
