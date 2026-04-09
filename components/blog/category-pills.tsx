'use client';

import { useMemo, useState } from 'react';

type CategoryPillsProps = {
  categories: string[];
};

export function CategoryPills({ categories }: CategoryPillsProps) {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? 'All Posts');
  const [search, setSearch] = useState('');

  const placeholder = useMemo(() => {
    if (activeCategory === 'All Posts') return 'Search articles, guides, tips...';
    return `Search in ${activeCategory}...`;
  }, [activeCategory]);

  return (
    <>
      <div className="mx-auto mt-9 flex w-full max-w-[460px] items-center rounded-full border border-gray-200 bg-white px-5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition focus-within:border-brand-purple focus-within:shadow-[0_0_0_3px_rgba(139,92,246,.12)]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 flex-1 border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          placeholder={placeholder}
          aria-label="Search blog posts"
        />
        <button
          type="button"
          className="rounded-full bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
        >
          Search
        </button>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-center gap-2.5 px-6 md:px-12">
        {categories.map((category) => {
          const active = activeCategory === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={[
                'rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm',
                active
                  ? 'border-brand-purple bg-brand-purple text-white'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-brand-purple hover:text-brand-purple',
              ].join(' ')}
              aria-pressed={active}
            >
              {category}
            </button>
          );
        })}
      </div>
    </>
  );
}
