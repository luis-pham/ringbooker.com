'use client';

import { useEffect, useState } from 'react';

export function ViewCounter({
  pathPrefix,
  slug,
  fallback = 0,
}: {
  pathPrefix: string;
  slug: string;
  fallback?: number;
}) {
  const [views, setViews] = useState<number>(fallback);

  useEffect(() => {
    let mounted = true;
    const p = encodeURIComponent(pathPrefix);
    const s = encodeURIComponent(slug);
    const key = `blog:viewed:${pathPrefix}:${slug}`;

    const hasSessionFlag = (): boolean => {
      try {
        return Boolean(sessionStorage.getItem(key));
      } catch {
        return false;
      }
    };

    const setSessionFlag = (): void => {
      try {
        sessionStorage.setItem(key, '1');
      } catch {
        // Storage disabled / quota / sandbox — still allow view fetch
      }
    };

    const run = async () => {
      try {
        const getRes = await fetch(`/api/blog/views/${p}/${s}`, { cache: 'no-store' });
        if (getRes.ok && mounted) {
          const data = (await getRes.json()) as { views?: number };
          setViews(typeof data.views === 'number' ? data.views : fallback);
        }
      } catch {
        if (mounted) setViews(fallback);
      }

      try {
        if (hasSessionFlag()) return;
        const postRes = await fetch(`/api/blog/views/${p}/${s}`, { method: 'POST' });
        if (postRes.ok) {
          setSessionFlag();
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
  }, [fallback, pathPrefix, slug]);

  return <>{views.toLocaleString('en-US')} views</>;
}
