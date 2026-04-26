import type { MetadataRoute } from 'next';

import { getPublishedPostSitemapEntries } from '@/lib/blog';
import { siteConfig } from '@/lib/site';

/** Marketing and legal URLs that exist as App Router pages (no DB). */
const staticRoutes = [
  '',
  '/industries/nail-salon',
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

function parseStaticSitemapLastMod(): Date {
  const raw = process.env.SITEMAP_STATIC_LASTMOD?.trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  /** When unset: generation time (typically build/deploy) so every URL still emits W3C `<lastmod>`. */
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const postEntries = await getPublishedPostSitemapEntries();
  const postPathToModified = new Map(postEntries.map((e) => [e.path, e.lastModified]));
  const staticLastMod = parseStaticSitemapLastMod();

  /** Safety: never emit query-parameter URLs (e.g. `/blog?...`) in sitemap. */
  const allPaths = [...new Set([...staticRoutes, ...postPathToModified.keys()])].filter((route) => !route.includes('?'));

  return allPaths.map((route) => {
    /** CMS posts: `Post.updatedAt`. Marketing/static routes: `SITEMAP_STATIC_LASTMOD` or generation time. */
    const lastModified = postPathToModified.get(route) ?? staticLastMod;
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
