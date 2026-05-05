import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Med Spas',
  description:
    'Hear how RingBooker handles Botox consultation inquiries and after-hours calls for med spas. Pre-clinical intake only. Try the live demo.',
  path: '/demo/med-spa',
});

const DEFAULT_DEMO_PHONE_MED_SPA = '+13083020242';

export default function MedSpaDemoPage() {
  return (
    <MarketingVerticalDemoTemplate
      vertical="med-spa"
      demoPhoneE164={process.env.DEMO_PHONE_MED_SPA ?? DEFAULT_DEMO_PHONE_MED_SPA}
    />
  );
}
