import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Hair Salons',
  robots: { index: false, follow: true },
};

const DEFAULT_DEMO_PHONE_HAIR_SALON = '+16286820026';

export default function HairSalonDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="hair-salon"
      demoPhoneE164={process.env.DEMO_PHONE_HAIR_SALON ?? DEFAULT_DEMO_PHONE_HAIR_SALON}
    />
  );
}
