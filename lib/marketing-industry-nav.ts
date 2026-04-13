import { industryLandingPath } from '@/lib/marketing/industry-landings';

/**
 * Industry landing pages — marketing nav (desktop dropdown).
 * URLs live under `/industries/{segment}` (see `app/industries/[slug]/page.tsx`).
 */
export const MARKETING_INDUSTRY_NAV_ITEMS = [
  { href: industryLandingPath('nail-salon'), label: 'Nail Salon', icon: '💅' },
  { href: industryLandingPath('hair-salon'), label: 'Hair Salon', icon: '✂️' },
  { href: industryLandingPath('spa'), label: 'Day Spa', icon: '🧖' },
  { href: industryLandingPath('med-spa'), label: 'Med Spa', icon: '💉' },
  { href: industryLandingPath('beauty-clinic'), label: 'Beauty Clinic', icon: '✨' },
] as const;
