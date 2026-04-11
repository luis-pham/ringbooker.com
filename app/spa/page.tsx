import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Receptionist for Day Spas & Wellness',
  description:
    'AI receptionist for day spas: answer after-hours and overflow calls, handle couples massage, package questions, reschedules, and SMS confirmations.',
  path: '/spa',
});

export default function SpaPage() {
  return <MarketingVerticalTemplate vertical="spa" />;
}
