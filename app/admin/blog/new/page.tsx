import { BlogPostForm } from '@/components/admin/blog-post-form';
import { prisma } from '@/lib/prisma';

import { createPost } from '../actions';

export const metadata = {
  title: 'New Blog Post',
};

export const dynamic = 'force-dynamic';

export default async function AdminBlogNewPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  return <BlogPostForm mode="create" categories={categories} onSubmitAction={createPost} />;
}
