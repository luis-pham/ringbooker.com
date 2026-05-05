import { MarketingDemoVerticalIndexTemplate } from '@/components/marketing/marketing-demo-vertical-index';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Live Demo Hub | RingBooker',
  description: 'Hear How RingBooker Answers Salon Calls | Live Demo',
  path: '/demo',
});

export default function DemoPage() {
  return <MarketingDemoVerticalIndexTemplate />;
}
