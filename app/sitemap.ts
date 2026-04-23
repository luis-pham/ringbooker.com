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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const postEntries = await getPublishedPostSitemapEntries();
  const postPathToModified = new Map(postEntries.map((e) => [e.path, e.lastModified]));

  const allPaths = [...new Set([...staticRoutes, ...postPathToModified.keys()])];

  return allPaths.map((route) => {
    const lastModified = postPathToModified.get(route);
    return {
      url: `${siteConfig.url}${route}`,
      ...(lastModified ? { lastModified } : {}),
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
