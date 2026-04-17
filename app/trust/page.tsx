import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { trustHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

const trustDescription =
  'How RingBooker approaches reliable AI phone answering for salons and spas: human fallback, phased rollout, and clear expectations.';

export const metadata = buildMetadata({
  title: 'Trust, Reliability & Human-Friendly AI | RingBooker',
  description: trustDescription,
  path: '/trust',
});

export default function TrustHubPage() {
  const c = trustHub;
  return (
    <MarketingContentHub
      {...c}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      seoHub={{
        path: '/trust',
        webPageName: 'Trust and reliable AI call handling for beauty businesses',
        description: trustDescription,
      }}
    />
  );
}
