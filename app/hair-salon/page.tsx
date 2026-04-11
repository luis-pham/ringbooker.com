import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Hair Salons | RingBooker',
  description:
    'RingBooker is the AI receptionist for hair salons — handles stylist-match requests, color appointment booking, reschedule calls, and overflow calls on your current number so your team stays focused in-chair.',
  path: '/hair-salon',
});

export default function HairSalonPage() {
  return <MarketingVerticalTemplate vertical="hair-salon" />;
}
