import type { Metadata } from 'next';
import { PostStatus } from '@prisma/client';

import { getAllPosts, getPostByPathPrefixAndSlug } from '@/lib/blog';
import { siteConfig } from '@/lib/site';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

export function absoluteOgImageUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = siteConfig.url.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export async function buildBlogPostMetadata(pathPrefix: string, slug: string): Promise<Metadata> {
  if (!hasDatabaseUrl) return { title: 'RingBooker Blog' };
  const post = await getPostByPathPrefixAndSlug(pathPrefix, slug).catch(() => null);
  if (!post) return { title: 'Post Not Found' };

  const cover = post.coverImageUrl?.trim();
  const ogImage = cover ? absoluteOgImageUrl(cover) : undefined;

  return {
    title: `${post.title} — RingBooker Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.author.name],
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: 'summary_large_image', ...(ogImage ? { images: [ogImage] } : {}) },
  };
}

export async function buildBlogPostStaticParams(pathPrefix: string) {
  if (!hasDatabaseUrl) return [];
  try {
    const { posts } = await getAllPosts({ status: PostStatus.PUBLISHED, perPage: 200 });
    return posts.filter((p) => p.pathPrefix === pathPrefix).map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

/**
 * Posts under `/industries/{slug}/{articleSlug}` (pathPrefix `industries/{slug}`).
 * First `slug` matches the industry segment (same param name as `app/industries/[slug]/page.tsx`).
 */
export async function buildIndustriesNestedBlogStaticParams(): Promise<{ slug: string; articleSlug: string }[]> {
  if (!hasDatabaseUrl) return [];
  try {
    const { posts } = await getAllPosts({ status: PostStatus.PUBLISHED, perPage: 200 });
    const out: { slug: string; articleSlug: string }[] = [];
    for (const p of posts) {
      if (!p.pathPrefix.startsWith('industries/') || p.pathPrefix === 'industries') continue;
      const industry = p.pathPrefix.slice('industries/'.length).replace(/^\/+|\/+$/g, '');
      if (!industry || industry.includes('/')) continue;
      out.push({ slug: industry, articleSlug: p.slug });
    }
    return out;
  } catch {
    return [];
  }
}
