import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Hair Salons',
  robots: { index: false, follow: true },
};

export default function HairSalonDemoPage() {
  return <MarketingVerticalDemoTemplate vertical="hair-salon" />;
}
