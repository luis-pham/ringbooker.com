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
  title: 'Missed Booking Protection for Salons & Spas — AI Call Coverage | RingBooker',
  description: missedBookingProtectionDescription,
  path: '/missed-booking-protection',
});

/** Hub listing from CMS — match cache behavior with other marketing hubs */
export const dynamic = 'force-dynamic';

/** Static solution pages (not CMS posts) — always surface first in “In this hub”. */
const MISSED_BOOKING_HUB_SOLUTION_LINKS: { href: string; label: string }[] = [
  { href: '/missed-booking-protection/after-hours-calls', label: 'After-hours call answering' },
  { href: '/missed-booking-protection/peak-hour-overflow-calls', label: 'Peak-hour overflow coverage' },
  { href: '/missed-booking-protection/missed-call-recovery', label: 'Missed-call recovery' },
];

export default async function MissedBookingProtectionHubPage() {
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
