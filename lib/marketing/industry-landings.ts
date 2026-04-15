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
    title: 'Nail Salon Missed Calls & After-Hours Booking Recovery | RingBooker',
    description:
      'Recover nail salon booking calls during services and after hours: peak-hour overflow, same-day walk-ins, pricing questions, reschedules, English + Vietnamese — on your current number, no new booking software.',
  },
  'hair-salon': {
    title: 'Hair Salon Overflow & Reschedule Call Answering | RingBooker',
    description:
      'Protect hair salon revenue when stylists are in-chair: after-hours and overflow call answering, stylist-match and color-slot capture, reschedule handling — same business line, works with your existing booking tools.',
  },
  spa: {
    title: 'Day Spa After-Hours & Overflow Call Answering | RingBooker',
    description:
      'Capture spa booking calls while therapists are in-room: couples and package inquiries, after-hours intent, peak-hour overflow, SMS confirmations — current number, no booking platform migration.',
  },
  'med-spa': {
    title: 'Med Spa Consultation Call Recovery & After-Hours Answering | RingBooker',
    description:
      'Never lose a high-value med spa consult to voicemail: after-hours and overflow answering for Botox, filler, and laser inquiries, no-show reduction context, same number forwarding.',
  },
  'beauty-clinic': {
    title: 'Beauty Clinic Consultation Call Answering | RingBooker',
    description:
      'Consultation-first phone layer for aesthetic clinics: provider continuity, pre- and post-care questions, after-hours inquiries, missed-call follow-up — on your current clinic number.',
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
