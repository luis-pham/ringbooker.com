'use client';

import { useEffect, useMemo, useState } from 'react';

import type { TocItem } from '@/lib/extractToc';

export function TableOfContents({ toc }: { toc: TocItem[] }) {
  const [active, setActive] = useState(toc[0]?.id ?? '');

  const visibleToc = useMemo(() => toc.filter((item) => item.level <= 3), [toc]);

  useEffect(() => {
    const headings = visibleToc
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActive(visible[0].target.id);
          return;
        }
        const current = headings.filter((h) => h.getBoundingClientRect().top <= 130).slice(-1)[0];
        if (current?.id) setActive(current.id);
      },
      { rootMargin: '-90px 0px -55% 0px', threshold: [0.1, 0.3, 0.6] },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [visibleToc]);

  return (
    <ul className="list-none">
      {visibleToc.map((item) => {
        const isActive = item.id === active;
        return (
          <li key={item.id} className="border-b border-gray-200 py-1.5 last:border-b-0">
            <a
              href={`#${item.id}`}
              className={[
                'flex items-center gap-1.5 text-[13px] font-medium transition',
                isActive ? 'text-brand-purple' : 'text-gray-500 hover:text-brand-purple',
              ].join(' ')}
            >
              <span className={['h-[5px] w-[5px] rounded-full', isActive ? 'bg-brand-purple' : 'bg-gray-300'].join(' ')} />
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
