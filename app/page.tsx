import { MarketingHomeTemplate } from '@/components/marketing/marketing-home';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'RingBooker — AI Phone Answering Service for Salons, Nail Shops & Spas',
  description:
    'Stop losing bookings to voicemail. RingBooker answers after-hours and overflow calls on your current number — no migration needed. 14-day free trial.',
  path: '/',
});

export default function HomePage() {
  return <MarketingHomeTemplate />;
}
