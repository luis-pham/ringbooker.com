import { siteConfig } from '@/lib/site';

export type BlogIndexQueryParams = {
  category?: string;
  search?: string;
  page?: string;
  cluster?: string;
};

/** For `/blog`, any non-empty query string should be treated as filtered state. */
export function hasBlogIndexQueryParams(params: BlogIndexQueryParams): boolean {
  const qs = new URLSearchParams();
  if (typeof params.category === 'string' && params.category.trim().length > 0) qs.set('category', params.category);
  if (typeof params.search === 'string' && params.search.trim().length > 0) qs.set('search', params.search);
  if (typeof params.page === 'string' && params.page.trim().length > 0) qs.set('page', params.page);
  if (typeof params.cluster === 'string' && params.cluster.trim().length > 0) qs.set('cluster', params.cluster);
  return qs.toString().length > 0;
}

export function getBlogIndexSeoDirectives(params: BlogIndexQueryParams) {
  const filtered = hasBlogIndexQueryParams(params);
  return {
    canonical: `${siteConfig.url}/blog`,
    robots: {
      index: !filtered,
      follow: true,
    },
  } as const;
}
