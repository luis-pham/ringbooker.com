import type { Metadata } from 'next';
import { PostStatus } from '@prisma/client';

import { getAllPosts, getPostByPathPrefixAndSlug } from '@/lib/blog';
import { resolvePostRedirectTargetOrNull } from '@/lib/blog/post-redirect';
import { buildPostSeoDescription } from '@/lib/blog/post-seo-description';
import { BLOG_PATH_PREFIX_LABEL, isBlogPathPrefix, postPublicPath } from '@/lib/blog/path-prefixes';
import { absoluteOgImageUrl, buildAlternates, defaultSiteOgImage, normalizeSeoTitle, siteConfig, siteOgImageEntry } from '@/lib/site';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

/** `<title>` segment after the post headline: cluster-specific instead of always "RingBooker Blog". */
function titleSuffixForPostPathPrefix(pathPrefix: string): string {
  const p = (pathPrefix || 'blog').trim().replace(/^\/+|\/+$/g, '') || 'blog';
  if (p === 'blog') return `${siteConfig.name} Blog`;
  if (isBlogPathPrefix(p)) return `${BLOG_PATH_PREFIX_LABEL[p]} | ${siteConfig.name}`;
  return `${siteConfig.name} Blog`;
}

function isVietnamesePost(post: Awaited<ReturnType<typeof getPostByPathPrefixAndSlug>>): boolean {
  if (!post) return false;
  const language = (post as typeof post & { language?: string | null }).language?.trim().toLowerCase();
  if (language === 'vi') return true;
  return post.categories.some(({ category }) => {
    const slug = category.slug.trim().toLowerCase();
    const name = category.name.trim().toLowerCase();
    return slug === 'vietnamese-owners' || name === 'vietnamese owners';
  });
}

function parentSectionPathForPost(pathPrefix: string): string {
  const prefix = pathPrefix.trim().replace(/^\/+|\/+$/g, '') || 'blog';
  if (prefix === 'blog') return '/blog';
  return `/${prefix}`;
}

export async function buildBlogPostMetadata(pathPrefix: string, slug: string): Promise<Metadata> {
  if (!hasDatabaseUrl) return { title: 'RingBooker Blog' };
  const post = await getPostByPathPrefixAndSlug(pathPrefix, slug).catch(() => null);
  if (!post) return { title: 'Post Not Found' };

  const redirectPath =
    post.status !== PostStatus.DRAFT
      ? resolvePostRedirectTargetOrNull(post.redirectTo, post.pathPrefix, post.slug)
      : null;
  const path = redirectPath ?? postPublicPath(pathPrefix, post.slug);
  const canonicalUrl = new URL(path, siteConfig.url).toString();

  const cover = post.coverImageUrl?.trim();
  /** Absolute URL for crawlers (X / Facebook / LinkedIn). */
  const shareImageUrl = cover ? absoluteOgImageUrl(cover) : absoluteOgImageUrl(defaultSiteOgImage);
  const ogImages = cover
    ? [{ url: shareImageUrl, alt: post.title }]
    : [siteOgImageEntry(absoluteOgImageUrl(defaultSiteOgImage))];

  const description = buildPostSeoDescription(post);

  const documentTitle = normalizeSeoTitle(`${post.title} | ${titleSuffixForPostPathPrefix(post.pathPrefix)}`);

  return {
    metadataBase: new URL(siteConfig.url),
    title: { absolute: documentTitle },
    description,
    alternates: isVietnamesePost(post)
      ? {
          canonical: path,
          languages: {
            vi: path,
            'x-default': parentSectionPathForPost(post.pathPrefix),
          },
        }
      : buildAlternates(path),
    openGraph: {
      title: documentTitle,
      description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: 'en_US',
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.author.name],
      images: ogImages,
    },
    twitter: { card: 'summary_large_image', title: documentTitle, description, images: [shareImageUrl] },
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
