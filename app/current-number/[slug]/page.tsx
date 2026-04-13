import type { Metadata } from 'next';

import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildBlogPostStaticParams } from '@/lib/blog/blog-post-meta';

type RouteProps = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return buildBlogPostStaticParams('current-number');
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  return buildBlogPostMetadata('current-number', slug);
}

export default async function CurrentNumberBlogPostPage({ params }: RouteProps) {
  const { slug } = await params;
  return <BlogPostView pathPrefix="current-number" slug={slug} />;
}
