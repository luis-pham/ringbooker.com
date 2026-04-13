import type { Metadata } from 'next';
import { PostStatus } from '@prisma/client';

import { getAllPosts, getPostByPathPrefixAndSlug } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { absoluteOgImageUrl, buildAlternates, defaultSiteOgImage, siteConfig, siteOgImageEntry } from '@/lib/site';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

export async function buildBlogPostMetadata(pathPrefix: string, slug: string): Promise<Metadata> {
  if (!hasDatabaseUrl) return { title: 'RingBooker Blog' };
  const post = await getPostByPathPrefixAndSlug(pathPrefix, slug).catch(() => null);
  if (!post) return { title: 'Post Not Found' };

  const path = postPublicPath(pathPrefix, post.slug);
  const canonicalUrl = new URL(path, siteConfig.url).toString();

  const cover = post.coverImageUrl?.trim();
  /** Absolute URL for crawlers (X / Facebook / LinkedIn). */
  const shareImageUrl = cover ? absoluteOgImageUrl(cover) : absoluteOgImageUrl(defaultSiteOgImage);
  const ogImages = cover
    ? [{ url: shareImageUrl, alt: post.title }]
    : [siteOgImageEntry(absoluteOgImageUrl(defaultSiteOgImage))];

  return {
    metadataBase: new URL(siteConfig.url),
    title: `${post.title} — RingBooker Blog`,
    description: post.excerpt,
    alternates: buildAlternates(path),
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.author.name],
      images: ogImages,
    },
    twitter: { card: 'summary_large_image', images: [shareImageUrl] },
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
