import { MarketingHomeTemplate } from '@/components/marketing/marketing-home';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker | AI Receptionist & Phone Answering for Beauty Businesses',
  description:
    'RingBooker helps salons, spas, med spas, and clinics recover missed bookings, protect revenue, answer after-hours and peak-hour calls, and configure the essentials in about 15 minutes on their current number.',
  path: '/',
});

export default function HomePage() {
  return <MarketingHomeTemplate />;
}
