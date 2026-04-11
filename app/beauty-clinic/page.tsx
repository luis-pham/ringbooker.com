import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Beauty and Aesthetic Clinics | RingBooker',
  description:
    'RingBooker is the AI answering service for beauty and aesthetic clinics — handles consultation intake calls, maintains provider continuity, answers pre-care and post-care questions, and captures every inbound inquiry with a premium, clinic-appropriate experience.',
  path: '/beauty-clinic',
});

export default function BeautyClinicPage() {
  return <MarketingVerticalTemplate vertical="beauty-clinic" />;
}
