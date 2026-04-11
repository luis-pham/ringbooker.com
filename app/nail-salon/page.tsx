import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Nail Salons',
  description:
    'RingBooker answers after-hours and overflow calls for nail salons on your current number, supports English and Vietnamese callers, and recovers missed bookings.',
  path: '/nail-salon',
});

export default function NailSalonPage() {
  return <MarketingVerticalTemplate vertical="nail-salon" />;
}
