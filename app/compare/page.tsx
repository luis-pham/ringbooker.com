import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { compareHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Compare RingBooker With Voicemail, Answering Services & More',
  description:
    'See how voicemail, missed-call text-back, answering services, extra staff, and generic phone AI stack up against beauty-focused call answering — so you can choose what fits your salon or spa.',
  path: '/compare',
});

const compareWebPageDescription =
  'See how voicemail, missed-call text-back, answering services, extra staff, and generic phone AI stack up against beauty-focused call answering — so you can choose what fits your salon or spa.';

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
