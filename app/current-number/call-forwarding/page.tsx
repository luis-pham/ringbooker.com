import type { Metadata } from 'next';

import { CurrentNumberCallForwardingTool } from '@/components/marketing/current-number-call-forwarding-tool';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';
import { buildMetadata, siteConfig } from '@/lib/site';

const PAGE_TITLE = 'Call Forwarding Setup Guides for Salons & Spas | RingBooker';
const PAGE_DESCRIPTION =
  'Forward missed, busy, or after-hours salon and spa calls to RingBooker while keeping your current number. View setup guides for US, Canada, Australia, VoIP systems, and more.';

const FAQ_ITEMS = [
  {
    q: 'Will customers see a different number?',
    a: 'No. Your public business number stays the same, because RingBooker works through forwarding behind the scenes.',
  },
  {
    q: 'Should I forward all calls or only missed calls?',
    a: 'Most teams start with missed, busy, and after-hours forwarding so staff can still answer normal calls first.',
  },
  {
    q: 'Can I use RingBooker after hours only?',
    a: 'Yes. Most providers support time-based routing so RingBooker only handles off-hours calls.',
  },
  {
    q: 'Can I turn call forwarding off?',
    a: 'Yes. Disable forwarding in your provider settings and run a quick test call.',
  },
  {
    q: 'What if my provider is not listed?',
    a: 'Many systems still support call forwarding. RingBooker can help you validate setup before going live.',
  },
  {
    q: 'Will this affect my Google Business Profile number?',
    a: 'No. You keep your published number and forward selected calls, so no listing number change is required.',
  },
  {
    q: 'Are RingBooker and these phone providers affiliated?',
    a: 'No. Provider names and logos are used for identification only. RingBooker is not affiliated with or endorsed by these providers unless explicitly stated.',
  },
] as const;

export const metadata: Metadata = buildMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: '/current-number/call-forwarding',
});

const breadcrumbJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: siteConfig.url,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Current Number',
      item: `${siteConfig.url}/current-number`,
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Call Forwarding',
      item: `${siteConfig.url}/current-number/call-forwarding`,
    },
  ],
};

const faqJsonLd = buildFaqPageJsonLd(FAQ_ITEMS);

export default function CurrentNumberCallForwardingPage() {
  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />
      <CurrentNumberCallForwardingTool />
      <MarketingFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {faqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      ) : null}
    </>
  );
}
