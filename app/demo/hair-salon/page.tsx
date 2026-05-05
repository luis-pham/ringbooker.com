import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Hair Salons | RingBooker',
  description: 'Hear How RingBooker Answers Hair Salon Calls | Demo',
  path: '/demo/hair-salon',
});

const DEFAULT_DEMO_PHONE_HAIR_SALON = '+16286820026';

export default function HairSalonDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="hair-salon"
      demoPhoneE164={process.env.DEMO_PHONE_HAIR_SALON ?? DEFAULT_DEMO_PHONE_HAIR_SALON}
    />
  );
}
