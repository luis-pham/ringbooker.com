import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { trustHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Trust, Reliability & Transparent AI Call Handling | RingBooker',
  description:
    'How RingBooker approaches reliable AI phone answering for salons and spas: human fallback, phased rollout, and clear expectations.',
  path: '/trust',
});

export default function TrustHubPage() {
  const c = trustHub;
  return <MarketingContentHub {...c} heroActions={<ContentHubHeroActionsHomeStyle />} />;
}
