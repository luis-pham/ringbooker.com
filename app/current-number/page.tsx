import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { currentNumberHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const currentNumberDescription =
  'Keep your current business number and add AI coverage through call forwarding. RingBooker helps salons and spas start with after-hours or overflow without listing churn.';

export const metadata = buildMetadata({
  title: 'Keep Your Salon Number — AI Call Forwarding | RingBooker',
  description: currentNumberDescription,
  path: '/current-number',
});

export const dynamic = 'force-dynamic';

export default async function CurrentNumberHubPage() {
  const posts = await getPublishedPostsByPathPrefix('current-number', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  return (
    <MarketingContentHub
      {...currentNumberHub}
      resourceLinks={resourceLinks}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      seoHub={{
        path: '/current-number',
        webPageName: 'Keep your current business phone number with AI call answering',
        description: currentNumberDescription,
      }}
    />
  );
}
