import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { worksWithHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const worksWithDescription =
  'RingBooker works alongside your booking workflow. Square Appointments is live, while Vagaro, Booksy, and Mindbody can start with workflow-compatible call handling and handoff.';

export const metadata = buildMetadata({
  title: 'Works With Square Appointments and Your Booking Tools | RingBooker',
  description: worksWithDescription,
  path: '/works-with',
});

export const dynamic = 'force-dynamic';

export default async function WorksWithHubPage() {
  const posts = await getPublishedPostsByPathPrefix('works-with', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  return (
    <MarketingContentHub
      {...worksWithHub}
      resourceLinks={resourceLinks}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      seoHub={{
        path: '/works-with',
        webPageName: 'Works with your booking tools and salon workflow',
        description: worksWithDescription,
      }}
    />
  );
}
