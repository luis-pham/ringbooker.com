'use client';

import { useEffect, useState } from 'react';

type TocItem = {
  id: string;
  label: string;
};

type TableOfContentsProps = {
  items: TocItem[];
};

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((item): item is HTMLElement => Boolean(item));
    if (headings.length === 0) return;

    let observer: IntersectionObserver;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]?.target?.id) {
            setActiveId(visible[0].target.id);
            return;
          }

          const current = headings
            .filter((heading) => heading.getBoundingClientRect().top <= 140)
            .slice(-1)[0];
          if (current?.id) setActiveId(current.id);
        },
        {
          root: null,
          rootMargin: '-90px 0px -55% 0px',
          threshold: [0.1, 0.3, 0.6, 1],
        },
      );
    } catch {
      return;
    }

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  return (
    <ul className="list-none">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <li key={item.id} className="border-b border-gray-200 py-1.5 last:border-b-0">
            <a
              href={`#${item.id}`}
              className={[
                'flex items-center gap-1.5 text-[13px] font-normal transition',
                active ? 'text-brand-purple' : 'text-gray-500 hover:text-brand-purple',
              ].join(' ')}
            >
              <span className={['h-[5px] w-[5px] rounded-full', active ? 'bg-brand-purple' : 'bg-gray-300'].join(' ')} />
              {item.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
