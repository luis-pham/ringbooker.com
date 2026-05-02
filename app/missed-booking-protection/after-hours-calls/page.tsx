import Link from 'next/link';

import { MarketingSeoPage, type SeoSection } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'Can RingBooker answer calls after my salon is closed?',
    a: 'Yes. RingBooker can answer after-hours and weekend calls, capture booking intent, send SMS follow-up, and give your team a clear summary for the next business day.',
  },
  {
    q: 'Do I need a new phone number?',
    a: 'No. RingBooker works with your current business number through call forwarding, so clients keep calling the same number they already know and trust.',
  },
  {
    q: 'Can it handle booking changes after hours?',
    a: 'Yes. RingBooker can capture reschedule, cancellation, and confirmation requests based on your rules, then send the right summary or next step to your team.',
  },
  {
    q: 'Does it replace my booking software?',
    a: 'No. RingBooker covers the phone-answering layer and works alongside your booking workflow. Square Appointments integration is live today, with more integrations expanding.',
  },
  {
    q: 'What if a caller wants to speak to a real person?',
    a: 'RingBooker can be configured with a human handoff path — either routing to a staff member if available or capturing context and flagging the call for a priority callback. Every after-hours call that needs human follow-up gets a clean summary so the team is not starting the conversation cold.',
  },
  {
    q: 'How does after-hours answering affect local SEO?',
    a: 'Keeping after-hours coverage on your current number — without adding a second number or changing your listed contact — protects your NAP consistency across Google Business Profile, Yelp, directories, and your website. That consistency is a local SEO signal that affects how your business appears in local search results.',
  },
  {
    q: 'Which salon types benefit most from after-hours answering?',
    a: 'All beauty verticals benefit, but the pattern differs. Nail salons see the most after-hours volume in the 7–10pm weekday window. Hair salons peak on Sunday evenings. Spas and med spas see consistent after-hours inquiry volume from clients who have time to research and plan personal appointments outside of work hours.',
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

const sections: SeoSection[] = [
  {
    heading: 'Why after-hours calls matter more than most owners think',
    paragraphs: [
      <>
        A caller who reaches voicemail at night or on a weekend is not a low-priority contact. They are often a ready-to-book client who finally had a moment to call — after work, after dinner, on a Sunday when they are planning their week. That timing is deliberate. They chose to call your business specifically.
      </>,
      <>
        If voicemail picks up, that intent does not hold. Phorest data shows that{' '}
        <strong>one-third of salon appointment bookings are made outside business hours</strong>. That is not a niche behavior. It is a consistent, recurring pattern across the industry — clients book when they have time, not when the business is staffed. Those gaps are where{' '}
        <Link href="/missed-booking-protection">missed bookings</Link> pile up after closing when coverage stops at the voicemail prompt.
      </>,
      <>
        For a salon that closes at 7pm and opens at 9am, that is a 14-hour window where booking intent arrives with no one to capture it.
      </>,
    ],
  },
  {
    heading: 'What happens to after-hours callers without coverage',
    paragraphs: [
      <>Most owners assume the caller will try again in the morning. The data does not support that assumption.</>,
      <>
        <strong>85% of callers who reach voicemail do not call back.</strong> The intent that arrived at 9pm is not reliably preserved until 9am the next day. By then, the caller has moved on — found another option, used an online booking tool, or simply forgotten the specific urgency that drove them to call.
      </>,
      <>The sequence looks like this:</>,
    ],
    orderedList: [
      <>Caller reaches voicemail after hours</>,
      <>Caller decides whether the wait is worth it</>,
      <>Most callers decide it is not — they call a competitor, try an online booking tool, or give up</>,
      <>The salon opens the next morning with no record that the call ever happened</>,
      <>The booking opportunity disappears without the team ever knowing it existed</>,
    ],
    trailParagraphs: [
      <>
        That invisible loss is the real cost of after-hours voicemail — and part of{' '}
        <Link href="/missed-booking-protection/why-voicemail-is-a-dead-end-for-busy-salons">
          voicemail is a dead end for busy salons
        </Link>
        . It does not show up in any report. The team never sees a missed call that converted elsewhere. The slot that could have been filled remains empty, and no one knows why.
      </>,
    ],
  },
  {
    heading: 'After-hours call patterns by salon type',
    paragraphs: [
      <>
        After-hours demand does not look the same across every beauty vertical. Understanding when callers arrive helps businesses decide what coverage matters most.
      </>,
    ],
    subsections: [
      {
        title: 'Nail salons',
        paragraphs: [
          <>
            <Link href="/industries/nail-salon">Nail salon after-hours calls</Link> peak in the{' '}
            <strong>evening window — 7pm to 10pm on weekdays</strong>. These are clients who worked during the day and are planning their week, making same-day or next-day booking decisions. Walk-in checks, same-day availability, and quick reschedules are the most common after-hours call types. Without coverage, these calls go to voicemail. The caller tries the next nail salon on the list. The lost booking is often never recovered.
          </>,
        ],
      },
      {
        title: 'Hair salons',
        paragraphs: [
          <>
            Hair salon after-hours volume is highest on <strong>Sunday evenings</strong>, when clients are planning their week ahead. Provider-specific requests — wanting a particular stylist, asking about color availability — stay on the phone because{' '}
            <Link href="/industries/hair-salon/why-hair-salon-clients-still-call-even-with-online-booking">
              hair salon clients still call even with online booking
            </Link>{' '}
            when they need a nuanced answer. These are calls where a vague voicemail is especially unhelpful. The caller cannot leave enough context. The salon cannot give enough of an answer. And the callback often arrives too late.
          </>,
        ],
      },
      {
        title: 'Day spas',
        paragraphs: [
          <>
            <Link href="/industries/spa/how-after-hours-booking-demand-still-matters-for-spas">Spa after-hours inquiries</Link> tend to cluster around{' '}
            <strong>lunch hours and late evenings</strong>, when clients have a brief window to handle personal planning. Package questions, couples availability, and weekend booking requests are typical — including{' '}
            <Link href="/industries/spa/how-couples-massage-inquiries-get-lost-before-they-book">couples massage inquiries</Link>{' '}
            that need context voicemail cannot capture. Because spa calls often carry more context — the client wants to describe what they are looking for before booking — voicemail handles them especially poorly. A caller trying to ask about a couples massage package for next Saturday is not going to leave all of that in a voicemail.
          </>,
        ],
      },
      {
        title: 'Med spas and beauty clinics',
        paragraphs: [
          <>
            For med spas and beauty clinics, after-hours calls often carry the highest booking value in the entire category — including{' '}
            <Link href="/industries/med-spa/medspa-missed-call-consultation-lead-why-phone-leads-are-the-fastest-to-lose-and-the-most-valuable-to-capture">
              med spa missed consultation calls
            </Link>{' '}
            and{' '}
            <Link href="/industries/beauty-clinic/how-beauty-clinics-handle-consultation-calls-without-losing-trust">
              beauty clinic consultation calls
            </Link>
            . Consultation inquiries, treatment pricing questions, and new client intake calls happen after hours because clients want privacy and time to think. These callers are also the least likely to leave a voicemail. The subject matter — aesthetic treatments, procedures, pricing — feels personal. A caller asking about injectables or laser treatments is not going to describe that on an answering machine. Missing these calls is expensive in two ways: the immediate lost consultation value, and the long-term lost client relationship if the caller books elsewhere.
          </>,
        ],
      },
    ],
  },
  {
    heading: 'Keep your current number',
    paragraphs: [
      <>
        When you <Link href="/current-number">keep your current number</Link>, you do not need to retrain clients or print a new line.
      </>,
      <>
        RingBooker can sit behind your existing business line through{' '}
        <Link href="/current-number/call-forwarding">call forwarding</Link>, so callers keep using the number on Google, Yelp, Instagram, and your website. The after-hours coverage happens on the same number clients already know. This ties into{' '}
        <Link href="/current-number/why-nap-consistency-still-matters-for-salons-in-2026">
          why NAP consistency still matters for salons
        </Link>{' '}
        across listings — changing or adding a second phone number creates inconsistency that can affect how Google surfaces your business in local search. Keeping the same number avoids that problem entirely.
      </>,
    ],
  },
  {
    heading: 'Built for beauty and wellness workflows',
    paragraphs: [
      <>
        Generic after-hours answering does not work well for beauty businesses. A caller asking about gel nail pricing, couples massage availability, or same-week hair color appointments is not asking a generic question. They are asking something specific that requires your services, your pricing, your stylist availability, and your booking rules.
      </>,
      <>RingBooker can be configured for:</>,
    ],
    bulletList: [
      <>specific services and pricing at your location</>,
      <>provider and stylist availability rules</>,
      <>reschedule and cancellation handling</>,
      <>booking confirmation and summary workflows</>,
      <>human handoff rules when a caller needs a person</>,
      <>SMS follow-up to keep the conversation moving after the call</>,
    ],
    trailParagraphs: [
      <>
        For nail salons with Vietnamese-speaking owners and staff, onboarding and call flow support can include English and Vietnamese context so the team understands what happened after every call.
      </>,
    ],
  },
  {
    heading: 'How after-hours coverage connects to the full missed-booking system',
    paragraphs: [
      <>After-hours answering is one part of a complete missed-booking protection approach.</>,
      <>
        <Link href="/missed-booking-protection/peak-hour-overflow-calls">Peak-hour overflow coverage</Link> handles the calls that are missed during business hours — when the team is with clients, checking someone out, or managing walk-ins.{' '}
        <Link href="/missed-booking-protection/missed-call-recovery">Missed-call recovery</Link> uses SMS follow-up to reach callers who still slip through during extreme spikes.
      </>,
      <>Together, these three layers map the full range of where beauty businesses lose booking revenue by phone:</>,
    ],
    bulletList: [
      <>
        <strong>Closed hours</strong> → after-hours answering
      </>,
      <>
        <strong>Open but busy</strong> → peak-hour overflow
      </>,
      <>
        <strong>Still missed</strong> → missed-call text-back recovery
      </>,
    ],
  },
];

export const metadata = buildMetadata({
  title: 'After-Hours Call Answering for Salons | Missed Booking Protection | RingBooker',
  description:
    'Callers after closing are often ready to book — voicemail trains them to move on. RingBooker answers on your current number, captures intent, and follows up by SMS.',
  path: '/missed-booking-protection/after-hours-calls',
});

export default function AfterHoursCallsPage() {
  return (
    <MarketingSeoPage
      shellVariant="plain"
      breadcrumb={
        <>
          <Link href="/">Home</Link>
          <span aria-hidden> / </span>
          <Link href="/missed-booking-protection">Missed booking protection</Link>
          <span aria-hidden> / </span>
          <span>After-hours calls</span>
        </>
      }
      badge={null}
      title="After-Hours Call Answering for Salons"
      intro="Callers after closing are often ready to book — voicemail trains them to move on. RingBooker answers on your current number, captures intent, and follows up by SMS so after-hours rings are less likely to become missed bookings and revenue leakage."
      sections={sections}
      faqs={faqs}
      articleJsonLd={serviceJsonLd}
    />
  );
}
