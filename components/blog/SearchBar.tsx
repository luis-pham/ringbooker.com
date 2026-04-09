'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function SearchBar({ initialValue = '' }: { initialValue?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    const current = searchParams.get('search') ?? '';
    if (current !== query) {
      setQuery(current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const current = searchParams.get('search') ?? '';
      const trimmed = query.trim();

      if (trimmed.length === 0) {
        next.delete('search');
      } else {
        next.set('search', trimmed);
      }
      next.delete('page');

      if (current === trimmed) return;
      const search = next.toString();
      router.push(search.length > 0 ? `/blog?${search}` : '/blog');
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query, router, searchParams]);

  return (
    <div className="mx-auto flex w-full max-w-[460px] items-center rounded-full border border-gray-200 bg-white px-5 py-1.5 shadow-[0_2px_12px_rgba(0,0,0,.05)] transition focus-within:border-brand-purple focus-within:shadow-[0_0_0_3px_rgba(139,92,246,.12)]">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-9 flex-1 border-0 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
        placeholder="Search articles, guides, tips..."
        aria-label="Search articles"
      />
      <button
        type="button"
        onClick={() => {
          const trimmed = query.trim();
          const next = new URLSearchParams(searchParams.toString());
          if (trimmed.length === 0) next.delete('search');
          else next.set('search', trimmed);
          next.delete('page');
          const search = next.toString();
          router.push(search.length > 0 ? `/blog?${search}` : '/blog');
        }}
        className="rounded-full bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
      >
        Search
      </button>
    </div>
  );
}
