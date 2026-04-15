import Link from 'next/link';

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
  title: 'Missed Call Recovery for Salons & Spas | Turn Lost Calls into Recovered Revenue',
  description:
    'RingBooker helps salons and spas turn missed calls into recovered bookings with AI phone answering, missed-call text back, and fast callback workflows.',
  path: '/missed-call-recovery',
});

export default function MissedCallRecoveryPage() {
  return (
    <MarketingSeoPage
      badge="Missed-call recovery"
      title="Every Missed Call Is a Revenue Leak"
      intro="Most missed callers never leave voicemail — speed matters before they dial a competitor. RingBooker uses missed-call text back, callback paths, and summaries so booking intent is recovered on your current number, not lost in a silent hang-up."
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
      customContent={
        <div className="seo-internal-links">
          <p>
            <Link href="/peak-hour-overflow-calls">Peak-hour overflow coverage</Link>
            {' · '}
            <Link href="/after-hours-calls">After-hours call answering</Link>
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
