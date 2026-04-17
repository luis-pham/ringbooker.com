import {
  ContentHubHeroActionsHomeStyle,
  MarketingContentHub,
} from '@/components/marketing/marketing-content-hub';
import { compareHub } from '@/lib/marketing/content-hub-data';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Compare Salon Call Options: Voicemail, Staff, Services & RingBooker',
  description:
    'See how voicemail, missed-call text-back, answering services, extra staff, and generic phone AI stack up against beauty-focused call answering — so you can choose what fits your salon or spa.',
  path: '/compare',
});

const compareWebPageDescription =
  'See how voicemail, missed-call text-back, answering services, extra staff, and generic phone AI stack up against beauty-focused call answering — so you can choose what fits your salon or spa.';

export default function CompareIndexPage() {
  const c = compareHub;
  return (
    <MarketingContentHub
      {...c}
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
