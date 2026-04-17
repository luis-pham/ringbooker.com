import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { compareHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker Comparisons — vs Voicemail, Generic AI & Alternatives',
  description:
    'Compare RingBooker with other AI receptionist options and traditional choices for nail salons, hair salons, spas, and med spas.',
  path: '/compare',
});

export default function CompareIndexPage() {
  const c = compareHub;
  return (
    <MarketingContentHub
      {...c}
      heroActions={<ContentHubHeroActionsHomeStyle />}
      mainExtraClassName="hub-compare-index"
    />
  );
}
