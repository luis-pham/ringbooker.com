import Link from 'next/link';

import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'What is RingBooker?',
    a: 'RingBooker is an AI phone answering and call recovery layer for nail salons, hair salons, day spas, med spas, and beauty clinics — built for after-hours calls, peak-hour overflow, missed-call text back, and booking capture on your current number.',
  },
  {
    q: 'Can RingBooker work with my current phone number?',
    a: 'Yes. RingBooker can work through call forwarding from your current business number, so callers keep dialing the number they already know.',
  },
  {
    q: 'Do I need to replace my booking software?',
    a: 'No. RingBooker covers the phone layer and works alongside your existing booking workflow. Square Appointments is live today, with more integrations expanding.',
  },
  {
    q: 'Can it answer after-hours calls?',
    a: 'Yes. RingBooker can answer after-hours and weekend calls, capture booking intent, send SMS follow-up, and give your team a summary.',
  },
  {
    q: 'Can it handle overflow calls when my front desk is busy?',
    a: 'Yes. RingBooker is built for busy service windows when staff are with clients, already on the phone, or unable to answer quickly.',
  },
  {
    q: 'Can it text missed callers automatically?',
    a: 'Yes. Missed-call text back and smart callback workflows help recover callers who hang up, call after hours, or reach you during a busy window.',
  },
  {
    q: 'Can it handle reschedules and cancellations?',
    a: 'Yes. RingBooker can capture reschedule, cancellation, and confirmation requests based on your rules, then send the right summary or next step.',
  },
  {
    q: 'What if a caller wants to speak to a real person?',
    a: 'RingBooker can offer a callback, route the request, and send your team a call summary so the caller does not have to repeat everything.',
  },
  {
    q: "Will customers know they're talking to AI?",
    a: 'RingBooker is designed to be transparent and helpful. It can introduce itself as a virtual assistant and hand off gracefully when a human is needed.',
  },
  {
    q: 'Does it support Vietnamese-speaking nail salon owners?',
    a: 'Yes. RingBooker supports Vietnamese onboarding help and can be configured for English and Vietnamese call flows, summaries, and salon-specific scripts.',
  },
  {
    q: 'What businesses is RingBooker best for?',
    a: 'RingBooker is best for nail salons, hair salons, day spas, med spas, and beauty or aesthetic clinics — anywhere phone calls still drive bookings, reschedules, and consultation demand, and missed rings mean lost revenue.',
  },
  {
    q: 'How long does setup take?',
    a: 'The goal is a quick setup: add your services, hours, rules, and phone forwarding, then test the live call flow before using it with customers.',
  },
  {
    q: 'How does RingBooker help recover lost bookings?',
    a: 'It answers or follows up on calls that would otherwise hit voicemail or busy signals: after-hours intent, peak-hour overflow, and missed-call text back keep the conversation moving so callers are less likely to book elsewhere.',
  },
  {
    q: 'How does RingBooker help protect revenue?',
    a: 'By reducing the gap between a ringing phone and a captured booking or consult: summaries and SMS give your team actionable next steps, so high-intent callers are less likely to become silent hang-ups and lost revenue.',
  },
];

export const metadata = buildMetadata({
  title: 'Salon AI Phone Answering FAQ | Current Number, Missed Calls, After-Hours & Revenue Recovery',
  description:
    'Answers to common questions about using RingBooker with your current number, covering after-hours calls, peak-hour overflow, missed-call recovery, and salon revenue protection.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <MarketingSeoPage
      badge="FAQ"
      title="Questions Salon Owners Ask Before Replacing Voicemail"
      intro="Quick answers for nail salons, hair salons, day spas, med spas, and aesthetic clinics evaluating AI phone answering, missed-call recovery, after-hours and peak-hour overflow coverage, and how RingBooker recovers booking revenue without replacing your booking software."
      sections={[
        {
          heading: 'The short version',
          content: [
            'RingBooker is a call recovery layer for beauty businesses: it answers after-hours and overflow calls, captures booking and consultation intent, sends missed-call text back, and summarizes outcomes for your team — so missed rings are less likely to become lost revenue.',
            'You keep your current phone number, keep your existing booking workflow, and use human handoff when the caller needs something your rules say a person should handle.',
          ],
        },
      ]}
      faqs={faqs}
      customContent={
        <div className="seo-internal-links">
          <p>
            <Link href="/how-it-works">How RingBooker works</Link>
            {' · '}
            <Link href="/phone-booking-recovery/after-hours-calls">After-hours call answering</Link>
            {' · '}
            <Link href="/phone-booking-recovery/peak-hour-overflow-calls">Peak-hour overflow coverage</Link>
            {' · '}
            <Link href="/phone-booking-recovery/missed-call-recovery">Missed-call recovery</Link>
            {' · '}
            <Link href="/pricing">Pricing</Link>
            {' · '}
            <Link href="/contact">Book a demo</Link>
          </p>
        </div>
      }
    />
  );
}
