import { PostStatus } from '@prisma/client';
import { unstable_cache } from 'next/cache';

import { getPostByPathPrefixAndSlug } from '@/lib/blog';
import { resolvePostRedirectTargetOrNull } from '@/lib/blog/post-redirect';
import { isBlogPathPrefix } from '@/lib/blog/path-prefixes';
import { isMarketingIndustryUrlSegment } from '@/lib/marketing/industry-landings';

/** Invalidate when CMS posts change (`revalidateTag` from admin blog actions). */
export const BLOG_POST_REDIRECT_CACHE_TAG = 'blog-post-redirect';

async function resolveBlogPostPermanentRedirectPathUncached(pathname: string): Promise<string | null> {
  const pathOnly = pathname.split('?')[0]!.split('#')[0]!;
  const path = pathOnly.replace(/\/+$/, '') || '/';
  if (path === '/' || !path.startsWith('/')) return null;

  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2 || segments.length > 3) return null;
  if (segments.length === 3 && segments[0] !== 'industries') return null;

  let pathPrefix: string;
  let slug: string;

  if (segments[0] === 'industries' && segments.length === 3) {
    pathPrefix = `industries/${segments[1]}`;
    slug = segments[2]!;
    if (!isBlogPathPrefix(pathPrefix)) return null;
  } else if (segments[0] === 'industries' && segments.length === 2) {
    const industrySlug = segments[1]!;
    if (isMarketingIndustryUrlSegment(industrySlug)) return null;
    pathPrefix = 'industries';
    slug = industrySlug;
    if (!isBlogPathPrefix(pathPrefix)) return null;
  } else if (segments.length === 2) {
    pathPrefix = segments[0]!;
    slug = segments[1]!;
    if (!isBlogPathPrefix(pathPrefix)) return null;
  } else {
    return null;
  }

  try {
    const post = await getPostByPathPrefixAndSlug(pathPrefix, slug);
    if (!post || post.status === PostStatus.DRAFT) return null;
    return resolvePostRedirectTargetOrNull(post.redirectTo, post.pathPrefix, post.slug);
  } catch {
    return null;
  }
}

/**
 * Resolves CMS post `redirectTo` for a browser pathname (same shapes as `BlogPostView` routes).
 * Cached so middleware + page do not both hammer the DB for the same lookup pattern.
 */
export async function resolveBlogPostPermanentRedirectPath(pathname: string): Promise<string | null> {
  const pathOnly = pathname.split('?')[0]!.split('#')[0]!;
  return unstable_cache(
    () => resolveBlogPostPermanentRedirectPathUncached(pathOnly),
    ['blog-post-redirect', pathOnly],
    { tags: [BLOG_POST_REDIRECT_CACHE_TAG] },
  )();
}
