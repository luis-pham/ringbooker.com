import type { MarketingVerticalIconId } from '@/components/marketing/marketing-vertical-icon';

/**
 * Live demo verticals — keep in sync with routes under app/demo/*.
 */
export const MARKETING_DEMO_NAV_ITEMS = [
  { href: '/demo/nail-salon', label: 'Nail Salon', iconId: 'nail-salon' as const satisfies MarketingVerticalIconId },
  { href: '/demo/hair-salon', label: 'Hair Salon', iconId: 'hair-salon' as const satisfies MarketingVerticalIconId },
  { href: '/demo/day-spa', label: 'Day Spa', iconId: 'day-spa' as const satisfies MarketingVerticalIconId },
  { href: '/demo/med-spa', label: 'Med Spa', iconId: 'med-spa' as const satisfies MarketingVerticalIconId },
  { href: '/demo/beauty-clinic', label: 'Beauty Clinic', iconId: 'beauty-clinic' as const satisfies MarketingVerticalIconId },
] as const;
