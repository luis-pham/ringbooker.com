import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Med Spas & Clinics',
  description:
    'AI phone answering for med spas: capture consultation calls, route Botox, filler, and laser inquiries, reduce no-shows, and keep your current number.',
  path: '/med-spa',
});

export default function MedSpaPage() {
  return <MarketingVerticalTemplate vertical="med-spa" />;
}
