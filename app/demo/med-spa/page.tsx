import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Med Spas',
  robots: { index: false, follow: true },
};

const DEFAULT_DEMO_PHONE_MED_SPA = '+13083020242';

export default function MedSpaDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="med-spa"
      demoPhoneE164={process.env.DEMO_PHONE_MED_SPA ?? DEFAULT_DEMO_PHONE_MED_SPA}
    />
  );
}
