import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Receptionist for Spas and Day Spas | RingBooker',
  description:
    'RingBooker is the AI answering service for spas and day spas — captures after-hours calls, handles couples massage bookings, answers treatment questions, and covers your front desk while therapists are in session.',
  path: '/spa',
});

export default function SpaPage() {
  return <MarketingVerticalTemplate vertical="spa" />;
}
