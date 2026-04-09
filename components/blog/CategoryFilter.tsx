'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import type { CategoryWithCount } from '@/types/blog';

export function CategoryFilter({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category') ?? '';

  const applyCategory = (slug: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!slug) {
      next.delete('category');
    } else {
      next.set('category', slug);
    }
    next.delete('page');
    const query = next.toString();
    router.push(query.length > 0 ? `/blog?${query}` : '/blog');
  };

  return (
    <div className="mx-auto mt-5 flex max-w-6xl flex-wrap items-center justify-center gap-2.5 px-6 md:px-12">
      <button
        type="button"
        onClick={() => applyCategory(null)}
        className={[
          'rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm',
          activeCategory === ''
            ? 'border-brand-purple bg-brand-purple text-white'
            : 'border-gray-200 bg-white text-gray-500 hover:border-brand-purple hover:text-brand-purple',
        ].join(' ')}
      >
        All Posts
      </button>

      {categories.map((category) => {
        const active = activeCategory === category.slug;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => applyCategory(category.slug)}
            className={[
              'rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm',
              active
                ? 'border-brand-purple bg-brand-purple text-white'
                : 'border-gray-200 bg-white text-gray-500 hover:border-brand-purple hover:text-brand-purple',
            ].join(' ')}
          >
            {category.name} ({category._count.posts})
          </button>
        );
      })}
    </div>
  );
}
