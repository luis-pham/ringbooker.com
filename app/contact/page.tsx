import { MarketingContactTemplate } from '@/components/marketing/marketing-contact';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Book a Demo — See Missed-Call & Booking Recovery on Your Line',
  description:
    'Book a RingBooker walkthrough for nail salons, hair salons, spas, med spas, and beauty clinics. See how after-hours answering, overflow coverage, and missed-call text back recover revenue on your current number.',
  path: '/contact',
});

export default function ContactPage() {
  return <MarketingContactTemplate />;
}
