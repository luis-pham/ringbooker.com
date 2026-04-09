import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata, siteConfig } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker vs My AI Front Desk',
  description:
    'A practical RingBooker vs My AI Front Desk comparison for nail salons, hair salons, and spas.',
  path: '/compare/vs-my-ai-front-desk',
});

export default function CompareVsMyAiFrontDeskPage() {
  return (
    <MarketingSeoPage
      badge="Comparison"
      title="RingBooker vs My AI Front Desk"
      intro="Both products target phone automation, but RingBooker emphasizes salon-ready conversion flow with clear operational visibility."
      sections={[
        {
          heading: 'Direct answer',
          content: [
            'RingBooker is generally better for teams that care most about appointment conversion, front desk load reduction, and post-call follow-up consistency.',
          ],
        },
        {
          heading: 'Operational differences that matter',
          content: [
            'RingBooker focuses on high-signal workflows: missed-call recovery, live booking, reminder flow, and transcript/call outcome visibility.',
            'Industry pages and messaging are aligned to beauty verticals for faster onboarding and stronger intent matching.',
          ],
        },
      ]}
      faqs={[
        {
          q: 'Is RingBooker a My AI Front Desk alternative?',
          a: 'Yes. It is a direct alternative, especially for nail, hair, spa, and med spa booking operations.',
        },
        {
          q: 'Can RingBooker handle after-hours calls?',
          a: 'Yes. RingBooker is designed for always-on call handling and booking continuity outside business hours.',
        },
      ]}
      articleJsonLd={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'RingBooker vs My AI Front Desk',
        datePublished: '2026-04-08',
        dateModified: '2026-04-08',
        author: { '@type': 'Organization', name: siteConfig.name },
      }}
    />
  );
}
