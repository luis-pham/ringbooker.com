/**
 * Industry landing pages — used by marketing nav (desktop dropdown + mobile avatar menu).
 * Keep in sync with vertical routes under app/ (e.g. nail-salon/page.tsx, spa/page.tsx).
 */
export const MARKETING_INDUSTRY_NAV_ITEMS = [
  { href: '/nail-salon', label: 'Nail Salon', icon: '💅' },
  { href: '/hair-salon', label: 'Hair Salon', icon: '✂️' },
  { href: '/spa', label: 'Day Spa', icon: '🧖' },
  { href: '/med-spa', label: 'Med Spa', icon: '💉' },
  { href: '/beauty-clinic', label: 'Beauty Clinic', icon: '✨' },
] as const;
