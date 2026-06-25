import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { loadHubContent } from '@/lib/content';
import { buildHubSchemas } from '@/lib/schema';
import { buildMetadata } from '@/lib/site';

export function generateMetadata() {
  const { frontmatter } = loadHubContent<any>('compare');
  return buildMetadata({
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    path: frontmatter.meta.canonical,
  });
}

/** Listing is driven by CMS posts; avoid stale caches after publish (see admin blog revalidatePath). */
export const dynamic = 'force-dynamic';

export default async function CompareIndexPage() {
  const { frontmatter } = loadHubContent<any>('compare');
  const schemas = buildHubSchemas(frontmatter);
  const posts = await getPublishedPostsByPathPrefix('compare', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <MarketingContentHub
        hub={frontmatter}
        resourceLinks={resourceLinks}
        heroActions={<ContentHubHeroActionsHomeStyle />}
        mainExtraClassName="hub-compare-index"
      />
    </>
  );
}
