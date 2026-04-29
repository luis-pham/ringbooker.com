import type { MetadataRoute } from 'next';

import { getPublishedPostSitemapEntries } from '@/lib/blog';
import { siteConfig } from '@/lib/site';

/** Marketing and legal URLs that exist as App Router pages (no DB). */
const staticRoutes = [
  '',
  '/industries/nail-salon',
  '/industries/nail-salon/vi',
  '/industries/hair-salon',
  '/industries/spa',
  '/industries/med-spa',
  '/industries/beauty-clinic',
  '/compare',
  '/missed-booking-protection',
  '/missed-booking-protection/after-hours-calls',
  '/missed-booking-protection/peak-hour-overflow-calls',
  '/missed-booking-protection/missed-call-recovery',
  '/current-number',
  '/current-number/call-forwarding',
  '/works-with',
  '/trust',
  '/blog',
  '/demo',
  '/pricing',
  '/how-it-works',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/refund',
];

function parseStaticSitemapLastModMap(): Map<string, Date> {
  const out = new Map<string, Date>();
  const raw = process.env.SITEMAP_STATIC_LASTMOD?.trim();
  if (!raw) return out;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out;
    for (const [route, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof route !== 'string' || typeof value !== 'string') continue;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) continue;
      out.set(route, date);
    }
    return out;
  } catch {
    return out;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const postEntries = await getPublishedPostSitemapEntries();
  const postPathToModified = new Map(postEntries.map((e) => [e.path, e.lastModified]));
  const staticLastModMap = parseStaticSitemapLastModMap();
  const fallbackStaticLastMod = new Date();

  /** Safety: never emit query-parameter URLs (e.g. `/blog?...`) in sitemap. */
  const allPaths = [...new Set([...staticRoutes, ...postPathToModified.keys()])].filter((route) => !route.includes('?'));

  return allPaths.map((route) => {
    /** CMS posts: `Post.updatedAt`. Static routes: per-route `SITEMAP_STATIC_LASTMOD` map or generation time fallback. */
    const staticKey = route === '' ? '/' : route;
    const lastModified =
      postPathToModified.get(route) ?? staticLastModMap.get(staticKey) ?? fallbackStaticLastMod;
    return {
      url: `${siteConfig.url}${route}`,
      lastModified,
      changeFrequency: route === '' ? 'weekly' : 'monthly',
      priority:
        route === ''
          ? 1
          : route.includes('salon') || route.includes('spa') || route.includes('beauty')
            ? 0.9
            : 0.7,
    };
  });
}
