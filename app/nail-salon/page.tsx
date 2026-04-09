import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Receptionist for Nail Salons',
  description:
    'AI phone receptionist for nail salons. Answer every call, book appointments instantly, and recover missed-call revenue with RingBooker.',
  path: '/nail-salon',
});

export default function NailSalonPage() {
  return <MarketingVerticalTemplate vertical="nail-salon" />;
}
