'use client';

import { useEffect, useState } from 'react';

export function ViewCounter({ slug, fallback = 0 }: { slug: string; fallback?: number }) {
  const [views, setViews] = useState<number>(fallback);

  useEffect(() => {
    let mounted = true;
    const key = `blog:viewed:${slug}`;

    const run = async () => {
      try {
        const getRes = await fetch(`/api/blog/views/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (getRes.ok && mounted) {
          const data = (await getRes.json()) as { views?: number };
          setViews(typeof data.views === 'number' ? data.views : fallback);
        }
      } catch {
        if (mounted) setViews(fallback);
      }

      try {
        if (sessionStorage.getItem(key)) return;
        const postRes = await fetch(`/api/blog/views/${encodeURIComponent(slug)}`, { method: 'POST' });
        if (postRes.ok) {
          sessionStorage.setItem(key, '1');
          if (mounted) setViews((prev) => prev + 1);
        }
      } catch {
        // ignore
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [fallback, slug]);

  return <>{views.toLocaleString('en-US')} views</>;
}
