import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Hair Salons & Stylists',
  description:
    'AI phone answering for hair salons: capture overflow and after-hours calls, handle stylist requests, color bookings, reschedules, and SMS confirmations.',
  path: '/hair-salon',
});

export default function HairSalonPage() {
  return <MarketingVerticalTemplate vertical="hair-salon" />;
}
