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
  const { frontmatter } = loadHubContent<any>('missed-booking-protection');
  return buildMetadata({
    title: frontmatter.meta.title,
    description: frontmatter.meta.description,
    path: frontmatter.meta.canonical,
  });
}

/** Hub listing from CMS — match cache behavior with other marketing hubs */
export const dynamic = 'force-dynamic';

/** Static solution pages (not CMS posts) — always surface first in “In this hub”. */
const MISSED_BOOKING_HUB_SOLUTION_LINKS: { href: string; label: string }[] = [
  { href: '/missed-booking-protection/after-hours-calls', label: 'After-hours call answering' },
  { href: '/missed-booking-protection/peak-hour-overflow-calls', label: 'Peak-hour overflow coverage' },
  { href: '/missed-booking-protection/missed-call-recovery', label: 'Missed-call recovery' },
];

export default async function MissedBookingProtectionHubPage() {
  const { frontmatter } = loadHubContent<any>('missed-booking-protection');
  const schemas = buildHubSchemas(frontmatter);
  const posts = await getPublishedPostsByPathPrefix('missed-booking-protection', { limit: 48 });
  const pinnedHrefs = new Set(MISSED_BOOKING_HUB_SOLUTION_LINKS.map((l) => l.href));
  const fromCms = posts
    .map((p) => ({
      href: postPublicPath(p.pathPrefix, p.slug),
      label: p.title,
    }))
    .filter((l) => !pinnedHrefs.has(l.href));
  const resourceLinks = [...MISSED_BOOKING_HUB_SOLUTION_LINKS, ...fromCms];

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
      />
    </>
  );
}
