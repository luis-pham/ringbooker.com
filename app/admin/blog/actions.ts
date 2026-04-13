'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';
import { ADMIN_SESSION_COOKIE, verifySessionToken } from '@/src/backend/security/session';

import { postSchema, slugify, type PostFormData } from './post-schema';

async function assertAdminSession(): Promise<void> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value ?? null;
  if (!token) {
    throw new Error('unauthorized');
  }
  const session = await verifySessionToken(token);
  if (!session || session.role !== 'admin') {
    throw new Error('unauthorized');
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeCoverStats(data: PostFormData): Array<{ num: string; label: string }> {
  return data.coverStats
    .map((item) => ({ num: item.num.trim(), label: item.label.trim() }))
    .filter((item) => item.num.length > 0 && item.label.length > 0)
    .slice(0, 3);
}

function normalizeCoverImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (/^uploads\//i.test(trimmed) && !trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }
  return trimmed;
}

function normalizeFooterCtasJson(data: PostFormData) {
  const rows = data.footerCtas.map((row) => ({
    buttonId: row.buttonId,
    ctaCopyId: row.ctaCopyId,
    href: row.href.trim(),
  }));
  return rows.length > 0 ? rows : [];
}

async function ensureAuthorId() {
  const initials = 'RBA';
  const author = await prisma.author.upsert({
    where: { initials },
    update: {
      name: 'RingBooker Admin',
      role: 'Admin',
    },
    create: {
      initials,
      name: 'RingBooker Admin',
      role: 'Admin',
    },
  });
  return author.id;
}

async function upsertTags(tagValues: string[]) {
  const tags = unique(tagValues);
  if (tags.length === 0) return [];
  const records = await Promise.all(
    tags.map((name) =>
      prisma.tag.upsert({
        where: { slug: slugify(name) },
        update: { name },
        create: { name, slug: slugify(name) },
      }),
    ),
  );
  return records;
}

function revalidateBlogPostPaths(opts: { slug: string; pathPrefix: string; oldSlug?: string; oldPathPrefix?: string }) {
  const prefix = opts.pathPrefix || 'blog';
  revalidatePath('/blog', 'layout');
  revalidatePath(`/${prefix}/${opts.slug}`);
  revalidatePath('/admin/blog');
  if (opts.oldSlug && (opts.oldSlug !== opts.slug || (opts.oldPathPrefix ?? 'blog') !== prefix)) {
    revalidatePath(`/${opts.oldPathPrefix ?? 'blog'}/${opts.oldSlug}`);
  }
}

function parsePostSchema(data: PostFormData) {
  const out = postSchema.safeParse(data);
  if (!out.success) {
    const msg = out.error.issues.map((i) => `${i.path.length ? i.path.join('.') : 'form'}: ${i.message}`).join(' · ');
    throw new Error(msg);
  }
  return out.data;
}

function normalizePostSlug(value: string): string {
  return value.trim().toLowerCase();
}

export async function createPost(data: PostFormData): Promise<{ id: string }> {
  await assertAdminSession();
  const parsed = parsePostSchema(data);

  const authorId = await ensureAuthorId();
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: unique(parsed.categoryIds) } },
      select: { id: true },
    }),
    upsertTags(parsed.tags),
  ]);

  if (categories.length === 0) {
    throw new Error('at_least_one_category_required');
  }

  const post = await prisma.post.create({
    data: {
      title: parsed.title.trim(),
      pathPrefix: parsed.pathPrefix,
      slug: normalizePostSlug(parsed.slug),
      excerpt: parsed.excerpt.trim(),
      content: parsed.content,
      status: parsed.status,
      featured: parsed.featured,
      readTimeMin: parsed.readTimeMin,
      coverImageUrl: normalizeCoverImageUrl(parsed.coverImageUrl),
      coverStats: normalizeCoverStats(parsed),
      footerCtas: normalizeFooterCtasJson(parsed),
      authorId,
      publishedAt: parsed.status === 'PUBLISHED' ? new Date() : null,
      categories: {
        create: categories.map((category) => ({ categoryId: category.id })),
      },
      tags: {
        create: tags.map((tag) => ({ tagId: tag.id })),
      },
    },
    select: { id: true, slug: true, pathPrefix: true },
  });

  revalidateBlogPostPaths({ slug: post.slug, pathPrefix: post.pathPrefix });
  return { id: post.id };
}

export async function updatePost(id: string, data: PostFormData): Promise<void> {
  await assertAdminSession();
  const parsed = parsePostSchema(data);
  const postId = id.trim();
  if (!postId) throw new Error('invalid_post_id');

  const [existingPost, categories, tags] = await Promise.all([
    prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, pathPrefix: true, publishedAt: true },
    }),
    prisma.category.findMany({
      where: { id: { in: unique(parsed.categoryIds) } },
      select: { id: true },
    }),
    upsertTags(parsed.tags),
  ]);

  if (!existingPost) throw new Error('post_not_found');
  if (categories.length === 0) throw new Error('at_least_one_category_required');

  await prisma.$transaction([
    prisma.categoryOnPost.deleteMany({ where: { postId } }),
    prisma.tagOnPost.deleteMany({ where: { postId } }),
    prisma.post.update({
      where: { id: postId },
      data: {
        title: parsed.title.trim(),
        pathPrefix: parsed.pathPrefix,
        slug: normalizePostSlug(parsed.slug),
        excerpt: parsed.excerpt.trim(),
        content: parsed.content,
        status: parsed.status,
        featured: parsed.featured,
        readTimeMin: parsed.readTimeMin,
        coverImageUrl: normalizeCoverImageUrl(parsed.coverImageUrl),
        coverStats: normalizeCoverStats(parsed),
        footerCtas: normalizeFooterCtasJson(parsed),
        publishedAt:
          parsed.status === 'PUBLISHED' ? existingPost.publishedAt ?? new Date() : parsed.status === 'ARCHIVED' ? null : existingPost.publishedAt,
        categories: {
          create: categories.map((category) => ({ categoryId: category.id })),
        },
        tags: {
          create: tags.map((tag) => ({ tagId: tag.id })),
        },
      },
    }),
  ]);

  const nextSlug = normalizePostSlug(parsed.slug);
  revalidateBlogPostPaths({
    slug: nextSlug,
    pathPrefix: parsed.pathPrefix,
    oldSlug: existingPost.slug,
    oldPathPrefix: existingPost.pathPrefix,
  });
}

export async function deletePost(id: string): Promise<void> {
  await assertAdminSession();
  const postId = id.trim();
  if (!postId) throw new Error('invalid_post_id');

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { slug: true, pathPrefix: true } });
  if (!post) return;
  await prisma.post.delete({ where: { id: postId } });
  revalidateBlogPostPaths({ slug: post.slug, pathPrefix: post.pathPrefix });
}

export async function publishPost(id: string): Promise<void> {
  await assertAdminSession();
  const postId = id.trim();
  if (!postId) throw new Error('invalid_post_id');
  const post = await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
    select: { slug: true, pathPrefix: true },
  });
  revalidateBlogPostPaths({ slug: post.slug, pathPrefix: post.pathPrefix });
}

