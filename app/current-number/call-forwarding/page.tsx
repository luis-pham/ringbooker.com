import type { Metadata } from 'next';

import { CurrentNumberCallForwardingTool } from '@/components/marketing/current-number-call-forwarding-tool';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { CALL_FORWARDING_FAQ_ITEMS } from '@/lib/marketing/current-number-call-forwarding-faq';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';
import { buildMetadata, siteConfig } from '@/lib/site';

const PAGE_TITLE = 'Call Forwarding Setup Guides for Salons & Spas | RingBooker';
const PAGE_DESCRIPTION =
  'Forward missed, busy, or after-hours salon and spa calls to RingBooker while keeping your current number. View setup guides for US, Canada, Australia, VoIP systems, and more.';

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

const faqJsonLd = buildFaqPageJsonLd(CALL_FORWARDING_FAQ_ITEMS);

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
