import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { worksWithHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Works With Your Booking Tools — Square, Vagaro, Booksy & More | RingBooker',
  description:
    'RingBooker works alongside Square Appointments, Vagaro, Booksy, Mindbody, and your existing salon workflow. No forced system replacement.',
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
    />
  );
}
