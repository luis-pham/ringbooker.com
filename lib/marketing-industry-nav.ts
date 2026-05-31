import type { MarketingVerticalIconId } from '@/components/marketing/marketing-vertical-icon';
import { industryLandingPath } from '@/lib/marketing/industry-landings';

/**
 * Industry landing pages — marketing nav (desktop dropdown).
 * URLs live under `/industries/{segment}` (see `app/industries/[slug]/page.tsx`).
 */
export const MARKETING_INDUSTRY_NAV_ITEMS = [
  { href: industryLandingPath('nail-salon'), label: 'Nail Salon', iconId: 'nail-salon' as const satisfies MarketingVerticalIconId },
  { href: industryLandingPath('hair-salon'), label: 'Hair Salon', iconId: 'hair-salon' as const satisfies MarketingVerticalIconId },
  { href: industryLandingPath('spa'), label: 'Day Spa', iconId: 'day-spa' as const satisfies MarketingVerticalIconId },
  { href: industryLandingPath('med-spa'), label: 'Med Spa', iconId: 'med-spa' as const satisfies MarketingVerticalIconId },
  { href: industryLandingPath('beauty-clinic'), label: 'Beauty Clinic', iconId: 'beauty-clinic' as const satisfies MarketingVerticalIconId },
] as const;
