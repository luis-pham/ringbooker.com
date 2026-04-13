import type { Metadata } from 'next';

import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildBlogPostStaticParams } from '@/lib/blog/blog-post-meta';
import {
  isMarketingIndustryUrlSegment,
  marketingIndustryLandingMetadata,
  marketingIndustryStaticSlugParams,
  marketingSegmentToVertical,
} from '@/lib/marketing/industry-landings';

type RouteProps = { params: Promise<{ slug: string }> };

export const revalidate = 3600;

export async function generateStaticParams() {
  const marketing = marketingIndustryStaticSlugParams();
  const taken = new Set(marketing.map((m) => m.slug));
  let blog: { slug: string }[] = [];
  try {
    blog = await buildBlogPostStaticParams('industries');
  } catch {
    blog = [];
  }
  const extra = blog.filter((b) => !taken.has(b.slug));
  return [...marketing, ...extra];
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (isMarketingIndustryUrlSegment(slug)) {
    return marketingIndustryLandingMetadata(slug);
  }
  return buildBlogPostMetadata('industries', slug);
}

export default async function IndustriesSlugPage({ params }: RouteProps) {
  const { slug } = await params;
  const vertical = marketingSegmentToVertical(slug);
  if (vertical) {
    return <MarketingVerticalTemplate vertical={vertical} />;
  }
  return <BlogPostView pathPrefix="industries" slug={slug} />;
}
