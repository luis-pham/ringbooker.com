import { MarketingDemoVerticalIndexTemplate } from '@/components/marketing/marketing-demo-vertical-index';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Live Demo Hub | RingBooker',
  description: 'Try live web demos for nail salon, hair salon, spa, med spa, and beauty clinic.',
  path: '/demo',
});

export default function DemoPage() {
  return <MarketingDemoVerticalIndexTemplate />;
}
