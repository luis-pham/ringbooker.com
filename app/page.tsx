import { MarketingHomeTemplate } from '@/components/marketing/marketing-home';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Agent for Nail, Hair, Spa, and Med Spa Businesses',
  description:
    'RingBooker is an AI phone receptionist for nail shops, hair salons, spas, med spas, and beauty clinics. Answer calls 24/7 and convert more bookings.',
  path: '/',
});

export default function HomePage() {
  return <MarketingHomeTemplate />;
}
