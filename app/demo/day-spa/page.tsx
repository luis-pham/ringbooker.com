import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Day Spas | RingBooker',
  description: 'Hear How RingBooker Answers Day Spa Calls | Demo',
  path: '/demo/day-spa',
});

const DEFAULT_DEMO_PHONE_DAY_SPA = '+16282025809';

export default function DaySpaDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="day-spa"
      demoPhoneE164={process.env.DEMO_PHONE_DAY_SPA ?? DEFAULT_DEMO_PHONE_DAY_SPA}
    />
  );
}
