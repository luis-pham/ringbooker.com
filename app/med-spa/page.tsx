import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Receptionist for Med Spa',
  description:
    'RingBooker for med spas: answer consultation calls instantly, improve conversion from inbound leads, and reduce missed-call revenue loss.',
  path: '/med-spa',
});

export default function MedSpaPage() {
  return <MarketingVerticalTemplate vertical="med-spa" />;
}
