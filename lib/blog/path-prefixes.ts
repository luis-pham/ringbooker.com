/** URL path before post slug: `/[pathPrefix]/[slug]` — `pathPrefix` may contain slashes (e.g. industries/nail-salon). */

export const BLOG_PATH_PREFIXES = [
  'blog',
  'works-with',
  'phone-booking-recovery',
  'current-number',
  'industries',
  'industries/nail-salon',
  'industries/hair-salon',
  'industries/spa',
  'industries/med-spa',
  'industries/beauty-clinic',
  'trust',
  'compare',
] as const;

export type BlogPathPrefix = (typeof BLOG_PATH_PREFIXES)[number];

export const BLOG_PATH_PREFIX_LABEL: Record<BlogPathPrefix, string> = {
  blog: 'Blog',
  'works-with': 'Works with',
  'phone-booking-recovery': 'Phone booking recovery',
  'current-number': 'Current number',
  industries: 'Industries (general)',
  'industries/nail-salon': 'Industries — Nail salon',
  'industries/hair-salon': 'Industries — Hair salon',
  'industries/spa': 'Industries — Spa',
  'industries/med-spa': 'Industries — Med spa',
  'industries/beauty-clinic': 'Industries — Beauty clinic',
  trust: 'Trust',
  compare: 'Compare',
};

/** Slugs reserved under `/compare/*` by static marketing pages. */
export const COMPARE_RESERVED_SLUGS = new Set(['vs-truelark', 'vs-my-ai-front-desk', 'vs-goodcall']);

export function isReservedCompareBlogSlug(slug: string): boolean {
  return COMPARE_RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

export function isBlogPathPrefix(value: string): value is BlogPathPrefix {
  return (BLOG_PATH_PREFIXES as readonly string[]).includes(value);
}

export function postPublicPath(pathPrefix: string, slug: string): string {
  const p = (pathPrefix || 'blog').trim().replace(/^\/+|\/+$/g, '') || 'blog';
  const s = slug.trim();
  const base = p.split('/').filter(Boolean).join('/');
  return `/${base}/${s}`;
}
