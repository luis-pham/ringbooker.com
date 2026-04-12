import { MarketingDemoVerticalIndexTemplate } from '@/components/marketing/marketing-demo-vertical-index';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Live Demo Hub | RingBooker',
  description:
    'Try short, web-only demo calls for nail salons, hair salons, day spas, med spas, and beauty clinics. Hear booking and reschedule flows—no change to your business number.',
  path: '/demo',
});

export default function DemoPage() {
  return <MarketingDemoVerticalIndexTemplate />;
}
