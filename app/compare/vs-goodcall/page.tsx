import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata, siteConfig } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker vs Goodcall',
  description:
    'Compare RingBooker and Goodcall for salon and spa operations with phone-first booking workflows.',
  path: '/compare/vs-goodcall',
});

export default function CompareVsGoodcallPage() {
  return (
    <MarketingSeoPage
      badge="Comparison"
      title="RingBooker vs Goodcall for Booking-Heavy Teams"
      intro="If your business depends on inbound calls converting into appointments, RingBooker prioritizes that path end-to-end."
      sections={[
        {
          heading: 'Direct answer',
          content: [
            'For nail, hair, spa, med spa, and beauty clinic workflows, RingBooker is tailored around conversion from call to confirmed slot and follow-up.',
          ],
        },
        {
          heading: 'What to compare in real evaluation',
          content: [
            'How quickly your team can launch with real scripts and booking logic.',
            'How reliably the system handles after-hours and peak-hour calls.',
            'How clearly call outcomes, transcript insights, and reminder flow are visible to managers.',
          ],
        },
      ]}
      faqs={[
        {
          q: 'Is RingBooker a Goodcall alternative?',
          a: 'Yes. RingBooker is positioned as a direct alternative focused on beauty and wellness booking operations.',
        },
      ]}
      articleJsonLd={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'RingBooker vs Goodcall',
        datePublished: '2026-04-08',
        dateModified: '2026-04-08',
        author: { '@type': 'Organization', name: siteConfig.name },
      }}
    />
  );
}
