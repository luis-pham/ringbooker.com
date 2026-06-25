import type { Metadata } from 'next';

import { MarketingPricingTemplate, type PricingPageContent } from '@/components/marketing/marketing-pricing';
import { loadPageContent } from '@/lib/content';
import { buildPricingSchemas } from '@/lib/schema';
import { buildMetadata } from '@/lib/site';

export function generateMetadata(): Metadata {
  const { frontmatter } = loadPageContent<PricingPageContent>('pricing');

  return buildMetadata({
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    path: frontmatter.meta.canonical,
  });
}

export default function PricingPage() {
  const { frontmatter } = loadPageContent<PricingPageContent>('pricing');
  const schemas = buildPricingSchemas(frontmatter);

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <MarketingPricingTemplate content={frontmatter} />
    </>
  );
}
