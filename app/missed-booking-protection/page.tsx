import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { missedBookingProtectionHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const missedBookingProtectionDescription =
  'Recover and protect revenue lost to missed calls: after-hours and peak-hour coverage so beauty businesses capture booking intent before callers book elsewhere.';

export const metadata = buildMetadata({
  title: 'Missed Booking Protection for Beauty Businesses | RingBooker',
  description: missedBookingProtectionDescription,
  path: '/missed-booking-protection',
});

/** Hub listing from CMS — match cache behavior with other marketing hubs */
export const dynamic = 'force-dynamic';

export default async function MissedBookingProtectionHubPage() {
  const posts = await getPublishedPostsByPathPrefix('missed-booking-protection', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  return (
    <MarketingContentHub
      {...missedBookingProtectionHub}
      resourceLinks={resourceLinks}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      seoHub={{
        path: '/missed-booking-protection',
        webPageName: 'Missed booking protection for beauty businesses',
        description: missedBookingProtectionDescription,
      }}
    />
  );
}
