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
    title: 'AI Phone Answering for Nail Salons & Shops',
    description:
      'AI phone answering for nail salons: answer after-hours and overflow calls on your current number, handle prices, walk-ins, reschedules, and Vietnamese callers.',
  },
  'hair-salon': {
    title: 'AI Phone Answering for Hair Salons & Stylists',
    description:
      'AI phone answering for hair salons: capture overflow and after-hours calls, handle stylist requests, color bookings, reschedules, and SMS confirmations.',
  },
  spa: {
    title: 'AI Receptionist for Day Spas & Wellness',
    description:
      'AI receptionist for day spas: answer after-hours and overflow calls, handle couples massage, package questions, reschedules, and SMS confirmations.',
  },
  'med-spa': {
    title: 'AI Phone Answering for Med Spas & Clinics',
    description:
      'AI phone answering for med spas: capture consultation calls, route Botox, filler, and laser inquiries, reduce no-shows, and keep your current number.',
  },
  'beauty-clinic': {
    title: 'AI Phone Answering for Beauty Clinics',
    description:
      'AI phone answering for beauty clinics: capture consultation calls, provider requests, pre-care questions, and after-hours inquiries on your current number.',
  },
};

export function marketingIndustryLandingMetadata(segment: string): Metadata {
  const key = segment as MarketingIndustryUrlSegment;
  const m = LANDING_META[key];
  if (!m) {
    return buildMetadata({ title: 'RingBooker', description: 'AI phone answering for salons and spas.', path: '/industries' });
  }
  return buildMetadata({ ...m, path: industryLandingPath(segment) });
}

export function marketingIndustryStaticSlugParams(): { slug: string }[] {
  return MARKETING_INDUSTRY_URL_SEGMENTS.map((slug) => ({ slug }));
}
