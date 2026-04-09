import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Agent for Beauty and Aesthetic Clinics',
  description:
    'AI phone agent for beauty and aesthetic clinics. RingBooker answers consultation calls, captures intent, and supports faster booking workflows.',
  path: '/beauty-clinic',
});

export default function BeautyClinicPage() {
  return <MarketingVerticalTemplate vertical="beauty-clinic" />;
}
