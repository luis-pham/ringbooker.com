import Link from 'next/link';

import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'Can RingBooker answer calls after my salon is closed?',
    a: 'Yes. RingBooker can answer after-hours and weekend calls, capture booking intent, send SMS follow-up, and give your team a clear summary for the next business day.',
  },
  {
    q: 'Do I need a new phone number?',
    a: 'No. RingBooker can work with your current business number through call forwarding, so customers keep calling the same number they already know.',
  },
  {
    q: 'Can it handle booking changes after hours?',
    a: 'Yes. RingBooker can capture reschedule, cancellation, and confirmation requests based on your rules, then send the right summary or next step.',
  },
  {
    q: 'Does it replace my booking software?',
    a: 'No. RingBooker covers the phone-answering layer and works alongside your booking workflow, with Square Appointments live today and more integrations expanding.',
  },
];

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'After-Hours Call Answering for Salons',
  serviceType: 'After-hours salon call answering',
  provider: {
    '@type': 'Organization',
    name: 'RingBooker',
    url: 'https://ringbooker.com',
  },
  areaServed: 'United States',
  description:
    'AI phone answering for nail salons, hair salons, spas, and med spas that captures after-hours booking intent on your current number — voicemail is where revenue leaks.',
};

export const metadata = buildMetadata({
  title: 'After-Hours Call Answering for Salons | Recover Missed Bookings and Revenue',
  description:
    'RingBooker answers salon calls after hours, captures booking intent, and helps recover revenue that would otherwise go to voicemail or competitors.',
  path: '/missed-booking-protection/after-hours-calls',
});

export default function AfterHoursCallsPage() {
  return (
    <MarketingSeoPage
      badge="After-hours calls"
      title="After-Hours Calls Are Still Buying Signals"
      intro="Callers after closing are often ready to book — voicemail trains them to move on. RingBooker answers on your current number, captures intent, and follows up by SMS so after-hours rings are less likely to become missed bookings and revenue leakage."
      sections={[
        {
          heading: 'Why after-hours calls matter',
          content: [
            'A caller who reaches voicemail at night or on the weekend is often a ready-to-book customer. If they do not get a response, they may keep searching and call another salon, spa, or clinic.',
            'RingBooker answers those calls with your business rules, captures what the caller needs, and keeps the conversation moving with confirmation, callback, or SMS follow-up.',
          ],
        },
        {
          heading: 'Keep your current number',
          content: [
            'You do not need to retrain clients or print a new phone number. RingBooker can sit behind your existing business line through forwarding, so callers keep using the number on Google, Yelp, Instagram, and your website.',
            'This is especially important for local businesses where the phone number is already part of the brand and search presence.',
          ],
        },
        {
          heading: 'Built for beauty and wellness workflows',
          content: [
            'RingBooker can be configured for services, hours, providers, booking rules, reschedule handling, cancellation notes, and human handoff rules.',
            'For nail salons with Vietnamese-speaking owners, onboarding and call flow support can include English and Vietnamese context so the team understands what happened after each call.',
          ],
        },
      ]}
      faqs={faqs}
      articleJsonLd={serviceJsonLd}
      customContent={
        <div className="seo-internal-links">
          <p>
            <Link href="/missed-booking-protection/peak-hour-overflow-calls">Peak-hour overflow coverage</Link>
            {' · '}
            <Link href="/missed-booking-protection/missed-call-recovery">Missed-call recovery</Link>
            {' · '}
            <Link href="/how-it-works">How RingBooker works</Link>
            {' · '}
            <Link href="/pricing">Pricing</Link>
            {' · '}
            <Link href="/contact">Book a demo</Link>
            {' · '}
            <Link href="/industries/nail-salon">Nail salon</Link>
            {' · '}
            <Link href="/industries/hair-salon">Hair salon</Link>
            {' · '}
            <Link href="/industries/spa">Spa</Link>
            {' · '}
            <Link href="/industries/med-spa">Med spa</Link>
            {' · '}
            <Link href="/industries/beauty-clinic">Beauty clinic</Link>
          </p>
        </div>
      }
    />
  );
}
