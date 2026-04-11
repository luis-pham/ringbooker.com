import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Med Spas | RingBooker',
  description:
    'RingBooker is the AI receptionist for med spas — captures Botox, filler, and laser consultation calls after hours, reduces no-shows on high-ticket slots, and recovers missed inbound leads before they go to competitors.',
  path: '/med-spa',
});

export default function MedSpaPage() {
  return <MarketingVerticalTemplate vertical="med-spa" />;
}
