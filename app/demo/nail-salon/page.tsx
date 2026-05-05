import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Nail Salons',
  description:
    'Hear how RingBooker answers nail salon calls in English and Vietnamese — pricing, availability, and after-hours booking. No setup required.',
  path: '/demo/nail-salon',
});

const DEFAULT_DEMO_PHONE_NAIL_SALON = '+16265013960';

export default function NailSalonDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="nail-salon"
      demoPhoneE164={process.env.DEMO_PHONE_NAIL_SALON ?? DEFAULT_DEMO_PHONE_NAIL_SALON}
    />
  );
}
