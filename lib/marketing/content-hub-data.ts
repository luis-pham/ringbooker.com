import { createElement, Fragment, type ReactNode } from 'react';

import type {
  ContentHubBlock,
  ContentHubFaq,
  ContentHubIndustryCard,
  ContentHubResourceLink,
  ContentHubSection,
  ContentHubVariant,
} from '@/components/marketing/marketing-content-hub';

export type ContentHubPageConfig = {
  variant: ContentHubVariant;
  badge: string;
  /** Match static HTML hero `<h1>` (line breaks + optional `<mark>`). */
  title: ReactNode;
  intro: string;
  /** Optional: marketing-home-style hero (blobs, `hero-h` / `.hl`). */
  heroLayout?: 'hub' | 'landing';
  pills?: string[];
  sections: ContentHubSection[];
  hubBlocks?: ContentHubBlock[];
  industryHeading?: string;
  industrySub?: string;
  industryEyebrow?: string;
  industryCards?: ContentHubIndustryCard[];
  resourceHeading?: string;
  resourceSub?: string;
  resourceEyebrow?: string;
  resourceLinks?: ContentHubResourceLink[];
  faqs: ContentHubFaq[];
  faqEyebrow?: string | null;
  faqTitle?: ReactNode;
  faqAccent?: 'purple' | 'green';
  faqSectionClass?: string;
  breadcrumbLabel: string;
  cta: {
    title: string;
    subtitle: string;
    primary: { href: string; label: string };
    secondary?: { href: string; label: string };
  };
  /** Plain paragraph directly under hero intro (entity / how-it-works for citations). */
  heroEntityDefinition?: string;
};

/** Same copy as FAQ “What is missed booking protection?” — also surfaced as visible body text for entity / AI citation. */
const MISSED_BOOKING_PROTECTION_DEFINITION =
  'Missed booking protection is the practice of recapturing booking opportunities that would otherwise be lost when a beauty business cannot answer the phone — due to after-hours calls, peak-hour overflow, or staff being with clients.';

export const missedBookingProtectionHub: ContentHubPageConfig = {
  variant: 'purple',
  badge: 'Pain-Point Hub',
  heroLayout: 'landing',
  title: createElement(
    Fragment,
    null,
    'Recover Revenue Lost to ',
    createElement('span', { className: 'hl' }, 'Missed Calls'),
  ),
  intro:
    "When calls go unanswered after hours or during peak service hours, beauty businesses do not just miss calls — they lose booking revenue. Beauty businesses lose an average of $26,000–$45,000 per year to missed calls and voicemail dead ends. RingBooker's AI receptionist captures that intent before it disappears into voicemail or a competitor call.",
  pills: [
    'After-hours calls captured',
    'Peak-hour overflow handled',
    'No number change needed',
    'Protects booking revenue',
  ],
  sections: [],
  hubBlocks: [
    {
      kind: 'card_grid',
      html: { eyebrow: 'The Core Problem', cardGridStyle: 'leak', leakGridColumns: 4 },
      heading: 'What “missed booking protection” actually means',
      sub: `${MISSED_BOOKING_PROTECTION_DEFINITION} It is not just about answering calls. It is about protecting revenue that disappears when a caller hangs up or reaches voicemail.`,
      cards: [
        {
          icon: '📵',
          title: 'Missed call = lost revenue',
          body: "Many callers who don't reach you won't leave a voicemail — they call another business or try again with less urgency.",
        },
        {
          icon: '🌙',
          title: 'After-hours opportunity window',
          body: 'A significant share of beauty bookings happen outside business hours. Without coverage, those are revenue opportunities you never knew you missed.',
        },
        {
          icon: '⚡',
          title: 'Overflow during peak hours',
          body: 'Saturdays, lunch rushes, holiday weeks — when two calls arrive at once and your team is mid-service, the second caller disappears.',
        },
        {
          icon: '🔄',
          title: 'More than new bookings',
          body: 'Missed booking protection covers reschedules, cancellations, and price inquiries — any intent lost when no one picks up.',
        },
      ],
    },
    {
      kind: 'scenario_grid',
      html: { eyebrow: 'The 5 Loss Scenarios' },
      heading: 'Where beauty businesses lose bookings by phone',
      sub: 'Five situations where booking loss happens most often — and where missed booking protection makes the biggest difference.',
      items: [
        {
          icon: '🌙',
          title: 'After-hours calls',
          stat: '30% of bookings happen when businesses are closed (Phorest)',
          body: 'Clients call in the evening or on days you are closed. Without coverage, booking intent disappears entirely.',
          tag: 'Heaviest impact: spas, day spas, beauty clinics',
        },
        {
          icon: '📈',
          title: 'Peak-hour overflow',
          stat: '82% of missed calls happen during business hours (Zenoti 2025)',
          body: 'Saturday mornings, holiday rushes — staff are all with clients and the phone rings with no one free to answer.',
          tag: 'Heaviest impact: nail salons, hair salons',
        },
        {
          icon: '🖥️',
          title: 'Front-desk overload',
          stat: '37% of all salon calls are missed (Zenoti 2025)',
          body: 'Checking someone in, running a card, and the phone rings — something gets dropped, usually the call.',
          tag: 'Heaviest impact: med spas, hair salons',
        },
        {
          icon: '⏳',
          title: 'Missed callback windows',
          stat: '69% of callers who reach voicemail do not leave a message (Moneypenny)',
          body: 'Voicemail leads to a callback hours later — often after the client has cooled off, tried online booking again, or called another provider.',
          tag: 'Heaviest impact: all verticals',
        },
        {
          icon: '📭',
          title: 'Voicemail dead ends',
          stat: '$45,000 average annual loss to missed calls (Etisia 2026)',
          body: 'Many callers do not leave messages. The booking intent evaporates before your team can recover it.',
          tag: 'Heaviest impact: nail salons, day spas',
        },
      ],
    },
    {
      kind: 'intent_stats',
      html: { eyebrow: 'What Callers Want' },
      heading: 'Common caller intents that get lost',
      sub: 'It is not only new bookings at risk. Every intent below is a relationship — and revenue — lost when no one picks up. The stats row cites third-party research on caller and salon behavior.',
      intents: [
        { emoji: '📅', label: 'New appointment booking' },
        { emoji: '🔄', label: 'Reschedule request' },
        { emoji: '❌', label: 'Cancellation call' },
        { emoji: '❓', label: 'Service question' },
        { emoji: '💰', label: 'Price & availability inquiry' },
        { emoji: '💆', label: 'Treatment inquiry' },
        { emoji: '👤', label: 'Provider preference' },
        { emoji: '📞', label: 'Follow-up call' },
      ],
      stats: [
        {
          value: '80%',
          label: 'of callers who reach voicemail hang up without leaving a message (Ambs Call Center 2025)',
        },
        {
          value: '77%',
          label: 'of salon clients prefer calling to reschedule (Zenoti 2025)',
        },
        {
          value: '37%',
          label: 'of all salon calls are missed — 82% during business hours (Zenoti 2025)',
        },
      ],
    },
    {
      kind: 'compare_strip',
      html: {
        eyebrow: 'The Gap in Existing Solutions',
        eyebrowTone: 'dark',
        compareStripGridCols4: true,
      },
      heading: 'Why missed-call handling alone is not enough',
      sub: 'Voicemail, text-back tools, and generic answering services each address part of the problem. None fully solve missed booking protection.',
      cards: [
        {
          icon: '📼',
          title: 'Voicemail',
          body: 'Most callers will not leave one. Those who do still need a manual callback — intent is deferred and often lost.',
        },
        {
          icon: '📱',
          title: 'Text-back only',
          body: 'Helpful, but text-back cannot complete a booking conversation or answer service questions. It keeps the lead warm — it does not close it.',
        },
        {
          icon: '📋',
          title: 'Generic answering service',
          body: 'May answer calls but typically does not understand beauty workflows, peak patterns, or service-specific questions.',
        },
        {
          icon: '🤖',
          title: 'AI receptionist',
          body: 'Answers like a trained front desk, understands beauty workflows, captures booking intent, and escalates when a person is needed.',
        },
      ],
      footerLink: { href: '/compare', label: 'Compare all alternatives →' },
    },
    {
      kind: 'feature_scenarios',
      html: { eyebrow: 'The RingBooker Approach', scenarioGrid2x2: true },
      heading: 'How RingBooker fits into missed booking protection',
      sub: 'RingBooker sits alongside your operations — not replacing them. It handles calls your team cannot reach so intent is not lost.',
      items: [
        {
          icon: '☎️',
          title: 'Keeps your current number',
          body: 'No number change required. Clients keep calling the same line they already know.',
          link: { href: '/current-number', label: 'Learn more →' },
        },
        {
          icon: '🌙',
          title: 'After-hours call capture',
          body: 'Answers when the salon is closed, captures booking intent, and routes a summary to your team for next-day action.',
        },
        {
          icon: '⚡',
          title: 'Overflow during busy hours',
          body: 'When staff are with clients, RingBooker handles the overflow instead of sending callers to voicemail.',
        },
        {
          icon: '🔌',
          title: 'Works with your booking tools',
          body: 'Square Appointments is live today. Other tools can start with workflow-compatible summaries and handoff while deeper integrations expand.',
          link: { href: '/works-with', label: 'See compatibility →' },
        },
      ],
    },
  ],
  industryEyebrow: 'Explore by Industry',
  industryHeading: 'Missed booking protection by business type',
  industrySub:
    'Each beauty vertical has its own call patterns, peak times, and booking loss scenarios. See how missed booking protection applies to your specific business.',
  industryCards: [
    {
      emoji: '💅',
      title: 'Nail salon',
      body: 'Peak-hour overflow and walk-in booking calls during service hours.',
      href: '/industries/nail-salon',
    },
    {
      emoji: '✂️',
      title: 'Hair salon',
      body: 'Schedule changes and calls during active color and cut services.',
      href: '/industries/hair-salon',
    },
    {
      emoji: '🧖',
      title: 'Day spa',
      body: 'After-hours inquiries and couples or package booking calls.',
      href: '/industries/spa',
    },
    {
      emoji: '💉',
      title: 'Med spa',
      body: 'Consultation-sensitive calls with high-ticket booking intent.',
      href: '/industries/med-spa',
    },
    {
      emoji: '✨',
      title: 'Beauty clinic',
      body: 'Trust-sensitive inquiries and provider preference context.',
      href: '/industries/beauty-clinic',
    },
  ],
  /** Resource section headings — links built in `app/missed-booking-protection/page.tsx`: three static solution pages first, then CMS posts (`pathPrefix` `missed-booking-protection`). */
  resourceEyebrow: 'In this hub',
  resourceHeading: 'Explore missed booking protection articles',
  resourceSub:
    'Browse articles on missed calls, after-hours calls, peak-hour overflow, and missed booking protection for beauty businesses.',
  faqs: [
    {
      q: 'What is missed booking protection?',
      a: MISSED_BOOKING_PROTECTION_DEFINITION,
    },
    {
      q: 'Is missed booking protection only for missed calls?',
      a: 'No. It covers all situations where a caller’s intent is not captured: after-hours calls, overflow when staff are busy, voicemail dead ends, and callers who hang up before leaving a message.',
    },
    {
      q: 'Does missed booking protection help after-hours calls?',
      a: 'Yes. After-hours coverage is one of the most impactful use cases. RingBooker captures booking intent when the salon is closed and routes the information to your team for follow-up.',
    },
    {
      q: 'Can missed booking protection work alongside existing staff?',
      a: 'Yes. RingBooker is designed to complement your team, not replace it. It handles the calls your staff cannot reach — not the calls they are already managing well.',
    },
    {
      q: 'Is missed booking protection different for nail salons vs. med spas?',
      a: 'Yes. Nail salons often lose bookings during peak-hour overload; med spas are more vulnerable to after-hours consultation inquiries. Each vertical has its own call pattern and approach to missed booking protection.',
    },
  ],
  breadcrumbLabel: 'Missed booking protection',
  cta: {
    title: 'Ready to recover bookings you are losing today?',
    subtitle: 'See how RingBooker handles after-hours, overflow, and missed-call follow-up for your beauty business.',
    primary: { href: '/demo', label: 'Try a live demo call' },
    secondary: { href: '/contact', label: 'Book a walkthrough' },
  },
};

const CURRENT_NUMBER_FAQ_FORWARDING: ContentHubFaq = {
  q: 'Can you forward salon calls to AI?',
  a: 'Yes. RingBooker works through call forwarding, so your current salon number stays public while AI covers selected calls.',
};

const CURRENT_NUMBER_FAQ_REPLACE_SETUP: ContentHubFaq = {
  q: 'Does this replace my current phone setup?',
  a: 'No. RingBooker sits alongside your existing phone system. Your number, staff workflow, and desk setup stay in place.',
};

export const currentNumberHub: ContentHubPageConfig = {
  variant: 'teal',
  badge: 'Objection Hub',
  heroLayout: 'landing',
  title: createElement(
    Fragment,
    null,
    'Add an AI Receptionist on Your ',
    createElement('span', { className: 'hl' }, 'Current Number'),
  ),
  intro:
    'Changing your number creates NAP inconsistency across 46+ online citations — Google Business Profile, Yelp, Apple Maps, and every directory clients use to find you. RingBooker uses conditional call forwarding: your current number stays public and unchanged. Coverage activates only when your team cannot answer — after hours, during peak overflow, or when the desk is occupied.',
  pills: [
    'No number migration needed',
    'Works via call forwarding',
    'Guided 15-minute setup',
    'Zero client disruption',
  ],
  sections: [],
  hubBlocks: [
    {
      kind: 'flow',
      html: { eyebrow: 'How It Works', eyebrowTone: 'purple' },
      heading: 'Your number stays. The coverage expands.',
      sub: 'Call forwarding means RingBooker activates only when your current setup cannot answer — after hours, during overflow, or when staff are with a client. Your public number never changes, and setup starts from a guided customer interface.',
      steps: [
        { icon: '📱', label: 'Client calls', line: 'Your existing number', badge: 'No change', badgeStyle: 'green' },
        { icon: '☎️', label: 'Your front desk', line: 'Answers if available', badge: 'Current workflow', badgeStyle: 'green' },
        {
          iconSrc: '/images/logo.jpg',
          label: 'RingBooker covers',
          line: 'After-hours & overflow',
          badge: 'AI layer',
          badgeStyle: 'purple',
        },
        { icon: '📋', label: 'Your team gets', line: 'Call summary & intent', badge: 'Full context', badgeStyle: 'green' },
      ],
    },
    {
      kind: 'card_grid',
      html: { eyebrow: 'Why It Matters', cardGridStyle: 'leak', leakGridColumns: 4 },
      heading: 'Why beauty businesses do not want a new number',
      sub: 'A phone number is tied to years of client relationships, signage, listings, and trust. Changing it creates friction — not value.',
      cards: [
        {
          icon: '👥',
          title: 'Clients already know it',
          stat: '77% of salon clients prefer calling the number they already have to reschedule (Zenoti 2025).',
          body: 'Long-term clients save it, recognize it, and trust it. Changing that number means re-educating every caller.',
        },
        {
          icon: '📍',
          title: 'It is across all your channels',
          stat: 'Inconsistent NAP can significantly reduce local search visibility (BrightLocal).',
          body: 'Google Business Profile, Yelp, Instagram, printed cards, and signage all rely on the same number. One missed update creates avoidable friction.',
        },
        {
          icon: '🔀',
          title: 'Local SEO consistency',
          stat: '62% of local businesses have inconsistent NAP data online (BrightLocal 2023).',
          body: 'When your phone number drifts across directories, local search systems may treat your listings as less consistent and less trustworthy.',
        },
        {
          icon: '🧪',
          title: 'You want to test first',
          body: 'Keeping your number lets you test AI coverage without a full reset: same line, same greeting, same client habits.',
        },
      ],
    },
    {
      kind: 'scenario_grid',
      html: { eyebrow: 'Common Questions' },
      heading: 'Real concerns owners have about numbers',
      sub: 'Common objections from salon and spa owners — and how keeping your current number addresses each one.',
      items: [
        {
          icon: '❓',
          title: 'Will my clients get confused if something changes?',
          body: 'Nothing client-facing changes. They still call the same number — AI handles overflow or after-hours instead of voicemail.',
        },
        {
          icon: '📍',
          title: 'What about my Google Business Profile listing?',
          body: 'With RingBooker, your GBP number stays unchanged — no listing edits, no re-verification risk, local SEO consistency preserved.',
        },
        {
          icon: '🪧',
          title: 'What about printed cards, flyers, and window signage?',
          body: 'No reprint needed. The number on your window and ads keeps working.',
        },
        {
          icon: '☎️',
          title: 'What if my staff still need to use the phone?',
          body: 'RingBooker is a layer on top. Staff answer the way they always do; RingBooker activates only when your team cannot reach the call in time.',
        },
        {
          icon: '🧪',
          title: 'Can I test this without fully switching?',
          body: 'Yes. Many owners start with after-hours-only or overflow while the primary flow stays unchanged.',
        },
        {
          icon: '👥',
          title: 'Will old clients still be able to reach me?',
          body: 'Yes. Long-time clients dialing a saved number still reach you — with better coverage when the desk is slammed or closed.',
        },
      ],
    },
    {
      kind: 'feature_scenarios',
      html: { featureLayout: 'use_cases', eyebrow: 'No-Reset Adoption' },
      heading: 'How RingBooker fits through call forwarding',
      sub: 'Most tools ask you to migrate or replace. RingBooker integrates where your current coverage stops.',
      items: [
        {
          icon: '🔀',
          title: 'Forwarding-based setup',
          body: 'Forward your line for after-hours and overflow — no system migration.',
        },
        {
          icon: '🧪',
          title: 'Start with one use case',
          body: 'Begin after-hours only; add overflow when you are comfortable.',
        },
        {
          icon: '👥',
          title: 'Staff still handle key calls',
          body: 'Your team keeps the calls they always have; RingBooker covers the gap.',
        },
        {
          icon: '🔌',
          title: 'Works with existing tools',
          body: 'Your booking software stays. Square can connect directly today; other tools can start with summaries and handoff.',
          link: { href: '/works-with', label: 'See compatibility →' },
        },
        {
          icon: '📋',
          title: 'Full call context for your team',
          body: 'Every AI-handled call produces a summary and intent note for follow-up.',
        },
        {
          icon: '🛡️',
          title: 'Low-risk rollout',
          body: 'Adjust what RingBooker handles without touching your public number.',
          link: { href: '/trust', label: 'Trust & reliability →' },
        },
      ],
    },
  ],
  /** Single industry section (linked cards) — avoids duplicating the same five verticals as a separate “By Business Type” grid above. */
  industryEyebrow: 'By business type',
  industryHeading: 'Same number — different call pressures by vertical',
  industrySub: 'Why continuity matters varies by vertical — explore how setup and call patterns differ.',
  industryCards: [
    { emoji: '💅', title: 'Nail salon', body: 'High weekend call volume; overflow is common.', href: '/industries/nail-salon' },
    { emoji: '✂️', title: 'Hair salon', body: 'Long services mean phones ring while stylists are on the floor.', href: '/industries/hair-salon' },
    { emoji: '🧖', title: 'Day spa', body: 'After-hours booking and package questions.', href: '/industries/spa' },
    { emoji: '💉', title: 'Med spa', body: 'Consult calls that need careful capture.', href: '/industries/med-spa' },
    { emoji: '✨', title: 'Beauty clinic', body: 'Trust-sensitive inquiries on the line you already publish.', href: '/industries/beauty-clinic' },
  ],
  /** Resource section — article list from `app/current-number/page.tsx` (pathPrefix `current-number`). */
  resourceEyebrow: 'In this hub',
  resourceHeading: 'Current number guides',
  resourceSub:
    'Explore articles about keeping your current business number, reducing rollout risk, and fitting RingBooker into your existing phone workflow.',
  faqs: [
    CURRENT_NUMBER_FAQ_FORWARDING,
    {
      q: 'How do I set up call forwarding for a nail salon?',
      a: 'Most salons start by forwarding after-hours or overflow calls first, then widen coverage once the setup is tested.',
    },
    {
      q: 'Can I start with after-hours only?',
      a: 'Yes. That is one of the cleanest ways to test RingBooker without changing your daytime phone workflow.',
    },
    CURRENT_NUMBER_FAQ_REPLACE_SETUP,
    {
      q: 'Can I keep my number and my booking tools?',
      a: 'Yes. Keeping your current number and booking tools is the default. RingBooker complements what you already use.',
    },
  ],
  breadcrumbLabel: 'Current number',
  cta: {
    title: 'Keep your number. Add coverage.',
    subtitle: 'Walk through forwarding options and a rollout plan that fits your desk.',
    primary: { href: '/demo', label: 'Try a live demo call' },
    secondary: { href: '/how-it-works', label: 'How it works' },
  },
};

export const worksWithHub: ContentHubPageConfig = {
  variant: 'beautyClinic',
  badge: 'Compatibility Hub',
  heroLayout: 'landing',
  title: createElement(
    Fragment,
    null,
    'AI Receptionist That Works With Your ',
    createElement('span', { className: 'hl' }, 'Booking Tools'),
  ),
  intro:
    'RingBooker is the phone layer that sits alongside the booking tools your team already uses. Square Appointments is live today, while Vagaro, Booksy, Mindbody, and other tools can start with workflow-compatible call capture, summaries, and handoff. The goal is simple: no forced migration and no workflow reset just to protect missed calls. 77% of salon clients still prefer calling to reschedule — even when their booking platform has a self-service option. RingBooker covers those calls without changing the platform your team already runs. (Zenoti 2025)',
  pills: [
    'No system replacement required',
    'Start with call forwarding',
    'Workflow-compatible setups',
    'Current number supported',
  ],
  sections: [],
  hubBlocks: [
    {
      kind: 'card_grid',
      html: { eyebrow: 'Clarity First', cardGridStyle: 'leak', leakGridColumns: 4 },
      heading: 'Four layers of compatibility',
      sub: 'RingBooker is designed to fit how beauty businesses already operate — phone, booking tools, front desk, and rollout pace.',
      cards: [
        {
          icon: '📞',
          title: 'Phone workflow',
          body: 'Works via call forwarding on your current number — no phone system replacement. After-hours handling, overflow coverage, and your published number stay intact.',
        },
        {
          icon: '🗓️',
          title: 'Booking tools',
          body: 'Keep your existing software to manage appointments; RingBooker complements it. Square Appointments is live, and other tools can start with workflow-compatible summaries and handoff.',
        },
        {
          icon: '👥',
          title: 'Front-desk workflow',
          body: 'Staff keep the calls they always take; RingBooker covers the gap. Your team answers as usual; AI handles overflow and after-hours with full context at handoff.',
        },
        {
          icon: '🚀',
          title: 'Phased adoption',
          body: 'Start with one use case — like after-hours only — and expand when you are ready. Start small, avoid a big-bang migration, and adjust anytime.',
        },
      ],
    },
    {
      kind: 'tool_strip',
      html: { eyebrow: 'Booking Tool Compatibility', eyebrowTone: 'blue' },
      heading: 'Tools beauty businesses already use',
      sub: 'Square Appointments can connect directly today. Other booking tools can still work with RingBooker through call capture, summaries, and handoff while deeper integrations expand.',
      tools: [
        {
          href: '/works-with/does-ringbooker-work-with-square-appointments',
          logoSrc: '/images/square.png',
          title: 'Square Appointments',
          body: 'Live integration — captured booking intent can flow into your scheduling workflow.',
          status: '✓ Live integration',
          statusKind: 'live',
        },
        {
          href: '/works-with/can-ringbooker-work-with-vagaro-without-changing-your-setup',
          logoSrc: '/images/vagaro.png',
          title: 'Vagaro',
          body: 'Workflow-compatible: capture intent and route summaries for manual booking entry.',
          status: 'Workflow compatible',
          statusKind: 'workflow',
        },
        {
          href: '/works-with/does-ringbooker-work-with-mindbody-for-spa-and-med-spa-calls',
          logoSrc: '/images/mindbody.webp',
          title: 'Mindbody',
          body: 'Common in spas and wellness — after-hours and overflow coverage alongside Mindbody workflows.',
          status: 'Coming soon',
          statusKind: 'soon',
        },
        {
          href: '/works-with/how-ringbooker-fits-beauty-businesses-using-booksy',
          logoSrc: '/images/booksy.png',
          title: 'Booksy',
          body: 'Popular with nail and hair stylists — RingBooker handles calls online booking does not capture.',
          status: 'Workflow compatible',
          statusKind: 'workflow',
        },
      ],
    },
    {
      kind: 'step_track',
      html: {
        eyebrow: 'Getting Started',
        eyebrowTone: 'green',
        section: 'leak',
        stepsCentered4: true,
      },
      heading: 'How businesses usually start',
      sub: 'Most teams adopt in stages — starting where booking loss is clearest.',
      steps: [
        {
          title: 'Forward your current number',
          body: 'Route after-hours (or overflow) to RingBooker. The desk keeps answering during business hours.',
        },
        {
          title: 'Start with after-hours or overflow',
          body: 'Pick the lowest-risk, highest-impact call types first.',
        },
        {
          title: 'Keep your booking workflow',
          body: 'Your team still uses the scheduling workflow it knows. Square can connect directly; other tools can start with summaries.',
        },
        {
          title: 'Review summaries and expand',
          body: 'When you are ready, widen coverage or tighten integration.',
        },
      ],
    },
    {
      kind: 'scenario_grid',
      html: { eyebrow: 'Common Questions' },
      heading: 'Common compatibility concerns',
      sub: 'Typical questions from owners and managers — and how RingBooker fits alongside the tools you already use.',
      items: [
        {
          icon: '🔌',
          title: 'Do I need to replace my booking software?',
          body: 'No. Square Appointments can connect directly today; other tools can stay in place while RingBooker captures calls, summaries, and handoff context.',
        },
        {
          icon: '👥',
          title: 'What if my staff still handle some calls?',
          body: 'That is the default. Staff answer during the day; RingBooker activates for overflow and after-hours.',
        },
        {
          icon: '🌙',
          title: 'What if I only want after-hours first?',
          body: 'That is the most common start — configure after-hours only, then expand.',
        },
        {
          icon: '☎️',
          title: 'Does it work with my current phone number?',
          body: 'Yes — forwarding on the line you already publish.',
        },
        {
          icon: '💅',
          title: 'Does it work the same for nail salons and med spas?',
          body: 'Compatibility applies to every vertical; call types differ — see industry pages for specifics.',
        },
        {
          icon: '🧩',
          title: 'Can I start without booking software integration?',
          body: 'Yes. Forwarding and after-hours work with zero integration — summaries go to your team.',
        },
      ],
    },
  ],
  industryHeading: 'By industry',
  industrySub: 'Tooling varies; phone behavior is where RingBooker focuses.',
  industryCards: [
    { emoji: '💅', title: 'Nail salon', body: 'High-volume booking and reschedule calls.', href: '/industries/nail-salon' },
    { emoji: '✂️', title: 'Hair salon', body: 'Stylist-specific and same-day change requests.', href: '/industries/hair-salon' },
    { emoji: '🧖', title: 'Day spa', body: 'Packages, couples, and duration questions.', href: '/industries/spa' },
    { emoji: '💉', title: 'Med spa', body: 'Consultation and treatment questions before booking.', href: '/industries/med-spa' },
    { emoji: '✨', title: 'Beauty clinic', body: 'Provider continuity and trust-sensitive calls.', href: '/industries/beauty-clinic' },
  ],
  /** Resource section — article list from `app/works-with/page.tsx` (pathPrefix `works-with`). */
  resourceEyebrow: 'In this hub',
  resourceHeading: 'Booking tool compatibility guides',
  resourceSub:
    'Explore articles on Square, Vagaro, Booksy, Mindbody, and how RingBooker fits existing beauty-business workflows.',
  faqs: [
    {
      q: 'Does RingBooker work with Square Appointments for nail salons?',
      a: 'Yes. Square Appointments is the clearest live compatibility story on this page.',
    },
    {
      q: 'What does workflow-compatible mean for Vagaro or Booksy?',
      a: 'It means RingBooker fits the call workflow and handoff process even where the page is not claiming a live direct integration.',
    },
    {
      q: 'Can salons keep their current workflow?',
      a: 'Yes. RingBooker complements the booking workflow instead of replacing it.',
    },
    {
      q: 'Do I need to replace my booking software?',
      a: 'No. RingBooker is designed to work alongside your existing workflow. Square Appointments is live today; Vagaro, Booksy, Mindbody, and others can start with summaries and handoff while deeper integrations expand.',
    },
    {
      q: 'Does this work with my current phone number?',
      a: 'Yes. RingBooker works via forwarding on your current number.',
    },
  ],
  breadcrumbLabel: 'Works with',
  cta: {
    title: 'See RingBooker alongside your stack',
    subtitle: 'No rip-and-replace — start with the phone layer and expand when you are ready.',
    primary: { href: '/demo', label: 'Try a live demo call' },
    secondary: { href: '/pricing', label: 'View pricing' },
  },
};

export const compareHub: ContentHubPageConfig = {
  variant: 'beautyClinic',
  badge: 'Decision Hub',
  heroLayout: 'landing',
  title: createElement(
    Fragment,
    null,
    'Compare RingBooker With ',
    /** No `span.hl` pill — purple accent only (see `.hub-compare-index h1 .hub-compare-hero-accent` in html-hub-scoped-css). */
    createElement('strong', { className: 'hub-compare-hero-accent' }, 'Voicemail, Hiring, and Generic AI'),
  ),
  intro:
    "The average beauty business loses $126,000 annually to missed calls. This page compares every phone coverage option — voicemail, text-back, answering services, extra staff, and generic AI — against RingBooker's beauty-specific answering for after-hours calls, peak-hour overflow, and missed booking protection, across the criteria that actually matter for salons, spas, and med spas.",
  pills: [
    'Voicemail vs. AI',
    'Answering services',
    'Front-desk hiring',
    'Generic AI tools',
  ],
  sections: [],
  hubBlocks: [
    {
      kind: 'card_grid',
      html: {
        eyebrow: 'The Landscape',
        section: 'leak',
        cardGridStyle: 'leak',
        leakGridColumns: 3,
        hubGridCols3: true,
      },
      heading: 'Voicemail, answering services, hiring, or AI?',
      sub: 'Most salons are not choosing between “AI or nothing.” They are choosing between voicemail, text-back, services, headcount, generic AI — or a beauty-specific layer.',
      cards: [
        {
          icon: '📼',
          title: 'Voicemail',
          body: 'The default fallback. Works for motivated callers — loses everyone who hangs up at the beep.',
        },
        {
          icon: '📱',
          title: 'Missed-call text-back',
          body: 'Re-engages silent callers — but cannot complete a booking or answer nuanced service questions.',
        },
        {
          icon: '☎️',
          title: 'Answering service',
          body: 'A human answers — but may not know your services, pricing, staff, or beauty workflows.',
        },
        {
          icon: '👩',
          title: 'Hire more staff',
          body: 'Full control — but expensive, does not cover after-hours the same way, and overflow still spikes.',
        },
        {
          icon: '🤖',
          title: 'Generic AI receptionist',
          body: 'Always on — but not tuned for nail vs. med spa patterns or peak-hour reality.',
        },
        {
          icon: '💜',
          title: 'RingBooker',
          body: 'Beauty-specific AI answering: after-hours and overflow, your current number, booking tools in place, team stays in control.',
        },
      ],
    },
    {
      kind: 'compare_table_matrix',
      html: { eyebrow: 'Side by Side' },
      heading: 'Quick Comparison — What Matters for Beauty Businesses',
      sub:
        "The right comparison isn't just about features. It's about which option fits the actual way beauty businesses receive and lose bookings.",
      headers: [
        'Criterion',
        'Voicemail',
        'Text-Back',
        'Answering Svc',
        'More Staff',
        'Generic AI',
        'RingBooker',
      ],
      rows: [
        {
          criterion: 'After-hours call coverage',
          cells: [
            { tone: 'partial', label: 'Partial' },
            { tone: 'partial', label: 'Partial' },
            { tone: 'check', label: 'Yes' },
            { tone: 'cross', label: 'No' },
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Peak-hour overflow handling',
          cells: [
            { tone: 'cross', label: 'No' },
            { tone: 'cross', label: 'No' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Partial' },
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Beauty-specific call fit',
          cells: [
            { tone: 'cross', label: 'No' },
            { tone: 'cross', label: 'No' },
            { tone: 'cross', label: 'No' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Partial' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Current number continuity',
          cells: [
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Works with existing booking tools',
          cells: [
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Manual' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Captures caller intent in real time',
          cells: [
            { tone: 'cross', label: 'No' },
            { tone: 'partial', label: 'Limited' },
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Human callback or handoff with context',
          cells: [
            { tone: 'cross', label: 'No' },
            { tone: 'cross', label: 'No' },
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Low operational disruption',
          cells: [
            { tone: 'check', label: 'Yes' },
            { tone: 'check', label: 'Yes' },
            { tone: 'partial', label: 'Partial' },
            { tone: 'cross', label: 'No' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'Yes' },
          ],
        },
        {
          criterion: 'Practical starting cost',
          cells: [
            { tone: 'check', label: 'Free' },
            { tone: 'check', label: 'Low' },
            { tone: 'cross', label: 'High' },
            { tone: 'cross', label: 'Very high' },
            { tone: 'partial', label: 'Varies' },
            { tone: 'check', label: 'From $79/mo' },
          ],
        },
      ],
      footnotes: [
        '* More Staff: based on BLS median receptionist wage $17.90/hr x part-time 20hr/week + payroll tax = ~$23,400/year minimum.',
        '** Generic AI: Smith.ai AI starts $95/50 calls; GoodCall $79/100 unique customers + $0.50 overage; AgentZap $109 + $399 setup + $0.85/min overage.',
      ],
    },
    {
      kind: 'alt_link_grid',
      html: { eyebrow: 'Deep Comparisons', hubGridCols3: true },
      heading: 'Compare RingBooker by Alternative',
      sub: 'Each comparison goes deeper into the specific trade-offs, use cases, and who each option is actually right for.',
      links: [
        {
          href: '/compare/ai-receptionist-vs-voicemail-for-busy-salons',
          title: 'RingBooker vs. Voicemail',
          body: 'Why voicemail fails as a booking capture tool — and what a real-time AI alternative does differently for after-hours callers.',
        },
        {
          href: '/compare/ringbooker-vs-answering-service/',
          title: 'RingBooker vs. Answering Service',
          body: 'Human agents vs. AI — where each one wins, where generic services miss beauty-specific call context, and when each makes sense.',
        },
        {
          href: '/compare/ringbooker-vs-front-desk-hiring/',
          title: 'RingBooker vs. Hiring More Staff',
          body: 'Adding headcount does not solve after-hours or overflow. Here is why the math often favors a different approach for peak coverage.',
        },
        {
          href: '/compare/ringbooker-vs-generic-ai/',
          title: 'RingBooker vs. Generic AI Receptionist',
          body: 'Not all AI answering is the same. Here is how beauty-specific training changes the caller experience vs. a general-purpose AI tool.',
        },
        {
          href: '/compare/ringbooker-vs-text-back-only/',
          title: 'RingBooker vs. Text-Back Only',
          body: 'Text-back re-engages silent callers — but it cannot complete a booking. Here is what happens in the gap between text-back and booked appointment.',
        },
        {
          href: '/compare/ringbooker-vs-goodcall/',
          title: 'RingBooker vs. GoodCall',
          body: 'Real pricing data including GoodCall’s unique customer cap and number-porting limitation for beauty teams comparing long-term fit.',
        },
        {
          href: '/compare/ringbooker-vs-bookingbee/',
          title: 'RingBooker vs. BookingBee',
          body: 'The two most directly comparable beauty-specific tools compared on pricing, Vietnamese support, and feature scope.',
        },
        {
          href: '/compare/ringbooker-vs-agentzap/',
          title: 'RingBooker vs. AgentZap',
          body: 'First-year cost breakdown: $948 for RingBooker vs. $1,707 minimum for AgentZap, with coverage and workflow trade-offs.',
        },
      ],
    },
    {
      kind: 'situation_grid',
      html: { section: 'purple-soft', eyebrow: 'Decision Guide', hubGridCols3: true },
      heading: 'Compare by Your Current Situation',
      sub: 'The right next step depends on where booking loss hurts most.',
      items: [
        {
          prefix: 'If your biggest issue is…',
          title: 'After-hours calls going to voicemail',
          body: 'Voicemail and text-back both fall short. You need something that answers and captures intent in real time.',
          cta: { href: '/missed-booking-protection', label: 'Missed booking protection hub →' },
        },
        {
          prefix: 'If your biggest issue is…',
          title: 'Front-desk overload during peak hours',
          body: 'More staff helps but does not flex the same way. Overflow coverage is often the cost-effective layer.',
          cta: { href: '/how-it-works', label: 'How it works →' },
        },
        {
          prefix: 'If your biggest issue is…',
          title: 'Not wanting to change your phone number',
          body: 'Call forwarding keeps your public number — see how setup works.',
          cta: { href: '/current-number', label: 'Current number hub →' },
        },
        {
          prefix: 'If your biggest issue is…',
          title: 'Not wanting to replace booking software',
          body: 'RingBooker sits alongside your existing tools. Square is live today; other workflows can start with summaries and handoff.',
          cta: { href: '/works-with', label: 'Compatibility hub →' },
        },
        {
          prefix: 'If your biggest issue is…',
          title: 'Reliability concerns about AI',
          body: 'Phased rollout and boundaries matter — especially for med spas and clinics.',
          cta: { href: '/trust', label: 'Trust hub →' },
        },
        {
          prefix: 'If your biggest issue is…',
          title: 'Wanting a low-risk starting point',
          body: 'Start after-hours only; keep daytime workflow; expand when you are ready.',
          cta: { href: '/demo', label: 'Try a live demo call' },
        },
      ],
    },
    {
      kind: 'compare_strip',
      html: { eyebrow: 'Industry Context', eyebrowTone: 'dark' },
      heading: 'Why beauty businesses need a different comparison lens',
      sub: 'Salons and spas are not generic local businesses. The right comparison has to be operational — not just feature-based.',
      cards: [
        {
          icon: '⏱️',
          title: 'Timing is everything',
          body: 'Saturday at 11am means stations are full — generic tools do not model that reality.',
        },
        {
          icon: '💆',
          title: 'Service questions are specific',
          body: 'Callers ask about gel vs. dip, balayage, fillers — generic AI or agents often miss nuance.',
        },
        {
          icon: '👤',
          title: 'Trust is part of the product',
          body: 'A caller who feels mishandled will not book. Comparison has to include caller experience quality.',
        },
      ],
    },
  ],
  resourceEyebrow: 'In this hub',
  resourceHeading: 'Comparison guides',
  resourceSub:
    'Explore articles that compare RingBooker with voicemail, answering services, front-desk staffing, and other ways beauty businesses handle missed calls.',
  /** Article links: loaded in `app/compare/page.tsx` from posts with `pathPrefix` `compare`. */
  faqs: [
    {
      q: 'Is salon voicemail enough if calls come in after hours?',
      a: 'Usually not. Voicemail can save some intent, but it does not answer questions or move the booking conversation forward in real time.',
    },
    {
      q: 'How does AI compare with hiring another receptionist?',
      a: 'Hiring adds coverage, but it does not solve after-hours or overflow in the same way. RingBooker is the lighter-weight layer for missed booking protection.',
    },
    {
      q: 'Is RingBooker relevant if I am comparing tools like TrueLark?',
      a: 'Yes. That comparison can appear naturally in body copy and FAQ without turning this page into a dedicated competitor page.',
    },
    {
      q: 'How is RingBooker different from an answering service?',
      a: 'Generic answering services may not understand beauty workflows or service-specific questions. RingBooker is built for salon and clinic call patterns.',
    },
    {
      q: 'Do I still need front-desk staff?',
      a: 'In most cases, yes. RingBooker handles calls your staff cannot reach — it is designed to complement your team.',
    },
  ],
  breadcrumbLabel: 'Compare',
  cta: {
    title: 'Still deciding?',
    subtitle: 'Run a live call on the demo, then compare notes with our comparison pages above.',
    primary: { href: '/demo', label: 'Try a live demo call' },
    secondary: { href: '/contact', label: 'Talk to us' },
  },
};

export const trustHub: ContentHubPageConfig = {
  variant: 'trust',
  badge: 'Trust & Reliability Hub',
  heroLayout: 'landing',
  title: createElement(
    Fragment,
    null,
    'A Reliable AI Receptionist Built Around ',
    createElement('br'),
    createElement('span', { className: 'hl' }, 'Trust for Beauty Businesses'),
  ),
  intro:
    "Trust isn't a feature — it's a requirement. 55% of salon clients and 71% of med spa clients are comfortable with AI phone handling when it's accurate and honest. Here's exactly what RingBooker does, what it doesn't, and how to start with confidence.",
  pills: [
    'Transparent expectations',
    'Human fallback control',
    'Phased adoption support',
    'No overnight overhaul',
  ],
  sections: [],
  hubBlocks: [
    {
      kind: 'card_grid',
      html: {
        eyebrow: 'What Trust Means Here',
        section: 'leak',
        cardGridStyle: 'leak',
        leakGridColumns: 4,
      },
      heading: 'Trust in the context of AI call handling',
      sub: 'For beauty businesses, trust means four specific things — none of them are AI hype.',
      cards: [
        {
          icon: '🎯',
          title: 'Consistency',
          stat: '82% of consumers abandon businesses after a poor experience (Salesforce).',
          body: 'Every after-hours caller gets a clear, consistent response.',
        },
        {
          icon: '🔍',
          title: 'Clarity',
          stat: 'Maine Chatbot Disclosure Act 2025 — AI must identify itself.',
          body: 'RingBooker identifies as a virtual assistant — transparency builds trust.',
        },
        {
          icon: '🔧',
          title: 'Practical control',
          body: 'You decide what it handles, adjust coverage, and keep full control with your team.',
        },
        {
          icon: '📐',
          title: 'Realistic scope',
          stat: '71% of med spa clients are comfortable with AI when the experience is accurate (Zenoti, 2025).',
          body: 'Built for predictable workflows, not every edge case.',
        },
      ],
    },
    {
      kind: 'feature_scenarios',
      html: {
        section: 'purple-soft',
        featureLayout: 'principles',
        eyebrow: 'How It Works in Practice',
      },
      heading: 'Reliability principles behind RingBooker',
      sub: 'Design choices — not slogans — that define behavior on every call.',
      items: [
        {
          icon: '📞',
          title: 'Answers after-hours and overflow consistently',
          body: 'When you are closed or your team is with a client, callers get a real response — not silence.',
        },
        {
          icon: '🎭',
          title: 'Transparent AI identity',
          body: 'No pretending to be a human team member — honesty supports long-term trust.',
        },
        {
          icon: '🔄',
          title: 'Fallback, then clean handoff',
          body: 'If a request is out of scope, collect context and route to your team instead of looping.',
        },
        {
          icon: '📋',
          title: 'Every call produces a summary',
          body: 'Intent notes and action items land in your dashboard — no black-box calls.',
        },
        {
          icon: '🎛️',
          title: 'Designed to be adjusted',
          body: 'Hours, services, and staff change — configuration can change with you.',
        },
      ],
    },
    {
      kind: 'split_expectations',
      html: { eyebrow: 'Honest Expectations' },
      heading: 'Transparency and realistic expectations',
      sub: 'A clear picture of what RingBooker is built for — and what your team still owns.',
      left: {
        title: '✓ What RingBooker is designed for',
        items: [
          'After-hours and overflow answering',
          'Appointment booking, reschedule, and cancellation calls',
          'Service questions and price inquiries',
          'Missed-call text-back and callback workflows',
          'Consistent handling during predictable call patterns',
        ],
      },
      right: {
        title: '→ What your team still handles',
        items: [
          'Complex medical or treatment consultations',
          'Sensitive or escalated client concerns',
          'Unusual requests outside configured workflows',
          'Calls you want staff to take personally',
          'VIP relationships that need a human touch',
        ],
      },
    },
    {
      kind: 'scenario_grid',
      html: { eyebrow: 'Common Concerns' },
      heading: 'Risk concerns business owners have',
      sub: 'Common trust questions before teams start.',
      items: [
        {
          icon: '❓',
          title: 'What if a caller asks something unusual?',
          body: 'RingBooker follows a fallback path: offer callback, collect details, route cleanly — without confusing loops.',
        },
        {
          icon: '👥',
          title: 'What if I still want staff involved?',
          body: 'That is the default — configure specific call types only; your team keeps the rest.',
        },
        {
          icon: '🧪',
          title: 'What if I want to start small?',
          body: 'After-hours only for a few weeks, then reassess. Most teams expand when quality feels right.',
        },
        {
          icon: '☎️',
          title: 'What if I need to keep my current number?',
          body: 'Your number does not change — RingBooker uses forwarding on the line you already publish.',
        },
        {
          icon: '🔌',
          title: 'What if I need it to fit existing tools?',
          body: 'Works alongside your current workflow. Square Appointments is live today; other tools can start with summaries and handoff.',
        },
        {
          icon: '💬',
          title: 'What if clients ask if they are talking to AI?',
          body: 'Designed to be transparent when relevant — most callers accept that for routine booking tasks.',
        },
      ],
    },
    {
      kind: 'step_track',
      html: {
        section: 'leak',
        stepsCentered4: true,
        eyebrow: 'Phased Adoption',
        eyebrowTone: 'green',
      },
      heading: 'What a low-risk rollout looks like',
      sub: 'You do not have to do everything at once.',
      steps: [
        {
          title: 'Week 1–2: After-hours only',
          body: 'Forward when closed. Zero daytime change. Review summaries daily.',
        },
        {
          title: 'Week 3–4: Add overflow',
          body: 'Staff answer first; RingBooker takes the second call when needed.',
        },
        {
          title: 'Month 2: Refine setup',
          body: 'Tune services, rules, and handoff triggers from real call data.',
        },
        {
          title: 'Ongoing: Expand or hold',
          body: 'Add integrations or reporting — or stay on the configuration that works.',
        },
      ],
    },
  ],
  industryHeading: 'Trust by vertical',
  industrySub: 'Different businesses worry about different risks — the rollout pattern is the same.',
  industryCards: [
    { emoji: '💅', title: 'Nail salon', body: 'Speed and clarity on busy Saturdays.', href: '/industries/nail-salon' },
    { emoji: '✂️', title: 'Hair salon', body: 'Stylist requests and changes without dropped context.', href: '/industries/hair-salon' },
    { emoji: '🧖', title: 'Day spa', body: 'Calm, accurate capture for multi-service asks.', href: '/industries/spa' },
    { emoji: '💉', title: 'Med spa', body: 'Careful boundaries on consult and treatment questions.', href: '/industries/med-spa' },
    { emoji: '✨', title: 'Beauty clinic', body: 'Trust-forward intake before human follow-up.', href: '/industries/beauty-clinic' },
  ],
  resourceEyebrow: 'In this hub',
  resourceHeading: 'Trust and reliability guides',
  resourceSub:
    'Explore articles about reliable AI call handling, human-friendly rollout, operational control, and how RingBooker helps beauty businesses adopt AI with more confidence.',
  /** Article links: loaded in `app/trust/page.tsx` from posts with `pathPrefix` `trust`. */
  faqs: [
    {
      q: 'Can AI handle salon booking calls reliably?',
      a: 'For after-hours and overflow, where the alternative is often voicemail or no answer, RingBooker is built for appointment-style workflows in beauty businesses.',
    },
    {
      q: 'Will RingBooker replace my team?',
      a: 'No. It is designed for calls your team cannot reach. Your team stays in control of the conversations they want to own.',
    },
    {
      q: 'What if I only want after-hours coverage at first?',
      a: 'That is the most common starting point — minimal disruption to daytime workflow.',
    },
    {
      q: 'Can I keep my current number?',
      a: 'Yes. RingBooker works with your existing number via forwarding.',
    },
    {
      q: 'How do I reduce rollout risk?',
      a: 'Start after-hours only, review summaries, then expand to overflow when you are satisfied with quality.',
    },
  ],
  breadcrumbLabel: 'Trust',
  cta: {
    title: 'Questions about fit and rollout?',
    subtitle: 'We will walk through scope, boundaries, and a phased plan that matches your team.',
    primary: { href: '/contact', label: 'Book a walkthrough' },
    secondary: { href: '/faq', label: 'Read the FAQ' },
  },
};
