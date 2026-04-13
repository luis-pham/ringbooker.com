import type { MetadataRoute } from 'next';
import { PostStatus } from '@prisma/client';

import { getAllPosts } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { siteConfig } from '@/lib/site';
import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';

const routes = [
  '',
  '/industries/nail-salon',
  '/industries/hair-salon',
  '/industries/spa',
  '/industries/med-spa',
  '/industries/beauty-clinic',
  '/after-hours-calls',
  '/missed-call-recovery',
  '/compare',
  '/compare/vs-truelark',
  '/compare/vs-my-ai-front-desk',
  '/compare/vs-goodcall',
  '/blog',
  '/demo',
  '/pricing',
  '/how-it-works',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const runtime = getBackendRuntime();
  let cmsPosts: Awaited<ReturnType<NonNullable<typeof runtime.blogPostsRepository>['listPublished']>> = [];
  if (runtime.blogPostsRepository) {
    try {
      cmsPosts = await runtime.blogPostsRepository.listPublished({ limit: 200 });
    } catch {
      cmsPosts = [];
    }
  }
  const legacyCmsRoutes = cmsPosts.map((post) => `/blog/${post.slug}`);

  let prismaBlogRoutes: string[] = [];
  try {
    const { posts } = await getAllPosts({ status: PostStatus.PUBLISHED, perPage: 200 });
    prismaBlogRoutes = posts.map((p) => postPublicPath(p.pathPrefix, p.slug));
  } catch {
    prismaBlogRoutes = [];
  }

  const allRoutes = [...new Set([...routes, ...legacyCmsRoutes, ...prismaBlogRoutes])];

  return allRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date('2026-04-06'),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route.includes('salon') || route.includes('spa') || route.includes('beauty') ? 0.9 : 0.7,
  }));
}
