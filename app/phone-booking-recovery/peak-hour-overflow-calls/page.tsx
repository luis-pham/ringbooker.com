import Link from 'next/link';

import { MarketingSeoPage } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'What is peak-hour overflow call answering?',
    a: 'Overflow coverage answers the second (or third) caller when your front desk is already on the phone or with a client in the chair. The goal is to stop busy signals and missed rings from turning into lost bookings.',
  },
  {
    q: 'Does RingBooker replace my front desk?',
    a: 'No. RingBooker is a phone layer that picks up when your team cannot answer quickly. Your staff stays focused on in-person guests while callers still get a helpful response on your current number.',
  },
  {
    q: 'Do callers need a new phone number?',
    a: 'No. RingBooker works through forwarding from your existing business line, so clients keep dialing the number they already trust.',
  },
  {
    q: 'How does this connect to missed-call recovery?',
    a: 'Overflow and busy windows are a major source of silent hang-ups. Pairing overflow answering with missed-call text back helps recover callers who still slip through during extreme spikes.',
  },
];

const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Peak-Hour Overflow Call Answering for Salons',
  serviceType: 'Salon overflow call answering',
  provider: {
    '@type': 'Organization',
    name: 'RingBooker',
    url: 'https://ringbooker.com',
  },
  areaServed: 'United States',
  description:
    'AI phone answering for peak-hour and overflow calls at nail salons, hair salons, spas, and med spas — same business number, booking intent capture, and handoff to your team.',
};

export const metadata = buildMetadata({
  title: 'Peak-Hour Call Answering for Salons | Stop Overflow Calls from Becoming Lost Revenue',
  description:
    'When your front desk is busy with clients, RingBooker answers overflow calls, captures booking intent, and helps salons recover revenue lost during peak service hours.',
  path: '/phone-booking-recovery/peak-hour-overflow-calls',
});

export default function PeakHourOverflowCallsPage() {
  return (
    <MarketingSeoPage
      badge="Peak-hour overflow"
      title="Peak Hours Are When Salons Lose the Most Phone Revenue"
      intro="Technicians and stylists cannot always pick up; the second caller often gets a busy line or endless ring. RingBooker acts as overflow coverage on your current number so peak-hour calls are less likely to become missed bookings and lost revenue."
      sections={[
        {
          heading: 'Why overflow is a revenue problem',
          content: [
            'A second caller is not a nuisance call. It is usually another ready-to-book client who will hang up and dial the next salon, spa, or clinic if they hear a busy signal or wait too long.',
            'RingBooker answers overflow with your services, hours, and rules so booking intent is captured instead of lost in a missed ring.',
          ],
        },
        {
          heading: 'Same number, no booking software migration',
          content: [
            'RingBooker sits on the phone layer through forwarding. You keep your current number and keep using your existing booking workflow — Square Appointments is live today, with more integrations expanding.',
            'That matters because beauty businesses win on convenience and continuity, not on forcing clients through a new stack overnight.',
          ],
        },
        {
          heading: 'How it fits with after-hours and missed-call recovery',
          content: [
            'After-hours answering covers demand when you are closed. Overflow covers demand when you are open but underwater. Missed-call text back helps recover callers who still bounce during extreme spikes.',
            'Together they map the full ladder: missed calls → missed bookings → lost revenue — and RingBooker helps you recover bookings and protect revenue without changing your core systems.',
          ],
        },
        {
          heading: 'Related guides',
          content: [
            'Explore after-hours call answering, missed-call recovery with text back, and vertical-specific playbooks for nail salons, hair salons, spas, med spas, and beauty clinics.',
          ],
        },
      ]}
      faqs={faqs}
      articleJsonLd={serviceJsonLd}
      customContent={
        <div className="seo-internal-links">
          <p>
            <Link href="/">Home</Link>
            {' · '}
            <Link href="/phone-booking-recovery/after-hours-calls">After-hours call answering</Link>
            {' · '}
            <Link href="/phone-booking-recovery/missed-call-recovery">Missed-call recovery</Link>
            {' · '}
            <Link href="/how-it-works">How RingBooker works</Link>
            {' · '}
            <Link href="/pricing">Pricing</Link>
            {' · '}
            <Link href="/contact">Book a demo</Link>
            {' · '}
            <Link href="/industries/nail-salon">Nail salons</Link>
            {' · '}
            <Link href="/industries/hair-salon">Hair salons</Link>
            {' · '}
            <Link href="/industries/spa">Day spas</Link>
            {' · '}
            <Link href="/industries/med-spa">Med spas</Link>
            {' · '}
            <Link href="/industries/beauty-clinic">Beauty clinics</Link>
          </p>
        </div>
      }
    />
  );
}
