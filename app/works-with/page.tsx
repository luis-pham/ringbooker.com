import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { worksWithHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const worksWithDescription =
  'RingBooker works alongside Square Appointments, Vagaro, Booksy, Mindbody, and your existing salon workflow. No forced system replacement.';

export const metadata = buildMetadata({
  title: 'Works With Your Booking Tools — Square, Vagaro, Booksy & More | RingBooker',
  description: worksWithDescription,
  path: '/works-with',
});

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
