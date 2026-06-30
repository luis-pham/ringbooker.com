import type { MetadataRoute } from 'next';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
  '/demo/nail-salon',
  '/demo/hair-salon',
  '/demo/day-spa',
  '/demo/med-spa',
  '/demo/beauty-clinic',
  '/pricing',
  '/how-it-works',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/refund',
  '/about',
];

const stableStaticLastModFallback = new Date('2026-06-30T00:00:00.000Z');

const staticContentFiles: Record<string, string> = {
  '/': 'content/pages/home.md',
  '/about': 'content/pages/about.md',
  '/contact': 'content/pages/contact.md',
  '/how-it-works': 'content/pages/how-it-works.md',
  '/pricing': 'content/pages/pricing.md',
  '/compare': 'content/hubs/compare.md',
  '/current-number': 'content/hubs/current-number.md',
  '/missed-booking-protection': 'content/hubs/missed-booking-protection.md',
  '/trust': 'content/hubs/trust.md',
  '/works-with': 'content/hubs/works-with.md',
};

function appPageCandidate(route: string): string {
  return route === '' ? 'app/page.tsx' : `app${route}/page.tsx`;
}

function staticContentCandidate(route: string): string | null {
  const key = route === '' ? '/' : route;
  const direct = staticContentFiles[key];
  if (direct) return direct;
  const industryMatch = key.match(/^\/industries\/([^/]+)$/);
  if (industryMatch) return `content/industries/${industryMatch[1]}.md`;
  return null;
}

function latestFileMtime(candidates: string[]): Date | null {
  let latest: Date | null = null;
  for (const candidate of candidates) {
    const file = join(process.cwd(), candidate);
    try {
      if (!existsSync(file)) continue;
      const mtime = statSync(file).mtime;
      if (!latest || mtime > latest) latest = mtime;
    } catch {
      continue;
    }
  }
  return latest;
}

function staticRouteLastModified(route: string): Date {
  return latestFileMtime(
    [staticContentCandidate(route), appPageCandidate(route)].filter((file): file is string => Boolean(file)),
  )
    ?? stableStaticLastModFallback;
}

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

  /** Safety: never emit query-parameter URLs (e.g. `/blog?...`) in sitemap. */
  const allPaths = [...new Set([...staticRoutes, ...postPathToModified.keys()])].filter((route) => !route.includes('?'));

  return allPaths.map((route) => {
    /** CMS posts: `Post.updatedAt`. Static routes: explicit env map or source-file mtime. */
    const staticKey = route === '' ? '/' : route;
    const lastModified =
      postPathToModified.get(route) ?? staticLastModMap.get(staticKey) ?? staticRouteLastModified(route);
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
