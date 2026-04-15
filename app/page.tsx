import { MarketingHomeTemplate } from '@/components/marketing/marketing-home';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker | Missed-Call & After-Hours Booking Recovery for Salons & Spas',
  description:
    'Missed calls become missed bookings and lost revenue. RingBooker answers after-hours, peak-hour overflow, and second-line calls on your current number — no new booking software. 14-day free trial.',
  path: '/',
});

export default function HomePage() {
  return <MarketingHomeTemplate />;
}
