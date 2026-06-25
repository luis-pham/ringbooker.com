import type { Metadata } from 'next';

import { MarketingHowItWorksTemplate, type MarketingHowItWorksContent } from '@/components/marketing/marketing-how-it-works';
import { loadPageContent } from '@/lib/content';
import { buildHowItWorksSchemas } from '@/lib/schema';

type HowItWorksPageContent = MarketingHowItWorksContent & {
  meta: {
    title: string;
    description: string;
    canonical: string;
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = loadPageContent<HowItWorksPageContent>('how-it-works');
  return {
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    alternates: {
      canonical: `https://ringbooker.com${frontmatter.meta.canonical}`,
    },
  };
}

export default function HowItWorksPage() {
  const { frontmatter } = loadPageContent<HowItWorksPageContent>('how-it-works');
  const schemas = buildHowItWorksSchemas(frontmatter);
  return (
    <>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <MarketingHowItWorksTemplate content={frontmatter} />
    </>
  );
}
