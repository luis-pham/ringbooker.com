import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'What is missed-call recovery?',
    a: 'Missed-call recovery means following up with callers who hang up, reach you after hours, or call while your team is busy, so the booking opportunity does not disappear.',
  },
  {
    q: 'Can RingBooker text missed callers?',
    a: 'Yes. RingBooker can send missed-call text back messages and help route the caller toward booking, rescheduling, or a callback.',
  },
  {
    q: 'Does missed-call recovery work for existing salon numbers?',
    a: 'Yes. RingBooker can work through forwarding from your current number, so callers do not need to learn a new contact number.',
  },
  {
    q: 'What happens when the AI cannot resolve the caller request?',
    a: 'RingBooker can collect context, offer a callback, and give your team a clean call summary so the caller does not have to repeat the full story.',
  },
];

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Missed-Call Recovery for Salons',
  serviceType: 'Salon missed-call recovery',
  provider: {
    '@type': 'Organization',
    name: 'RingBooker',
    url: 'https://ringbooker.com',
  },
  areaServed: 'United States',
  description:
    'AI missed-call recovery service for salons, nail shops, spas, and med spas with text back, callback routing, call summaries, and current-number forwarding.',
};

export const metadata = buildMetadata({
  title: 'Missed-Call Recovery for Salons and Spas',
  description:
    'Recover missed salon booking calls with AI text back, smart callback workflows, call summaries, and current-number forwarding from RingBooker.',
  path: '/missed-call-recovery',
});

export default function MissedCallRecoveryPage() {
  return (
    <MarketingSeoPage
      badge="Missed-call recovery"
      title="Recover Booking Calls That Would Have Gone Silent"
      intro="Most missed callers do not leave a useful voicemail. RingBooker helps salons and spas keep those booking opportunities alive with instant follow-up and clear next steps."
      sections={[
        {
          heading: 'The missed-call problem',
          content: [
            'A busy front desk, an in-service team, and after-hours demand all create the same problem: high-intent callers leave without booking.',
            'RingBooker helps recover those calls by answering overflow, texting missed callers, and summarizing the caller intent for the team.',
          ],
        },
        {
          heading: 'Text back before the caller disappears',
          content: [
            'When a caller hangs up or reaches you outside business hours, a fast SMS follow-up gives them a path to continue instead of starting over with another business.',
            'The flow can ask what they need, capture a preferred time, offer a callback, or point them toward a booking step based on your setup.',
          ],
        },
        {
          heading: 'Designed for real front-desk handoff',
          content: [
            'RingBooker does not need to pretend every call can be solved by AI. If the request is too complex, it captures the context and makes it easier for a human to follow up.',
            'That means fewer cold callbacks, fewer repeated explanations, and a cleaner dashboard of who needs attention.',
          ],
        },
      ]}
      faqs={faqs}
      articleJsonLd={serviceJsonLd}
    />
  );
}
