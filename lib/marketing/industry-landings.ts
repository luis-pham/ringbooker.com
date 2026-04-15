import type { Metadata } from 'next';

import type { MarketingVerticalKey } from '@/components/marketing/marketing-vertical';
import { buildMetadata } from '@/lib/site';

/** URL segment after `/industries/` for marketing landing pages (not blog slugs). */
export const MARKETING_INDUSTRY_URL_SEGMENTS = ['nail-salon', 'hair-salon', 'spa', 'med-spa', 'beauty-clinic'] as const;

export type MarketingIndustryUrlSegment = (typeof MARKETING_INDUSTRY_URL_SEGMENTS)[number];

export function industryLandingPath(segment: string): string {
  const s = segment.replace(/^\/+|\/+$/g, '');
  return `/industries/${s}`;
}

export function isMarketingIndustryUrlSegment(slug: string): boolean {
  return (MARKETING_INDUSTRY_URL_SEGMENTS as readonly string[]).includes(slug);
}

export function marketingSegmentToVertical(segment: string): MarketingVerticalKey | null {
  if (!isMarketingIndustryUrlSegment(segment)) return null;
  return segment as MarketingVerticalKey;
}

const LANDING_META: Record<MarketingIndustryUrlSegment, { title: string; description: string }> = {
  'nail-salon': {
    title: 'Missed Call Recovery for Nail Salons | After-Hours, Peak-Hour & Revenue Protection',
    description:
      'RingBooker helps nail salons answer after-hours and peak-hour calls, recover missed bookings, and protect daily revenue on their current business number.',
  },
  'hair-salon': {
    title: 'AI Call Recovery for Hair Salons | Missed Calls, Reschedules & Revenue Protection',
    description:
      'RingBooker helps hair salons handle after-hours inquiries, peak-hour overflow, stylist requests, and missed booking calls without changing their current number.',
  },
  spa: {
    title: 'After-Hours Call Answering for Spas | Recover Missed Bookings and Protect Revenue',
    description:
      'RingBooker helps spas answer after-hours and overflow calls, capture package and appointment inquiries, and recover revenue from missed booking opportunities.',
  },
  'med-spa': {
    title: 'Missed Call Recovery for Med Spas | Protect High-Value Consultation Revenue',
    description:
      'RingBooker helps med spas answer after-hours and peak-hour consultation calls, recover lost leads, and protect high-value revenue on their current number.',
  },
  'beauty-clinic': {
    title: 'AI Phone Answering for Beauty Clinics | Recover Consultation Revenue and Missed Calls',
    description:
      'RingBooker helps beauty clinics handle after-hours inquiries, provider requests, and missed consultation calls while protecting revenue on their current number.',
  },
};

export function marketingIndustryLandingMetadata(segment: string): Metadata {
  const key = segment as MarketingIndustryUrlSegment;
  const m = LANDING_META[key];
  if (!m) {
    return buildMetadata({
      title: 'RingBooker',
      description: 'AI phone answering and call recovery for beauty businesses — after-hours, overflow, and missed-call coverage on your current number.',
      path: '/industries',
    });
  }
  return buildMetadata({ ...m, path: industryLandingPath(segment) });
}

export function marketingIndustryStaticSlugParams(): { slug: string }[] {
  return MARKETING_INDUSTRY_URL_SEGMENTS.map((slug) => ({ slug }));
}
