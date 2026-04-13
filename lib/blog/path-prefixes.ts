/** URL segment before post slug: `/[pathPrefix]/[slug]` */

export const BLOG_PATH_PREFIXES = [
  'blog',
  'phone-booking-recovery',
  'current-number',
  'industries',
  'trust',
  'compare',
] as const;

export type BlogPathPrefix = (typeof BLOG_PATH_PREFIXES)[number];

export const BLOG_PATH_PREFIX_LABEL: Record<BlogPathPrefix, string> = {
  blog: 'Blog',
  'phone-booking-recovery': 'Phone booking recovery',
  'current-number': 'Current number',
  industries: 'Industries',
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
  const p = (pathPrefix || 'blog').trim() || 'blog';
  const s = slug.trim();
  return `/${p}/${s}`;
}
