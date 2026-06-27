import { PublicDemoTemplate } from '@/components/marketing/demo/public-demo-template';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'AI Call Demo for Nail Salons | RingBooker',
  description: 'Hear How RingBooker Answers Nail Salon Calls | Demo',
  path: '/demo/nail-salon',
});

const DEFAULT_DEMO_PHONE_NAIL_SALON = '+16265013960';

export default function NailSalonDemoPage() {
  return (
    <PublicDemoTemplate
      vertical="nail-salon"
      demoPhoneE164={process.env.DEMO_PHONE_NAIL_SALON ?? DEFAULT_DEMO_PHONE_NAIL_SALON}
    />
  );
}
