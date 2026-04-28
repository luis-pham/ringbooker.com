import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { currentNumberHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const currentNumberDescription =
  'Add an AI receptionist on your current number via call forwarding — no new number, no listing changes, no client retraining. Guided 15-minute setup.';

export const metadata = buildMetadata({
  title: 'Keep Your Current Number — Add an AI Receptionist via Call Forwarding | RingBooker',
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
