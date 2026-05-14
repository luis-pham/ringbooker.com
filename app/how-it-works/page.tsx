import { MarketingHowItWorksTemplate } from '@/components/marketing/marketing-how-it-works';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'How It Works — Recover Lost Bookings, Keep Your Number | RingBooker',
  description:
    'Forward your existing line — RingBooker answers after-hours, covers overflow, sends missed-call texts, and captures intent before it becomes lost revenue.',
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return <MarketingHowItWorksTemplate />;
}
