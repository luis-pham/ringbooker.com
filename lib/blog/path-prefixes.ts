/** URL path before post slug: `/[pathPrefix]/[slug]` — `pathPrefix` may contain slashes (e.g. industries/nail-salon). */

export const BLOG_PATH_PREFIXES = [
  'blog',
  'works-with',
  'missed-booking-protection',
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
  'missed-booking-protection': 'Missed booking protection',
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

/** Slugs reserved under `/compare/*` by static marketing pages (block CMS from taking the same slug). */
export const COMPARE_RESERVED_SLUGS = new Set<string>();

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

/**
 * Public index URL for a post cluster (listing / hub), e.g. `blog` → `/blog`, `missed-booking-protection` → `/missed-booking-protection`.
 * Nested: `industries/nail-salon` → `/industries/nail-salon`.
 */
export function pathPrefixToHubHref(pathPrefix: string): string {
  const p = (pathPrefix || 'blog').trim().replace(/^\/+|\/+$/g, '') || 'blog';
  const base = p.split('/').filter(Boolean).join('/');
  return base ? `/${base}` : '/blog';
}
