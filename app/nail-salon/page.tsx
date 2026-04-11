import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Nail Salons | RingBooker',
  description:
    'RingBooker is the AI receptionist for nail salons — answers after-hours and overflow calls on your current number, supports English and Vietnamese, captures walk-in and same-day bookings, and stops missed calls from costing you clients.',
  path: '/nail-salon',
});

export default function NailSalonPage() {
  return <MarketingVerticalTemplate vertical="nail-salon" />;
}
