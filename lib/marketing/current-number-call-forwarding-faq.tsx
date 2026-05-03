import Link from 'next/link';

import type { MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';

/** Inline links that read like body copy (not default bright link styling). */
export const cfBodyLink =
  'font-normal text-inherit underline decoration-slate-400/45 underline-offset-[3px] decoration-[1px] transition hover:decoration-violet-600/55 hover:text-slate-700';

export const CALL_FORWARDING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'Will customers see a different number?',
    a: (
      <p>
        No. Your public business number stays the same. RingBooker works through forwarding behind the scenes. If you are ever tempted to publish a new customer-facing number, read about{' '}
        <Link href="/current-number/dont-change-your-salon-number-the-hidden-cost-of-phone-number-migration">
          the hidden cost of phone number migration
        </Link>
        .
      </p>
    ),
  },
  {
    q: 'Should I forward all calls or only missed calls?',
    a: (
      <p>
        Most teams start with missed, busy, or after-hours forwarding so staff can still answer normal calls first. For a concrete walkthrough, see{' '}
        <Link href="/current-number/how-to-set-up-call-forwarding-for-a-nail-salon">how to set up call forwarding for a nail salon</Link>.
      </p>
    ),
  },
  {
    q: 'Can I use RingBooker after hours only?',
    a: (
      <p>
        Yes. Most providers support time-based routing so RingBooker handles off-hours calls only. For how that fits with AI coverage, read{' '}
        <Link href="/current-number/can-you-forward-salon-calls-to-ai">forwarding salon calls to an AI receptionist</Link>.
      </p>
    ),
  },
  {
    q: 'Can I turn call forwarding off?',
    a: (
      <p>
        Yes. Disable forwarding in your provider settings or deactivation flow, then verify with one test call. You can keep your booking system unchanged; see{' '}
        <Link href="/current-number/how-to-add-an-ai-phone-assistant-without-changing-your-booking-system">
          how to add an AI phone assistant without changing your booking system
        </Link>
        .
      </p>
    ),
  },
  {
    q: 'What if my provider is not listed?',
    a: 'Many systems still support call forwarding. RingBooker can help your team test setup before go-live.',
  },
  {
    q: 'Will this affect my Google Business Profile number?',
    a: (
      <p>
        No listing change is required when you keep your published number and only add forwarding. For GBP-specific implications when the public number changes, see{' '}
        <Link href="/current-number/what-happens-to-google-business-profile-if-you-change-your-salon-number">
          what happens to Google Business Profile if you change your salon number
        </Link>
        .
      </p>
    ),
  },
  {
    q: 'Are RingBooker and these phone providers affiliated?',
    a: 'No. Provider names and logos are used for identification only. RingBooker is not affiliated with or endorsed by these providers unless stated otherwise.',
  },
];
