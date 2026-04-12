import { MarketingHowItWorksTemplate } from '@/components/marketing/marketing-how-it-works';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'How RingBooker Works on Your Current Number',
  description:
    'See how RingBooker handles after-hours and overflow calls, reschedules, cancellations, and missed-call text back on your current business number.',
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return <MarketingHowItWorksTemplate />;
}
