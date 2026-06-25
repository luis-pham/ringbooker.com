import type { Metadata } from 'next';

import { MarketingAboutPage, type MarketingAboutContent } from '@/components/marketing/marketing-about';
import { loadPageContent } from '@/lib/content';
import { buildAboutSchemas } from '@/lib/schema';

type AboutPageContent = MarketingAboutContent & {
  meta: {
    title: string;
    description: string;
    canonical: string;
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = loadPageContent<AboutPageContent>('about');
  return {
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    alternates: {
      canonical: `https://ringbooker.com${frontmatter.meta.canonical}`,
    },
  };
}

export default function AboutPage() {
  const { frontmatter } = loadPageContent<AboutPageContent>('about');
  const schemas = buildAboutSchemas(frontmatter);
  return (
    <>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <MarketingAboutPage content={frontmatter} />
    </>
  );
}
