import { MarketingHowItWorksTemplate } from '@/components/marketing/marketing-how-it-works';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'How RingBooker Works on Your Current Number | Recover After-Hours and Missed Call Revenue',
  description:
    'See how RingBooker answers after-hours calls, covers peak-hour overflow, texts missed callers back, and helps salons recover revenue without changing their phone number or booking system.',
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return <MarketingHowItWorksTemplate />;
}
