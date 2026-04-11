import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Med Spas',
  robots: { index: false, follow: true },
};

export default function MedSpaDemoPage() {
  return <MarketingVerticalDemoTemplate vertical="med-spa" />;
}
