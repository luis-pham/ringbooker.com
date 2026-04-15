import { MarketingHowItWorksTemplate } from '@/components/marketing/marketing-how-it-works';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'How RingBooker Works — Current Number, No Booking Software Migration',
  description:
    'Forward from your existing salon or spa line. RingBooker answers after-hours, peak-hour overflow, and missed-call follow-up while you keep Square, Vagaro, or Booksy — no migration.',
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return <MarketingHowItWorksTemplate />;
}
