import { MarketingHomeTemplate, type HomePageContent } from '@/components/marketing/marketing-home';
import { loadPageContent } from '@/lib/content';
import { buildHomeSchemas } from '@/lib/schema';
import { buildMetadata } from '@/lib/site';

export async function generateMetadata() {
  const { frontmatter } = loadPageContent<HomePageContent>('home');

  return buildMetadata({
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    path: '/',
  });
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
