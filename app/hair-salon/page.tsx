import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Agent for Hair Salons',
  description:
    'RingBooker helps hair salons answer every call, handle booking questions, and convert more callers into confirmed appointments.',
  path: '/hair-salon',
});

export default function HairSalonPage() {
  return <MarketingVerticalTemplate vertical="hair-salon" />;
}
