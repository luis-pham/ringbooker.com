import { MarketingPricingTemplate } from '@/components/marketing/marketing-pricing';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker Pricing — Call Recovery & Revenue Protection for Salons',
  description:
    'Simple plans for AI phone answering that recovers missed bookings: after-hours coverage, peak-hour overflow, missed-call text back — on your current number, without replacing your booking tools.',
  path: '/pricing',
});

export default function PricingPage() {
  return <MarketingPricingTemplate />;
}
