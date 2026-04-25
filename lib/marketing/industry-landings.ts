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
      'RingBooker answers pricing questions, walk-in availability, and Vietnamese call flows for nail salons — 37% of calls are missed during business hours — on the current number, no changes needed.',
  },
  'hair-salon': {
    title: 'AI Phone Answering for Hair Salons | RingBooker',
    description:
      'RingBooker captures preferred stylist requests, color service inquiries, and reschedule calls for hair salons — 77% of clients still prefer calling over the app — on the current number without workflow changes.',
  },
  spa: {
    title: 'AI Phone Answering for Day Spas — Couples Bookings, After Hours & Package Calls | RingBooker',
    description:
      "RingBooker answers couples massage inquiries, package questions, and after-hours spa calls on your current number — so 52% of callers don't hang up while therapists are in treatment.",
  },
  'med-spa': {
    title: 'AI Phone Answering for Med Spas | Botox, Filler & Consultation Call Coverage | RingBooker',
    description:
      'RingBooker captures Botox, filler, and aesthetic consultation calls for med spas — after hours, during treatments, on the current number. 3 missed calls/day costs $130,000+ annually.',
  },
  'beauty-clinic': {
    title: 'Beauty Clinic AI Phone Answering | Aesthetic Clinic Missed Call Coverage | RingBooker',
    description:
      "RingBooker captures consultation calls and after-hours booking intent for beauty and aesthetic clinics on the current number — so high-value callers don't hit voicemail and book elsewhere.",
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
