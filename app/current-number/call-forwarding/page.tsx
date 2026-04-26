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
    q: 'Can I keep my current business number?',
    a: 'Yes. RingBooker works through call forwarding, so your public business number stays unchanged.',
  },
  {
    q: 'Can I forward only missed or after-hours calls?',
    a: 'Yes. Most carriers and VoIP systems support conditional forwarding for missed, busy, and off-hours scenarios.',
  },
  {
    q: 'Do I need to route all calls to RingBooker?',
    a: 'No. Most teams start with missed and busy forwarding first, then expand to after-hours if needed.',
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
