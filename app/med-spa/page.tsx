import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Med Spas',
  description:
    'RingBooker for med spas: answer consultation calls instantly, recover after-hours and overflow callers, improve inbound conversion, and reduce missed-call loss.',
  path: '/med-spa',
});

export default function MedSpaPage() {
  return <MarketingVerticalTemplate vertical="med-spa" />;
}
