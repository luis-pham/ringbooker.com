import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering Service for Beauty and Aesthetic Clinics',
  description:
    'AI phone answering for beauty and aesthetic clinics. RingBooker answers after-hours and overflow calls, captures consultation intent, and supports faster booking workflows.',
  path: '/beauty-clinic',
});

export default function BeautyClinicPage() {
  return <MarketingVerticalTemplate vertical="beauty-clinic" />;
}
