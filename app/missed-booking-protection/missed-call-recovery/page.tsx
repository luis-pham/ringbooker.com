import Link from 'next/link';

import { MarketingSeoPage, type SeoSection } from '@/components/marketing/marketing-seo-page';
import { buildMetadata } from '@/lib/site';

const faqs = [
  {
    q: 'What is missed-call recovery?',
    a: 'Missed-call recovery means actively following up with callers who hung up, reached voicemail, or called outside business hours — so the booking opportunity does not disappear. It is the difference between a passive voicemail system and an active response system.',
  },
  {
    q: 'Can RingBooker text missed callers?',
    a: 'Yes. RingBooker can send SMS text-back within seconds of a missed call, open a response path for the caller, and route the conversation toward booking, rescheduling, or a human follow-up.',
  },
  {
    q: 'How quickly should a salon respond to a missed call?',
    a: 'Immediately. SimpleTexting data shows 82% of consumers check texts within five minutes. A response that arrives within seconds of a missed call reaches the caller while they are still in the decision window. A response that arrives hours later often finds a caller who has already booked elsewhere.',
  },
  {
    q: 'Does missed-call recovery work with the existing salon number?',
    a: 'Yes. Recovery flows work through your current business number via call forwarding. Callers receive the follow-up SMS from the same number they originally called.',
  },
  {
    q: 'What if the caller hung up before leaving any information?',
    a: 'Text-back still works for silent hang-ups. A simple "We missed your call — how can we help?" sent immediately after a silent disconnect reaches the caller and opens a two-way conversation. Many callers respond even when they did not leave a voicemail.',
  },
  {
    q: 'What does the team see after a recovered call?',
    a: 'Every recovered call generates a summary in the dashboard — who called, what they communicated, what was resolved, and what still needs human follow-up. The team starts each day with a clear picture of which callers need attention and why.',
  },
  {
    q: 'How is this different from voicemail?',
    a: 'Voicemail is passive — it waits for the caller to leave a message and waits for the team to retrieve it. Missed-call recovery is active — it reaches the caller immediately, captures intent in real time, and routes the conversation forward. The practical difference is that recovery systems work on most callers, while voicemail works on a minority.',
  },
  {
    q: 'Does RingBooker handle all three types of missed calls?',
    a: 'Yes. After-hours calls, peak-hour overflow, and silent hang-ups are all covered. The recovery approach for each type is slightly different, but the goal is the same: keep booking intent alive instead of letting it disappear.',
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
    'Missed-call recovery with SMS text-back, callback paths, and call summaries so booking intent is recovered on your current number — not lost in a silent hang-up.',
};

const sections: SeoSection[] = [
  {
    heading: 'The missed-call problem beauty businesses underestimate',
    paragraphs: [
      <>
        A missed call feels small in the moment. The phone rang. The team was busy. Voicemail picked up. Maybe someone calls back later. But that sequence plays out very differently in real caller behavior.
      </>,
      <>
        Industry data shows that <strong>85% of callers who reach voicemail do not leave a message</strong> — and of those who do leave a message, most are never successfully reached on the callback. The typical recovery rate for voicemail-dependent missed calls is far lower than most owners assume. The result is a system that loses most of its leads silently, with no record of what was asked or who called.
      </>,
      <>
        For a beauty business where same-day bookings, reschedule requests, and new-client inquiries are the majority of incoming calls, that silent loss adds up quickly.{' '}
        <Link href="/missed-booking-protection/why-62-of-salon-calls-go-unanswered-and-the-45000-problem-youre-ignoring">
          Data shows missed calls can cost salons $45,000 or more per year
        </Link>{' '}
        when the cumulative booking loss is calculated against typical appointment values.
      </>,
    ],
  },
  {
    heading: 'Why speed is everything in missed-call recovery',
    paragraphs: [
      <>The most important variable in recovering a missed call is not what you say — it is when you respond.</>,
      <>
        SimpleTexting data shows that <strong>82% of consumers check text notifications within five minutes</strong> of receiving them, and <strong>32% check within 60 seconds</strong>. That is a narrow window. A caller who did not get through at 2pm on a Saturday is not going to stay available for a callback at 4pm. They are either with a client at a competing salon by then, or they have made other plans. The booking opportunity has moved on.
      </>,
      <>
        That is why text-back — not a callback — is usually the most effective first recovery step. An immediate SMS response reaches the caller while they are still in the decision window, gives them a path to continue the conversation, and keeps the booking intent alive instead of letting it fade. This is the critical difference between traditional missed-call handling and a real recovery system:
      </>,
    ],
    compareTable: {
      leftHead: 'Traditional approach',
      rightHead: 'Recovery approach',
      rows: [
        { left: <>Caller hits voicemail</>, right: <>Caller receives immediate SMS</> },
        { left: <>Caller decides whether to leave a message</>, right: <>Caller has an immediate response path</> },
        { left: <>Salon checks messages hours later</>, right: <>Summary already in team dashboard</> },
        { left: <>Callback attempt — often missed again</>, right: <>Two-way text conversation already underway</> },
        { left: <>Booking lost or heavily delayed</>, right: <>Booking intent recovered in minutes</> },
      ],
    },
  },
  {
    heading: 'What good missed-call recovery looks like step by step',
    paragraphs: [
      <>
        A well-configured missed-call recovery system does not just send a generic text. It starts the right conversation based on context.
      </>,
    ],
    subsections: [
      {
        title: 'Step 1 — Immediate text-back',
        paragraphs: [
          <>
            Within seconds of a missed call, the caller receives an SMS from your business number. The message acknowledges the missed call and opens a path forward — asking what they need, offering booking options, or providing a simple response prompt.
          </>,
        ],
      },
      {
        title: 'Step 2 — Intent capture',
        paragraphs: [
          <>
            The SMS exchange captures what the caller actually wanted: a booking request, a reschedule, a pricing question, or a callback. This context is preserved so the team does not have to start the conversation from scratch.
          </>,
        ],
      },
      {
        title: 'Step 3 — Routing',
        paragraphs: [
          <>
            Based on what the caller needs, the system routes the conversation: completing the booking flow if appropriate, directing to a booking link, or flagging for human follow-up with full context attached.
          </>,
        ],
      },
      {
        title: 'Step 4 — Team summary',
        paragraphs: [
          <>
            Every recovered call generates a clean summary in the dashboard — who called, what they needed, what was communicated, what still needs a response. The team opens their day knowing exactly which calls need follow-up and why.
          </>,
        ],
      },
    ],
  },
  {
    heading: 'The three types of missed calls recovery handles',
    paragraphs: [<>Not all missed calls are the same. Effective recovery treats them differently.</>],
    subsections: [
      {
        title: 'After-hours missed calls',
        paragraphs: [
          <>
            These are calls that arrived when the salon was closed. The caller wanted to book, reschedule, or ask a question at 9pm, and had no option but voicemail. Recovery for after-hours calls means reaching the caller early the next morning — before they have made alternative plans — with a message that acknowledges what they likely needed and offers a clear path to move forward.{' '}
            <Link href="/missed-booking-protection/after-hours-calls">After-hours call coverage</Link> can prevent many of these from becoming missed calls in the first place. Recovery handles the ones that still slip through.
          </>,
        ],
      },
      {
        title: 'Peak-hour overflow missed calls',
        paragraphs: [
          <>
            These are calls that arrived during business hours when the team was occupied — mid-service, checking someone out, handling a walk-in surge. The salon was open, but the call went unanswered anyway.{' '}
            <Link href="/missed-booking-protection/peak-hour-overflow-calls">Peak-hour overflow coverage</Link> reduces how often this happens. Recovery covers the gap for the calls that still fall through. Recovery for overflow calls is most urgent because the caller was attempting to reach an open business. Their expectation of a response was higher, and their tolerance for a delay is lower.
          </>,
        ],
      },
      {
        title: 'Silent hang-ups',
        paragraphs: [
          <>
            These are the hardest to recover from because there is no message, no context, and no way to know what the caller wanted. A caller who hangs up before voicemail picks up — or who reaches the voicemail prompt and simply disconnects — leaves no trail. The salon has a missed call log entry and nothing else. Text-back to silent hang-ups is the highest-leverage recovery move available. Even without knowing what the caller wanted, an immediate “Hi, we missed your call — how can we help?” opens the door. Many callers respond, and the booking conversation begins from there.
          </>,
        ],
      },
    ],
  },
  {
    heading: 'What happens when the AI cannot resolve the request',
    paragraphs: [
      <>
        Missed-call recovery does not try to replace every human conversation. Some calls are straightforward — availability checks, pricing questions, reschedule requests — and recovery handles those well. Other calls require human judgment: a complex service consultation, a client complaint, a provider-specific request that needs someone who knows the schedule intimately.
      </>,
      <>
        When the recovery system reaches the limit of what it can resolve, it does not pretend otherwise. Instead, it captures the context the caller has shared, flags the call for human follow-up, and gives your team a clean summary. The staff member who picks up the callback already knows what the caller needed, what was communicated, and what is still unresolved. That means fewer cold callbacks, fewer repeated explanations, and a much faster path to actually helping the client.
      </>,
    ],
  },
  {
    heading: 'Missed-call recovery is not the same as voicemail',
    paragraphs: [
      <>This is worth stating clearly.</>,
      <>
        Voicemail is a passive system. It records a message if the caller chooses to leave one, and then waits for someone to retrieve it. The entire recovery depends on the caller doing extra work — and on the salon creating a reliable callback process. As{' '}
        <Link href="/missed-booking-protection/why-voicemail-is-a-dead-end-for-busy-salons">the data on voicemail behavior shows</Link>, most callers choose not to leave a message. Most callbacks, when they happen, are not successful on the first attempt. The recovery rate from voicemail is structurally low.
      </>,
      <>
        Missed-call recovery is an active system. It reaches out to the caller instead of waiting. It creates an immediate two-way path instead of a one-way dead end. And it preserves context instead of losing it. The comparison is not a close one for beauty businesses where same-day decisions are common and caller patience is limited.
      </>,
    ],
  },
  {
    heading: 'Recovery works on your current number',
    paragraphs: [
      <>
        Missed-call text-back and recovery flows work through your existing business number — not a new contact path, not a secondary line. Callers receive the response from the same number they called. The conversation feels like a natural continuation, not a redirect. And your{' '}
        <Link href="/current-number/why-nap-consistency-still-matters-for-salons-in-2026">NAP consistency</Link> across Google Business Profile, Yelp, and your website stays intact.
      </>,
    ],
  },
];

export const metadata = buildMetadata({
  title: 'Missed Call Recovery for Salons & Spas | RingBooker',
  description:
    'Most missed callers never leave voicemail — and most never call back. RingBooker uses SMS text-back, callback paths, and summaries so booking intent is recovered on your current number.',
  path: '/missed-booking-protection/missed-call-recovery',
});

export default function MissedCallRecoveryPage() {
  return (
    <MarketingSeoPage
      breadcrumb={
        <>
          <Link href="/">Home</Link>
          <span aria-hidden> / </span>
          <Link href="/missed-booking-protection">Missed booking protection</Link>
          <span aria-hidden> / </span>
          <span>Missed-call recovery</span>
        </>
      }
      badge={null}
      title="Missed Call Recovery for Salons and Spas"
      intro="Most missed callers never leave voicemail — and most never call back. Missed-call recovery gives those callers a path forward before they disappear to a competitor. RingBooker uses SMS text-back, callback paths, and call summaries so booking intent is recovered on your current number, not lost in a silent hang-up."
      sections={sections}
      faqs={faqs}
      articleJsonLd={serviceJsonLd}
    />
  );
}
