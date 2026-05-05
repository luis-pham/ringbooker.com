import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { compareHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker | Compare — Voicemail, Hiring & Answering Services',
  description:
    'For nail salons, spas, and clinics, compare RingBooker with voicemail, answering services, extra front-desk hiring, and generic AI to see what fits after-hours coverage, overflow, and missed booking protection.',
  path: '/compare',
});

const compareWebPageDescription =
  'For nail salons, spas, and clinics, compare RingBooker with voicemail, answering services, extra front-desk hiring, and generic AI to see what fits after-hours coverage, overflow, and missed booking protection.';

/** Listing is driven by CMS posts; avoid stale caches after publish (see admin blog revalidatePath). */
export const dynamic = 'force-dynamic';

export default async function CompareIndexPage() {
  const posts = await getPublishedPostsByPathPrefix('compare', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  const c = compareHub;
  return (
    <MarketingContentHub
      {...c}
      resourceLinks={resourceLinks}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      mainExtraClassName="hub-compare-index"
      seoHub={{
        path: '/compare',
        webPageName: 'Compare salon and spa phone answering options',
        description: compareWebPageDescription,
      }}
    />
  );
}
