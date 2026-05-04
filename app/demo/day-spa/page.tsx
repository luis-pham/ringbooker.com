import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Day Spas',
  robots: { index: false, follow: true },
};

const DEFAULT_DEMO_PHONE_DAY_SPA = '+16282025809';

export default function DaySpaDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="day-spa"
      demoPhoneE164={process.env.DEMO_PHONE_DAY_SPA ?? DEFAULT_DEMO_PHONE_DAY_SPA}
    />
  );
}
