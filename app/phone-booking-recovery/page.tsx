import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { phoneBookingRecoveryHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const phoneBookingRecoveryDescription =
  'Recover and protect revenue lost to missed calls: after-hours and peak-hour coverage so beauty businesses capture booking intent before callers book elsewhere.';

export const metadata = buildMetadata({
  title: 'Phone Booking Recovery for Beauty Businesses | RingBooker',
  description: phoneBookingRecoveryDescription,
  path: '/phone-booking-recovery',
});

/** Hub listing from CMS — match cache behavior with other marketing hubs */
export const dynamic = 'force-dynamic';

export default async function PhoneBookingRecoveryHubPage() {
  const posts = await getPublishedPostsByPathPrefix('phone-booking-recovery', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  return (
    <MarketingContentHub
      {...phoneBookingRecoveryHub}
      resourceLinks={resourceLinks}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      seoHub={{
        path: '/phone-booking-recovery',
        webPageName: 'Phone booking recovery for beauty businesses',
        description: phoneBookingRecoveryDescription,
      }}
    />
  );
}
