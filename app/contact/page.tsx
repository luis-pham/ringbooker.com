import type { Metadata } from 'next';

import { MarketingContactTemplate, type MarketingContactContent } from '@/components/marketing/marketing-contact';
import { loadPageContent } from '@/lib/content';
import { buildContactSchemas } from '@/lib/schema';
import { buildMetadata } from '@/lib/site';

type ContactPageContent = MarketingContactContent & {
  meta: {
    title: string;
    description: string;
    canonical: string;
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const { frontmatter } = loadPageContent<ContactPageContent>('contact');
  return buildMetadata({
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    path: frontmatter.meta.canonical,
  });
}

export default function ContactPage() {
  const { frontmatter } = loadPageContent<ContactPageContent>('contact');
  const schemas = buildContactSchemas(frontmatter);
  return (
    <>
      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <MarketingContactTemplate content={frontmatter} />
    </>
  );
}
