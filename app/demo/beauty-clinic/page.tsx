import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Beauty Clinics | RingBooker',
  description: 'Hear How RingBooker Answers Beauty Clinic Calls | Demo',
  path: '/demo/beauty-clinic',
});

const DEFAULT_DEMO_PHONE_BEAUTY_CLINIC = '+12702031876';

export default function BeautyClinicDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="beauty-clinic"
      demoPhoneE164={process.env.DEMO_PHONE_BEAUTY_CLINIC ?? DEFAULT_DEMO_PHONE_BEAUTY_CLINIC}
    />
  );
}
