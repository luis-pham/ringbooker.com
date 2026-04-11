import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Nail Salons & Shops',
  description:
    'AI phone answering for nail salons: answer after-hours and overflow calls on your current number, handle prices, walk-ins, reschedules, and Vietnamese callers.',
  path: '/nail-salon',
});

export default function NailSalonPage() {
  return <MarketingVerticalTemplate vertical="nail-salon" />;
}
