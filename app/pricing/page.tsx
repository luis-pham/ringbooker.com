import { MarketingPricingTemplate } from '@/components/marketing/marketing-pricing';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Salon Call Recovery Pricing | After-Hours, Peak-Hour & Missed-Call Revenue Protection',
  description:
    'See RingBooker pricing for after-hours answering, peak-hour overflow coverage, missed-call text back, and revenue recovery for salons, spas, med spas, and clinics.',
  path: '/pricing',
});

export default function PricingPage() {
  return <MarketingPricingTemplate />;
}
