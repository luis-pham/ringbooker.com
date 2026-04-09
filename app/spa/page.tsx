import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Receptionist for Spa and Day Spa',
  description:
    'AI receptionist for spa and day spa teams. Capture high-intent calls, handle bookings, and improve front desk coverage with RingBooker.',
  path: '/spa',
});

export default function SpaPage() {
  return <MarketingVerticalTemplate vertical="spa" />;
}
