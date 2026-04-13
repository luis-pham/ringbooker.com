import type { Metadata } from 'next';

import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildIndustriesNestedBlogStaticParams } from '@/lib/blog/blog-post-meta';

type RouteProps = { params: Promise<{ industry: string; slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return buildIndustriesNestedBlogStaticParams();
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { industry, slug } = await params;
  return buildBlogPostMetadata(`industries/${industry}`, slug);
}

export default async function IndustriesNestedBlogPostPage({ params }: RouteProps) {
  const { industry, slug } = await params;
  return <BlogPostView pathPrefix={`industries/${industry}`} slug={slug} />;
}
