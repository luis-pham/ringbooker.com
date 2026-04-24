import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { getPublishedPostsByPathPrefix } from '@/lib/blog';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { trustHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const trustDescription =
  'How RingBooker approaches reliable AI phone answering for salons and spas: human fallback, phased rollout, and clear expectations.';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Salons — Honest, Reliable, Human-Friendly | RingBooker',
  description: trustDescription,
  path: '/trust',
});

export const dynamic = 'force-dynamic';

export default async function TrustHubPage() {
  const posts = await getPublishedPostsByPathPrefix('trust', { limit: 48 });
  const resourceLinks = posts.map((p) => ({
    href: postPublicPath(p.pathPrefix, p.slug),
    label: p.title,
  }));

  const c = trustHub;
  return (
    <MarketingContentHub
      {...c}
      resourceLinks={resourceLinks}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      seoHub={{
        path: '/trust',
        webPageName: 'Trust and reliable AI call handling for beauty businesses',
        description: trustDescription,
      }}
    />
  );
}
