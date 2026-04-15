import { MarketingHomeTemplate } from '@/components/marketing/marketing-home';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Salons, Spas & Clinics | Recover Missed Bookings & Revenue',
  description:
    'RingBooker helps salons, spas, med spas, and clinics recover missed bookings, answer after-hours and peak-hour calls, and protect revenue on their current number without changing booking software.',
  path: '/',
});

export default function HomePage() {
  return <MarketingHomeTemplate />;
}
