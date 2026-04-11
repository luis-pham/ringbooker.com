import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'What is RingBooker?',
    a: 'RingBooker is an AI phone answering service for salons, nail shops, spas, med spas, and booking-heavy local service businesses.',
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
    a: 'RingBooker is best for nail salons, hair salons, spas, med spas, beauty clinics, and other local appointment-based businesses that lose bookings to missed calls.',
  },
  {
    q: 'How long does setup take?',
    a: 'The goal is a quick setup: add your services, hours, rules, and phone forwarding, then test the live call flow before using it with customers.',
  },
];

export const metadata = buildMetadata({
  title: 'RingBooker FAQ — AI Phone Answering for Salons',
  description:
    'Answers to common questions about RingBooker: current-number forwarding, after-hours calls, missed-call recovery, booking tools, Vietnamese support, and human handoff.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <MarketingSeoPage
      badge="FAQ"
      title="RingBooker FAQ"
      intro="Quick answers for salon and spa owners evaluating AI phone answering, missed-call recovery, current-number forwarding, and booking call automation."
      sections={[
        {
          heading: 'The short version',
          content: [
            'RingBooker helps appointment-based businesses stop losing calls to voicemail. It answers after-hours and overflow calls, captures booking intent, sends SMS follow-up, and summarizes calls for your team.',
            'You can keep your current phone number, keep your existing booking workflow, and use human handoff when the caller needs something complex.',
          ],
        },
      ]}
      faqs={faqs}
    />
  );
}
