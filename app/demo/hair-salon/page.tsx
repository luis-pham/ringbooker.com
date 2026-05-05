import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Hair Salons',
  description:
    'Hear how RingBooker handles preferred stylist requests, color inquiries, and reschedule calls for hair salons. Try the live demo now.',
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
