import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Nail Salons',
  robots: { index: false, follow: true },
};

export default function NailSalonDemoPage() {
  return <MarketingVerticalDemoTemplate vertical="nail-salon" />;
}
