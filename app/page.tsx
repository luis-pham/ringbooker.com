import { MarketingHomeTemplate, type HomePageContent } from '@/components/marketing/marketing-home';
import { loadPageContent } from '@/lib/content';
import { buildHomeSchemas } from '@/lib/schema';

export async function generateMetadata() {
  const { frontmatter } = loadPageContent<HomePageContent>('home');

  return {
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    alternates: {
      canonical: 'https://ringbooker.com/',
    },
  };
}

export default function HomePage() {
  const { frontmatter } = loadPageContent<HomePageContent>('home');
  const schemas = buildHomeSchemas(frontmatter);

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <MarketingHomeTemplate content={frontmatter} />
    </>
  );
}
