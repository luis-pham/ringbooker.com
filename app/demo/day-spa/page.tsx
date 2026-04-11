import { MarketingVerticalDemoTemplate } from '@/components/marketing/marketing-vertical-demo';

export const metadata = {
  title: 'AI Call Demo for Day Spas',
  robots: { index: false, follow: true },
};

export default function DaySpaDemoPage() {
  return <MarketingVerticalDemoTemplate vertical="day-spa" />;
}
