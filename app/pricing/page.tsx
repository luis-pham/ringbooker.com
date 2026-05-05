import { MarketingPricingTemplate } from '@/components/marketing/marketing-pricing';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker | Pricing — AI Receptionist for Salons & Spas',
  description:
    'See RingBooker pricing — from $79/month for after-hours answering, overflow coverage, and missed-call recovery for salons, spas, and med spas.',
  path: '/pricing',
});

export default function PricingPage() {
  return <MarketingPricingTemplate />;
}
