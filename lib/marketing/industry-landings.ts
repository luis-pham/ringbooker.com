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
    title: 'AI Phone Answering for Nail Salons | English & Vietnamese Call Coverage | RingBooker',
    description:
      'RingBooker helps nail salons answer English and Vietnamese calls, handle peak-hour overflow, and protect missed bookings on the current business number.',
  },
  'hair-salon': {
    title: 'AI Phone Answering for Hair Salons | RingBooker',
    description:
      'RingBooker helps hair salons handle after-hours inquiries, peak-hour overflow, stylist requests, and missed booking calls without changing their current number.',
  },
  spa: {
    title: 'AI Phone Answering for Spas | RingBooker',
    description:
      'RingBooker helps spas answer after-hours and overflow calls, capture package and appointment inquiries, and recover revenue from missed booking opportunities.',
  },
  'med-spa': {
    title: 'AI Phone Answering for Med Spas | After-Hours Consultation Calls | RingBooker',
    description:
      'RingBooker helps med spas capture after-hours consultation calls, handle front-desk overflow during treatment hours, and protect high-intent demand on the current number.',
  },
  'beauty-clinic': {
    title: 'Beauty Clinic AI Phone Answering | Aesthetic Clinic Missed Call Coverage | RingBooker',
    description:
      'RingBooker helps beauty and aesthetic clinics capture consultation calls, handle after-hours missed-call coverage on the current number, and deliver a more professional caller experience.',
  },
};

export function marketingIndustryLandingMetadata(segment: string): Metadata {
  const key = segment as MarketingIndustryUrlSegment;
  const m = LANDING_META[key];
  if (!m) {
    return buildMetadata({
      title: 'Industry solutions | RingBooker',
      description: 'AI phone answering and call recovery for beauty businesses — after-hours, overflow, and missed-call coverage on your current number.',
      path: '/industries',
    });
  }
  return buildMetadata({ ...m, path: industryLandingPath(segment) });
}

export function marketingIndustryStaticSlugParams(): { slug: string }[] {
  return MARKETING_INDUSTRY_URL_SEGMENTS.map((slug) => ({ slug }));
}
