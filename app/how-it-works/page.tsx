import { MarketingHowItWorksTemplate } from '@/components/marketing/marketing-how-it-works';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'How RingBooker Works | Keep Number, Cover Missed Calls | RingBooker',
  description:
    'See how RingBooker answers after-hours calls, covers peak-hour overflow, texts missed callers back, and helps salons recover revenue without changing their phone number or booking system.',
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return <MarketingHowItWorksTemplate />;
}
