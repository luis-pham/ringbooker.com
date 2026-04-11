import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Hair Salons',
  description:
    'RingBooker helps hair salons answer after-hours and overflow calls, handle stylist requests, reschedules, and convert callers into confirmed appointments.',
  path: '/hair-salon',
});

export default function HairSalonPage() {
  return <MarketingVerticalTemplate vertical="hair-salon" />;
}
