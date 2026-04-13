import type { Metadata } from 'next';

import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildBlogPostStaticParams } from '@/lib/blog/blog-post-meta';

type RouteProps = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return buildBlogPostStaticParams('industries');
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  return buildBlogPostMetadata('industries', slug);
}

export default async function IndustriesBlogPostPage({ params }: RouteProps) {
  const { slug } = await params;
  return <BlogPostView pathPrefix="industries" slug={slug} />;
}
