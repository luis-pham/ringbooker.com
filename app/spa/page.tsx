import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Spas and Day Spas',
  description:
    'AI phone answering for spa and day spa teams. Capture after-hours calls, handle treatment bookings, recover missed callers, and improve front desk coverage.',
  path: '/spa',
});

export default function SpaPage() {
  return <MarketingVerticalTemplate vertical="spa" />;
}
