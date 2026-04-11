import { MarketingVerticalTemplate } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Phone Answering for Beauty Clinics',
  description:
    'AI phone answering for beauty clinics: capture consultation calls, provider requests, pre-care questions, and after-hours inquiries on your current number.',
  path: '/beauty-clinic',
});

export default function BeautyClinicPage() {
  return <MarketingVerticalTemplate vertical="beauty-clinic" />;
}
