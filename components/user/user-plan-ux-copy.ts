import type { ShopPlan } from '@/src/backend/domain/types';
import type { ShopPlanCapabilities } from '@/src/backend/domain/shop-plan-capabilities';

export const BILLING_PLAN_CARD_FEATURES: Record<ShopPlan, string[]> = {
  starter: [
    'Up to 100 captured callers/month',
    'Forwarded call answering',
    'Booking request capture',
    'Optional missed-call text back where enabled',
    'Basic call logs and summaries',
  ],
  professional: [
    'Up to 300 captured callers/month',
    'Reminder and review SMS where configured',
    'Returning caller notes',
    'Bilingual answering where configured',
    'Owner transfer',
  ],
  enterprise: [
    'Custom captured caller volume',
    'Managed routing and integrations',
    'Multi-location support',
    'Implementation support',
  ],
};

export const CUSTOM_MANAGED_SETUP_ITEMS = [
  'Multi-location setup',
  'Custom routing',
  'Custom integrations',
  'Custom multilingual routing',
  'Higher call volume planning',
  'Implementation support',
];

/** Billing › Overview — Enterprise pending: replaces the single intro paragraph (matches `plan-includes-list` typography). */
export const ENTERPRISE_PENDING_BILLING_STATUS_LINES = [
  'Your Custom setup is being prepared through sales and implementation.',
  'We confirm contract, invoice, routing, and go-live details before live answering is enabled.',
] as const;

/** Dashboard — Enterprise pending: status lines before managed setup capabilities. */
export const ENTERPRISE_PENDING_OVERVIEW_STATUS_LINES = [
  'RingBooker is reviewing your locations, routing rules, and implementation plan.',
  'Our team confirms your go-live timeline before live answering is enabled.',
] as const;

export const USER_LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'es', label: 'Spanish' },
] as const;

export type UserLanguageCode = (typeof USER_LANGUAGE_OPTIONS)[number]['code'];

export function languageDisplayName(code: string): string {
  return USER_LANGUAGE_OPTIONS.find((item) => item.code === code)?.label ?? code.toUpperCase();
}

export function normalizeUserLanguages(languages: string[] | null | undefined): string[] {
  const next = new Set<string>(['en']);
  for (const language of languages ?? []) {
    const trimmed = language.trim().toLowerCase();
    if (trimmed) next.add(trimmed);
  }
  return Array.from(next);
}

export function getOwnerTransferPlanUx(plan: ShopPlan, capabilities: Pick<ShopPlanCapabilities, 'edit_transfer_settings'>) {
  if (!capabilities.edit_transfer_settings) {
    return {
      locked: true,
      badge: 'Available on Professional',
      title: 'Owner transfer',
      description: 'Let RingBooker hand urgent or frustrated callers to your team on Professional.',
    };
  }
  if (plan === 'enterprise') {
    return {
      locked: false,
      badge: 'Managed setup',
      title: 'Owner transfer',
      description: 'Your implementation setup can include custom transfer rules and escalation paths.',
    };
  }
  return {
    locked: false,
    badge: 'Professional',
    title: 'Owner transfer',
    description: 'Let RingBooker hand urgent or frustrated callers to your salon line.',
  };
}

export function getBilingualAnsweringPlanUx(plan: ShopPlan) {
  if (plan === 'starter') {
    return {
      locked: true,
      badge: 'Available on Professional',
      title: 'Bilingual answering',
      description: 'Bilingual answering is available on Professional. Starter keeps live calls English-first.',
      ctaLabel: 'View Professional plan',
      ctaHref: '/user/billing#plans',
    };
  }
  if (plan === 'enterprise') {
    return {
      locked: false,
      badge: 'Managed multilingual routing',
      title: 'Managed multilingual routing',
      description: 'Custom accounts can use managed language routing and multilingual call flows with implementation support.',
      ctaLabel: 'Contact implementation support',
      ctaHref: '/contact?topic=implementation',
    };
  }
  return {
    locked: false,
    badge: 'Professional',
    title: 'Bilingual answering',
    description: 'Choose the languages RingBooker may use during live calls where configured.',
    ctaLabel: 'Save AI voice & language',
    ctaHref: null,
  };
}

export function getReturningCallerNotesPlanUx(plan: ShopPlan) {
  if (plan === 'starter') {
    return {
      locked: true,
      badge: 'Available on Professional',
      title: 'Returning caller notes',
      description: 'Available on Professional. RingBooker can use previous caller notes, preferences, and preferred provider context on future calls.',
    };
  }
  if (plan === 'enterprise') {
    return {
      locked: false,
      badge: 'Managed memory',
      title: 'Returning caller notes',
      description: 'Custom accounts can combine caller history with managed routing, location, and provider rules.',
    };
  }
  return {
    locked: false,
    badge: 'Active on Professional',
    title: 'Returning caller notes',
    description: 'RingBooker can use previous caller notes, service preferences, and preferred provider context when caller history is available.',
  };
}
