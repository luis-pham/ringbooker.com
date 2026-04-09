import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';
import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';

const routes = [
  '',
  '/nail-salon',
  '/hair-salon',
  '/spa',
  '/med-spa',
  '/beauty-clinic',
  '/compare',
  '/compare/vs-truelark',
  '/compare/vs-my-ai-front-desk',
  '/compare/vs-goodcall',
  '/blog',
  '/blog/how-many-calls-does-a-nail-salon-miss-per-day',
  '/blog/ai-receptionist-for-vietnamese-nail-salons',
  '/blog/truelark-alternatives-for-nail-salons-2026',
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
  const cmsPosts = runtime.blogPostsRepository ? await runtime.blogPostsRepository.listPublished({ limit: 200 }) : [];
  const cmsRoutes = cmsPosts.map((post) => `/blog/${post.slug}`);
  const allRoutes = [...new Set([...routes, ...cmsRoutes])];

  return allRoutes.map((route) => ({
    url: `${siteConfig.url}${route}`,
    lastModified: new Date('2026-04-06'),
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : route.includes('salon') || route.includes('spa') || route.includes('beauty') ? 0.9 : 0.7,
  }));
}
