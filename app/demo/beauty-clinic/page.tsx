import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Beauty Clinics',
  robots: { index: false, follow: true },
};

export default function BeautyClinicDemoPage() {
  return <MarketingVerticalDemoTemplate vertical="beauty-clinic" />;
}
