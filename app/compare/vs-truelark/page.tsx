import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata, siteConfig } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker vs TrueLark',
  description:
    'Compare RingBooker vs TrueLark for nail salons and beauty businesses: call handling, booking depth, and pricing fit.',
  path: '/compare/vs-truelark',
});

export default function CompareVsTrueLarkPage() {
  return (
    <MarketingSeoPage
      badge="Comparison"
      title="RingBooker vs TrueLark: Which Fits Beauty Businesses Better?"
      intro="RingBooker is built for nail, hair, spa, and med spa call-to-booking workflows with strong missed-call recovery and live voice handling."
      sections={[
        {
          heading: 'Direct answer',
          content: [
            'If your priority is turning phone calls into confirmed appointments with fewer front-desk interruptions, RingBooker is usually the better fit for salon-style operations.',
          ],
        },
        {
          heading: 'Where RingBooker is stronger',
          content: [
            'Faster setup for booking-heavy teams that need live call coverage now.',
            'Clear focus on practical workflows: availability checks, callback recovery, reminders, and outcome logs.',
            'Industry-specific landing pages and scripts for nail, hair, spa, med spa, and beauty clinic.',
          ],
        },
        {
          heading: 'When to choose based on your team',
          content: [
            'Choose RingBooker if your calls arrive during active services and you need immediate booking conversion from phone traffic.',
            'Compare both if you have a larger enterprise stack and need a broader procurement process.',
          ],
        },
      ]}
      faqs={[
        {
          q: 'Is RingBooker a TrueLark alternative for nail salons?',
          a: 'Yes. RingBooker is positioned as a practical alternative for nail salons that need immediate call coverage and booking conversion.',
        },
        {
          q: 'Does RingBooker support Square Appointments?',
          a: 'Yes. Square Appointments is available now, with additional provider integrations expanding.',
        },
      ]}
      articleJsonLd={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'RingBooker vs TrueLark',
        datePublished: '2026-04-08',
        dateModified: '2026-04-08',
        author: { '@type': 'Organization', name: siteConfig.name },
      }}
    />
  );
}
