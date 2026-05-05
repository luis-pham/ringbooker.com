import { MarketingContactTemplate } from '@/components/marketing/marketing-contact';
import { buildMetadata } from '@/lib/site';

export const metadata = buildMetadata({
  title: 'Book a Demo — Recover Missed Bookings | RingBooker',
  description:
    'Book a RingBooker demo to see how after-hours answering, peak-hour overflow coverage, and missed-call recovery can protect revenue for your salon, spa, or clinic.',
  path: '/contact',
});

export default function ContactPage() {
  return <MarketingContactTemplate />;
}
