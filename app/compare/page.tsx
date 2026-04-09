import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker Alternatives and Comparisons',
  description:
    'Compare RingBooker with other AI receptionist tools for nail salons, hair salons, spas, and med spas.',
  path: '/compare',
});

export default function CompareIndexPage() {
  return (
    <MarketingSeoPage
      badge="Compare"
      title="RingBooker Comparison Hub"
      intro="If you are evaluating AI receptionist tools, start here. These pages break down differences by salon workflow, booking depth, and day-to-day front desk impact."
      sections={[
        {
          heading: 'Available comparison pages',
          content: [
            '1. /compare/vs-truelark',
            '2. /compare/vs-my-ai-front-desk',
            '3. /compare/vs-goodcall',
          ],
        },
      ]}
    />
  );
}
