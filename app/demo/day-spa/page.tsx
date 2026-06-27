import { PublicDemoTemplate } from '@/components/marketing/demo/public-demo-template';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Day Spas | RingBooker',
  description: 'Hear How RingBooker Answers Day Spa Calls | Demo',
  path: '/demo/day-spa',
});

const DEFAULT_DEMO_PHONE_DAY_SPA = '+16282025809';

export default function DaySpaDemoPage() {
  return (
    <PublicDemoTemplate
      vertical="day-spa"
      demoPhoneE164={process.env.DEMO_PHONE_DAY_SPA ?? DEFAULT_DEMO_PHONE_DAY_SPA}
    />
  );
}
