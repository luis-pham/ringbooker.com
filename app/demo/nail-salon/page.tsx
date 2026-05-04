import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Nail Salons',
  robots: { index: false, follow: true },
};

const DEFAULT_DEMO_PHONE_NAIL_SALON = '+16265013960';

export default function NailSalonDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="nail-salon"
      demoPhoneE164={process.env.DEMO_PHONE_NAIL_SALON ?? DEFAULT_DEMO_PHONE_NAIL_SALON}
    />
  );
}
