import type { Metadata } from 'next';

import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildIndustriesNestedBlogStaticParams } from '@/lib/blog/blog-post-meta';

type RouteProps = { params: Promise<{ slug: string; articleSlug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return buildIndustriesNestedBlogStaticParams();
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug, articleSlug } = await params;
  return buildBlogPostMetadata(`industries/${slug}`, articleSlug);
}

export default async function IndustriesNestedBlogPostPage({ params }: RouteProps) {
  const { slug, articleSlug } = await params;
  return <BlogPostView pathPrefix={`industries/${slug}`} slug={articleSlug} />;
}
