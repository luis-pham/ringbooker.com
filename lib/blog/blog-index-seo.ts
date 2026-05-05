import { siteConfig } from '@/lib/site';

export type BlogIndexQueryParams = {
  category?: string;
  search?: string;
  page?: string;
  cluster?: string;
  /** Tag slug when using `?tag=` on the listing */
  tag?: string;
};

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * `/blog` listing: index,follow only for the default view (page 1, cluster default, no filters).
 * Search / category / tag / pagination / non-default cluster → noindex,follow (canonical still `/blog`).
 */
export function blogListingShouldNoindex(params: BlogIndexQueryParams): boolean {
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const cluster = typeof params.cluster === 'string' ? params.cluster.trim() : '';
  const clusterIsNonDefault = cluster.length > 0 && cluster !== 'blog';

  return (
    nonEmptyString(params.search) ||
    nonEmptyString(params.category) ||
    nonEmptyString(params.tag) ||
    page > 1 ||
    clusterIsNonDefault
  );
}

/** @deprecated Prefer {@link blogListingShouldNoindex} — semantics aligned with robots rules (not “any query string”). */
export function hasBlogIndexQueryParams(params: BlogIndexQueryParams): boolean {
  return blogListingShouldNoindex(params);
}

export function getBlogIndexSeoDirectives(params: BlogIndexQueryParams) {
  const noindex = blogListingShouldNoindex(params);
  const base = siteConfig.url.replace(/\/$/, '');
  return {
    canonical: `${base}/blog`,
    robots: {
      index: !noindex,
      follow: true,
    },
  } as const;
}
