import { PostStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

import { isBlogPathPrefix } from '@/lib/blog/path-prefixes';
import { prisma } from '@/lib/prisma';
import type { CategoryWithCount, PostWithRelations } from '@/types/blog';

let missingDbWarningShown = false;

function hasDatabaseUrl(): boolean {
  const value = process.env.DATABASE_URL;
  return typeof value === 'string' && value.trim().length > 0;
}

function warnMissingDatabaseUrl(): void {
  if (missingDbWarningShown) return;
  missingDbWarningShown = true;
  console.warn('[blog] DATABASE_URL is missing. Blog data queries are returning safe empty fallback results.');
}

const postInclude = {
  author: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.PostInclude;

const listOptionsSchema = z.object({
  status: z.nativeEnum(PostStatus).optional(),
  categorySlug: z.string().trim().min(1).optional(),
  tagSlug: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(12),
  featured: z.boolean().optional(),
});

const slugSchema = z.string().trim().min(1, 'slug is required');
const postIdSchema = z.string().trim().min(1, 'postId is required');
const categoryIdsSchema = z.array(z.string().trim().min(1)).default([]);
const relatedLimitSchema = z.coerce.number().int().min(1).max(20).optional().default(3);
const searchSchema = z.string().trim().min(1, 'query is required');

function buildPostWhere(input: z.infer<typeof listOptionsSchema>): Prisma.PostWhereInput {
  const where: Prisma.PostWhereInput = {};

  if (input.status) where.status = input.status;
  if (typeof input.featured === 'boolean') where.featured = input.featured;
  if (input.categorySlug) {
    where.categories = { some: { category: { slug: input.categorySlug } } };
  }
  if (input.tagSlug) {
    where.tags = { some: { tag: { slug: input.tagSlug } } };
  }
  if (input.search) {
    where.OR = [
      { title: { contains: input.search, mode: 'insensitive' } },
      { excerpt: { contains: input.search, mode: 'insensitive' } },
      { content: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function getAllPosts(options?: {
  status?: PostStatus;
  categorySlug?: string;
  tagSlug?: string;
  search?: string;
  page?: number;
  perPage?: number;
  featured?: boolean;
}): Promise<{ posts: PostWithRelations[]; total: number; totalPages: number }> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return { posts: [], total: 0, totalPages: 1 };
  }
  try {
    const input = listOptionsSchema.parse(options ?? {});
    const { page, perPage } = input;
    const where = buildPostWhere(input);

    const total = await prisma.post.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const normalizedPage = Math.min(page, totalPages);

    const orderBy: Prisma.PostOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];
    const offset = (normalizedPage - 1) * perPage;

    let cursorId: string | null = null;
    if (offset > 0) {
      const anchor = await prisma.post.findMany({
        where,
        orderBy,
        skip: offset - 1,
        take: 1,
        select: { id: true },
      });
      cursorId = anchor[0]?.id ?? null;
    }

    const posts = (await prisma.post.findMany({
      where,
      orderBy,
      take: perPage,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      include: postInclude,
    })) as PostWithRelations[];

    return { posts, total, totalPages };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to fetch posts: ${message}`);
  }
}

export async function getPostByPathPrefixAndSlug(
  pathPrefix: string,
  slug: string,
): Promise<PostWithRelations | null> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return null;
  }
  try {
    const parsedSlug = slugSchema.parse(slug);
    const prefix = isBlogPathPrefix(pathPrefix.trim()) ? pathPrefix.trim() : 'blog';
    const post = await prisma.post.findUnique({
      where: { pathPrefix_slug: { pathPrefix: prefix, slug: parsedSlug } },
      include: postInclude,
    });
    return post as PostWithRelations | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to fetch post: ${message}`);
  }
}

/** @deprecated Prefer getPostByPathPrefixAndSlug — kept for call sites that only know legacy /blog/{slug}. */
export async function getPostBySlug(slug: string): Promise<PostWithRelations | null> {
  return getPostByPathPrefixAndSlug('blog', slug);
}

export async function getFeaturedPost(): Promise<PostWithRelations | null> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return null;
  }
  try {
    const post = await prisma.post.findFirst({
      where: {
        featured: true,
        status: PostStatus.PUBLISHED,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: postInclude,
    });
    return post as PostWithRelations | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to fetch featured post: ${message}`);
  }
}

export async function getRelatedPosts(
  postId: string,
  categoryIds: string[],
  limit?: number,
): Promise<PostWithRelations[]> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return [];
  }
  try {
    const parsedPostId = postIdSchema.parse(postId);
    const parsedCategoryIds = categoryIdsSchema.parse(categoryIds);
    const parsedLimit = relatedLimitSchema.parse(limit);

    const posts = await prisma.post.findMany({
      where: {
        id: { not: parsedPostId },
        status: PostStatus.PUBLISHED,
        OR: [
          { relatedFrom: { some: { id: parsedPostId } } },
          { relatedTo: { some: { id: parsedPostId } } },
          ...(parsedCategoryIds.length > 0
            ? [
                {
                  categories: {
                    some: {
                      categoryId: { in: parsedCategoryIds },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: postInclude,
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: parsedLimit,
      distinct: ['id'],
    });

    return posts as PostWithRelations[];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to fetch related posts: ${message}`);
  }
}

export async function getAllCategories(): Promise<CategoryWithCount[]> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return [];
  }
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return categories as CategoryWithCount[];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to fetch categories: ${message}`);
  }
}

export async function incrementPostViews(pathPrefix: string, slug: string): Promise<void> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return;
  }
  try {
    const parsedSlug = slugSchema.parse(slug);
    const prefix = isBlogPathPrefix(pathPrefix.trim()) ? pathPrefix.trim() : 'blog';
    const updated = await prisma.post.updateMany({
      where: { pathPrefix: prefix, slug: parsedSlug },
      data: { views: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new Error(`post not found for path "${prefix}/${parsedSlug}"`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to increment post views: ${message}`);
  }
}

export async function searchPosts(query: string): Promise<PostWithRelations[]> {
  if (!hasDatabaseUrl()) {
    warnMissingDatabaseUrl();
    return [];
  }
  try {
    const parsedQuery = searchSchema.parse(query);
    const posts = await prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        OR: [
          { title: { contains: parsedQuery, mode: 'insensitive' } },
          { excerpt: { contains: parsedQuery, mode: 'insensitive' } },
          { content: { contains: parsedQuery, mode: 'insensitive' } },
        ],
      },
      include: postInclude,
      orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
    return posts as PostWithRelations[];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`Failed to search posts: ${message}`);
  }
}
