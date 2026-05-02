import Link from 'next/link';

import { MarketingSeoPage, type SeoSection } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'What is peak-hour overflow call answering?',
    a: 'Overflow coverage answers the second or third caller when your front desk is already on the phone or with a client. The goal is to stop busy signals and missed rings from turning into lost bookings during your busiest hours.',
  },
  {
    q: 'Does RingBooker replace my front desk?',
    a: 'No. RingBooker is a phone layer that picks up when your team cannot answer quickly. Your staff stays focused on in-person guests while callers still get a helpful response on your current number.',
  },
  {
    q: 'Do callers need a new phone number?',
    a: 'No. RingBooker works through forwarding from your existing business line, so clients keep calling the number they already know.',
  },
  {
    q: 'How does this connect to missed-call recovery?',
    a: 'Overflow and busy windows are a major source of silent hang-ups. Pairing overflow answering with missed-call text-back helps recover callers who still slip through during extreme spikes.',
  },
  {
    q: 'When are peak hours typically the worst for salon phone volume?',
    a: 'It varies by vertical. Nail salons see the worst overflow on Saturday mornings and weekday lunch rushes. Hair salons peak on Saturdays and pre-event days. Spas and med spas see the most pressure on weekend mornings and holiday weeks. Understanding your specific pattern is the first step toward covering it.',
  },
  {
    q: 'Is overflow answering only useful for busy salons?',
    a: 'Not necessarily. Even a smaller salon with two or three service providers can hit moments where everyone is occupied simultaneously. The overflow problem is not about size — it is about the gap between when calls arrive and when someone is free to answer them.',
  },
  {
    q: 'What happens if the overflow call is complex and the AI cannot resolve it?',
    a: 'RingBooker captures the caller context and flags the call for human follow-up. The team receives a summary of what the caller needed, so the callback is informed rather than starting from scratch.',
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
    'Overflow call answering on your current number during peak service hours — capture booking intent when the front desk is underwater.',
};

const sections: SeoSection[] = [
  {
    heading: 'Why overflow is a revenue problem, not an operational nuisance',
    paragraphs: [
      <>
        A second caller during a Saturday rush is not a nuisance call. It is usually another ready-to-book client who will hang up and call the next salon, spa, or clinic if they hear a busy signal or wait too long. That distinction matters because most owners think of overflow as a front-desk problem. It is actually a revenue problem.
      </>,
      <>
        Zenoti data shows that <strong>37% of salon and spa calls are missed, and 82% of those missed calls happen during business hours</strong> — not after closing. That means the majority of missed-call revenue loss is happening while the team is present, the business is open, and demand is actively flowing. The problem is not that the salon is closed. The problem is that everyone is occupied at the same time.
      </>,
    ],
  },
  {
    heading: 'What happens when the second caller cannot get through',
    paragraphs: [
      <>
        The mental model most owners have: the caller waits, tries again, or leaves a message. The actual behavior: <strong>the caller dials the next option immediately</strong>.
      </>,
      <>
        When someone calls a salon during peak hours and hears a busy signal, an endless ring, or a voicemail prompt, they are in the middle of a decision. They have a free slot in their schedule. They want to book something. They are not committed to your business yet — they are evaluating whether reaching you is easier than reaching someone else. At the moment voicemail picks up or the line is busy, that evaluation ends in favor of a competitor.
      </>,
      <>
        For beauty businesses where first-contact conversion matters — nail salons competing for same-day walk-ins, hair salons filling cancellation slots, spas capturing weekend bookings — every overflow call that goes unanswered is a real and immediate booking loss.
      </>,
    ],
  },
  {
    heading: 'Peak hours by salon type',
    paragraphs: [
      <>
        Overflow does not hit all beauty businesses at the same time. Understanding your specific peak windows is the first step toward protecting revenue during them.
      </>,
    ],
    subsections: [
      {
        title: 'Nail salons',
        paragraphs: [
          <>
            The heaviest overflow windows for nail salons are <strong>Saturday mornings (9am–12pm)</strong> and{' '}
            <strong>weekday lunch rushes (11:30am–1:30pm)</strong>. Walk-in traffic, same-day booking calls, and quick pricing questions pile up at exactly the moments when every technician is mid-service and no one can safely reach the phone. The same-day urgency of nail salon calls makes overflow especially costly. A caller asking about availability this afternoon is not going to wait for a callback. They will call the next place and book there.
          </>,
        ],
      },
      {
        title: 'Hair salons',
        paragraphs: [
          <>
            Hair salon overflow peaks on <strong>Saturdays and the days before major events</strong> — school years starting, holidays, wedding season. Color appointments, blowouts, and event-related services create simultaneous demand that frequently overwhelms a small front desk. Provider-specific overflow calls — clients wanting a particular stylist — are especially hard to recover after the fact. The callback has to match not just availability but stylist preference, service timing, and the client’s original urgency.
          </>,
        ],
      },
      {
        title: 'Day spas',
        paragraphs: [
          <>
            Spa overflow tends to concentrate on <strong>weekend mornings and holiday weeks</strong>. Couples massage availability, package questions, and gift booking requests all arrive at once when leisure planning peaks. Spa callers tend to have more context to share than nail salon callers. They are not asking a quick yes/no question — they want to discuss options. When overflow pushes them to voicemail, that conversation never happens, and the package sale is lost.
          </>,
        ],
      },
      {
        title: 'Med spas and beauty clinics',
        paragraphs: [
          <>
            For med spas and clinics, overflow during <strong>consultation booking windows</strong> is the most expensive loss scenario. These calls often represent the highest per-appointment revenue in the beauty category — injectable consultations, laser treatment inquiries, skin analysis appointments. A caller trying to book a consultation during a busy window who hits overflow is unlikely to leave a voicemail about a procedure they are still considering. They will find a clinic that picks up.
          </>,
        ],
      },
    ],
  },
  {
    heading: 'What overflow coverage looks like in practice',
    paragraphs: [
      <>
        Peak-hour overflow is not about replacing your front desk. It is about making sure the front desk is never the bottleneck. The typical coverage model:
      </>,
    ],
    orderedList: [
      <>
        <strong>Your team answers live calls when available</strong> — nothing changes for the calls they can reach
      </>,
      <>
        <strong>When the desk is occupied, overflow routes to RingBooker</strong> — the second caller still gets a response instead of a busy signal
      </>,
      <>
        <strong>RingBooker handles the call with your services, hours, and booking rules</strong> — pricing questions, availability checks, reschedule requests
      </>,
      <>
        <strong>Complex situations are flagged for human follow-up</strong> — with full call context so the team is not starting cold
      </>,
    ],
    trailParagraphs: [
      <>
        The caller experience: they called your salon number, they got a helpful response, they moved toward booking. They do not know — and do not need to know — that the front desk was occupied.
      </>,
    ],
  },
  {
    heading: 'Overflow is different from after-hours — both matter',
    paragraphs: [
      <>This is a distinction owners sometimes miss.</>,
      <>
        <Link href="/missed-booking-protection/after-hours-calls">After-hours answering</Link> covers demand when the salon is <strong>closed</strong> — evenings, weekends, holidays. Overflow covers demand when the salon is <strong>open but underwater</strong> — peak hours, simultaneous callers, service windows. These are different problems that require different coverage.
      </>,
      <>
        A salon that has strong after-hours answering but no overflow coverage is still losing the 82% of missed-call revenue that happens during business hours. A salon with overflow coverage but no after-hours answering is still losing the one-third of bookings that happen outside business hours. Together — overflow plus after-hours — the coverage maps the full range of when beauty businesses lose calls.{' '}
        <Link href="/missed-booking-protection/missed-call-recovery">Missed-call recovery</Link> using SMS text-back adds a third layer for callers who still slip through during extreme spikes, giving them a path to reconnect rather than a dead end.
      </>,
    ],
  },
  {
    heading: 'Same number, no booking software migration',
    paragraphs: [
      <>
        RingBooker sits on the phone layer through call forwarding. You keep your current number and keep using your existing booking workflow. That matters because beauty businesses win on convenience and continuity. Callers keep dialing the number on your Google Business Profile, your Instagram bio, and your website. Your team keeps using Square, Vagaro, Booksy, or whatever system you already have. Nothing changes for the client. Nothing changes for the team. What changes is what happens to the calls that would have previously gone unanswered.
      </>,
    ],
  },
];

export const metadata = buildMetadata({
  title: 'Peak-Hour Call Answering for Salons | Overflow Coverage | RingBooker',
  description:
    'Peak hours are when salons lose the most phone revenue. RingBooker acts as overflow coverage on your current number so peak-hour calls are less likely to become missed bookings.',
  path: '/missed-booking-protection/peak-hour-overflow-calls',
});

export default function PeakHourOverflowCallsPage() {
  return (
    <MarketingSeoPage
      shellVariant="plain"
      breadcrumb={
        <>
          <Link href="/">Home</Link>
          <span aria-hidden> / </span>
          <Link href="/missed-booking-protection">Missed booking protection</Link>
          <span aria-hidden> / </span>
          <span>Peak-hour overflow</span>
        </>
      }
      badge={null}
      title="Peak-Hour Call Answering for Salons"
      intro="Peak hours are when salons lose the most phone revenue — not because the team does not want to answer, but because everyone is already occupied. RingBooker acts as overflow coverage on your current number so peak-hour calls are less likely to become missed bookings and lost revenue."
      sections={sections}
      faqs={faqs}
      articleJsonLd={serviceJsonLd}
    />
  );
}
