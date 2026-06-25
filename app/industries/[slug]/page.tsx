import type { Metadata } from 'next';

import { MarketingVerticalTemplate, type IndustryLandingContent, type MarketingVerticalKey } from '@/components/marketing/marketing-vertical';
import { BlogPostView } from '@/components/blog/blog-post-view';
import { buildBlogPostMetadata, buildBlogPostStaticParams } from '@/lib/blog/blog-post-meta';
import { loadIndustryContent } from '@/lib/content';
import { buildIndustrySchemas } from '@/lib/schema';
import { buildMetadata } from '@/lib/site';

type RouteProps = { params: Promise<{ slug: string }> };

const VALID_SLUGS = ['nail-salon', 'hair-salon', 'spa', 'med-spa', 'beauty-clinic'] as const;
type ValidIndustrySlug = (typeof VALID_SLUGS)[number];
const VALID_SLUG_SET = new Set<string>(VALID_SLUGS);

function isValidIndustrySlug(slug: string): slug is ValidIndustrySlug {
  return VALID_SLUG_SET.has(slug);
}

export const revalidate = 3600;

export async function generateStaticParams() {
  const marketing = VALID_SLUGS.map((slug) => ({ slug }));
  const taken = new Set<string>(marketing.map((m) => m.slug));
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
  if (isValidIndustrySlug(slug)) {
    const { frontmatter } = loadIndustryContent<IndustryLandingContent>(slug);
    const metadata = buildMetadata({
      title: frontmatter.meta.title,
      description: frontmatter.meta.description,
      path: frontmatter.meta.canonical,
    });
    if (slug === 'nail-salon') {
      return {
        ...metadata,
        alternates: {
          canonical: `https://ringbooker.com${frontmatter.meta.canonical}`,
          languages: {
            en: frontmatter.meta.canonical,
            'en-US': frontmatter.meta.canonical,
            vi: '/industries/nail-salon/vi',
            'x-default': frontmatter.meta.canonical,
          },
        },
      };
    }
    return metadata;
  }
  return buildBlogPostMetadata('industries', slug);
}

export default async function IndustriesSlugPage({ params }: RouteProps) {
  const { slug } = await params;
  if (isValidIndustrySlug(slug)) {
    const { frontmatter } = loadIndustryContent<IndustryLandingContent>(slug);
    const schemas = buildIndustrySchemas(slug, frontmatter);
    return (
      <>
        {schemas.map((schema, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
        <MarketingVerticalTemplate vertical={slug as MarketingVerticalKey} content={frontmatter} />
      </>
    );
  }
  return <BlogPostView pathPrefix="industries" slug={slug} />;
}
