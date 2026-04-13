import type { Metadata } from 'next';

import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildBlogPostStaticParams } from '@/lib/blog/blog-post-meta';

type RouteProps = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  return buildBlogPostStaticParams('phone-booking-recovery');
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  return buildBlogPostMetadata('phone-booking-recovery', slug);
}

export default async function PhoneBookingRecoveryBlogPostPage({ params }: RouteProps) {
  const { slug } = await params;
  return <BlogPostView pathPrefix="phone-booking-recovery" slug={slug} />;
}
