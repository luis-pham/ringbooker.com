import { notFound } from 'next/navigation';

import { BlogPostForm } from '@/components/admin/blog-post-form';
import { prisma } from '@/lib/prisma';

import { updatePost } from '../../actions';
import { parseStoredFooterCtas } from '@/lib/blog/footer-cta-templates';
import { isBlogPathPrefix } from '@/lib/blog/path-prefixes';

import { sanitizeCoverImageInput, type PostFormData } from '../../post-schema';

export const metadata = {
  title: 'Edit Blog Post',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminBlogEditPage({ params }: PageProps) {
  const { id } = await params;

  const [post, categories] = await Promise.all([
    prisma.post.findUnique({
      where: { id },
      include: {
        categories: { select: { categoryId: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!post) {
    notFound();
  }

  const initialData: PostFormData = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    status: post.status,
    categoryIds: post.categories.map((item) => item.categoryId),
    tags: post.tags.map((item) => item.tag.name),
    featured: post.featured,
    coverImageUrl: sanitizeCoverImageInput(post.coverImageUrl),
    coverStats: Array.isArray(post.coverStats)
      ? post.coverStats
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const stat = item as { num?: unknown; label?: unknown };
            if (typeof stat.num !== 'string' || typeof stat.label !== 'string') return null;
            return { num: stat.num, label: stat.label };
          })
          .filter((item): item is { num: string; label: string } => Boolean(item))
          .slice(0, 3)
      : [],
    readTimeMin: post.readTimeMin,
    pathPrefix: isBlogPathPrefix(post.pathPrefix) ? post.pathPrefix : 'blog',
    footerCtas: parseStoredFooterCtas(post.footerCtas),
  };

  async function saveAction(data: PostFormData) {
    'use server';
    await updatePost(id, data);
  }

  return (
    <BlogPostForm key={id} mode="edit" postId={id} categories={categories} initialData={initialData} onSubmitAction={saveAction} />
  );
}
