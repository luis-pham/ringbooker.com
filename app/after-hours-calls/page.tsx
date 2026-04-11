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
    'AI phone answering service that helps nail salons, hair salons, spas, and med spas answer after-hours and weekend calls on their current number.',
};

export const metadata = buildMetadata({
  title: 'After-Hours Call Answering for Salons',
  description:
    'RingBooker answers after-hours and weekend calls for salons and spas on your current number, captures booking intent, and texts callers back automatically.',
  path: '/after-hours-calls',
});

export default function AfterHoursCallsPage() {
  return (
    <MarketingSeoPage
      badge="After-hours calls"
      title="After-Hours Salon Calls Should Not Go to Voicemail"
      intro="Many booking calls happen when your team is closed, serving a client, or unable to reach the phone. RingBooker gives those callers a helpful answer on the number they already dial."
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
    />
  );
}
