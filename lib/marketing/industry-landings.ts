import type { Metadata } from 'next';

import type { MarketingVerticalKey } from '@/components/marketing/marketing-vertical';
import { generateCanonical } from '@/lib/seo';
import { buildMetadata } from '@/lib/site';

/** URL segment after `/industries/` for marketing landing pages (not blog slugs). */
export const MARKETING_INDUSTRY_URL_SEGMENTS = ['nail-salon', 'hair-salon', 'spa', 'med-spa', 'beauty-clinic'] as const;

export type MarketingIndustryUrlSegment = (typeof MARKETING_INDUSTRY_URL_SEGMENTS)[number];

export const VI_NAIL_SALON_LANDING_SEO = {
  path: '/industries/nail-salon/vi',
  title: 'Lễ Tân AI Cho Tiệm Nail | Square & Vagaro | RingBooker',
  description:
    'RingBooker là lễ tân AI cho tiệm nail — đọc website tự động, tích hợp Square và Vagaro, trả lời tiếng Việt. Setup 15 phút.',
} as const;

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
    title: 'AI Receptionist for Nail Salons | English & Vietnamese | RingBooker',
    description:
      'RingBooker is an AI receptionist and answering service for nail salons — English and Vietnamese calls, walk-in availability, pricing questions, and after-hours bookings on your current number.',
  },
  'hair-salon': {
    title: 'AI Receptionist and Answering Service for Hair Salons | RingBooker',
    description:
      'RingBooker is an AI receptionist and answering service for hair salons — preferred stylist requests, color inquiries, and reschedule calls. 77% of clients prefer calling to reschedule. Zenoti 2025: not the app, not a form — the phone is still the primary reschedule channel.',
  },
  spa: {
    title: 'AI Receptionist for Day Spas | RingBooker',
    description:
      'RingBooker is an AI receptionist and answering service for day spas — couples massage inquiries, package questions, and after-hours calls. Answer every call on your current number.',
  },
  'med-spa': {
    title: 'AI Receptionist for Med Spas | Botox & Filler Calls | RingBooker',
    description:
      'RingBooker is an AI receptionist and answering service for med spas — Botox, filler, and consultation calls after hours and during treatments. 3 missed calls/day costs $130,000+ annually.',
  },
  'beauty-clinic': {
    title: 'AI Receptionist for Beauty Clinics & Wax Studios | RingBooker',
    description:
      'RingBooker is an AI receptionist and answering service for beauty clinics — wax studios, lash studios, and aesthetic clinics. 1 in 3 salon calls goes unanswered during service hours. Covered on your current number.',
  },
};

export function marketingIndustryLandingSeo(segment: MarketingIndustryUrlSegment): {
  title: string;
  description: string;
  path: string;
} {
  return { ...LANDING_META[segment], path: industryLandingPath(segment) };
}

export function marketingIndustryLandingMetadata(segment: string): Metadata {
  const key = segment as MarketingIndustryUrlSegment;
  const m = LANDING_META[key];
  if (!m) {
    return buildMetadata({
      title: 'Industry solutions | RingBooker',
      description: 'AI receptionist and answering service and call recovery for beauty businesses — after-hours, overflow, and missed-call coverage on your current number.',
      path: '/industries',
    });
  }
  const seo = marketingIndustryLandingSeo(key);
  const metadata = buildMetadata(seo);
  if (key === 'nail-salon') {
    return {
      ...metadata,
      alternates: {
        canonical: generateCanonical(seo.path).alternates.canonical,
        languages: {
          en: seo.path,
          'en-US': seo.path,
          vi: '/industries/nail-salon/vi',
          'x-default': seo.path,
        },
      },
    };
  }
  return metadata;
}

export function marketingIndustryStaticSlugParams(): { slug: string }[] {
  return MARKETING_INDUSTRY_URL_SEGMENTS.map((slug) => ({ slug }));
}
