import { MarketingHomeTemplate } from '@/components/marketing/marketing-home';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker | AI Phone Answering for Beauty Businesses',
  description:
    'RingBooker helps salons, spas, med spas, and clinics recover missed bookings, answer after-hours and peak-hour calls, and protect revenue on their current number without changing booking software.',
  path: '/',
});

export default function HomePage() {
  return <MarketingHomeTemplate />;
}
