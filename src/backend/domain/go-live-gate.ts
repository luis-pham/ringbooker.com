import { serviceCatalogHasActiveServices } from '@/src/backend/domain/service-catalog';
import type { BusinessHours, Shop } from '@/src/backend/domain/types';

export type KnowledgeGateItem = {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  fixPath: string;
};

function hasAnyHours(hours: BusinessHours | null | undefined): boolean {
  if (!hours) return false;
  return Object.values(hours).some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if ('closed' in entry && entry.closed === true) return false;
    return 'open' in entry && 'close' in entry && Boolean(entry.open?.trim()) && Boolean(entry.close?.trim());
  });
}

function hasAnyService(shop: Shop): boolean {
  if (serviceCatalogHasActiveServices(shop.service_catalog)) return true;
  return shop.services.some((service) => typeof service.name === 'string' && service.name.trim().length > 0);
}

function hasAnyStaff(shop: Shop): boolean {
  return Boolean(shop.staff?.some((staff) => staff.active !== false && staff.name.trim().length > 0));
}

function hasPolicies(shop: Shop): boolean {
  return Boolean(shop.cancel_policy?.trim() || shop.faqs?.some((faq) => faq.question.trim() && faq.answer.trim()));
}

export function evaluateKnowledgeGate(shop: Shop): KnowledgeGateItem[] {
  return [
    {
      key: 'businessName',
      label: 'Business name',
      passed: Boolean(shop.name?.trim()),
      blocking: true,
      fixPath: '/user/settings?tab=business',
    },
    {
      key: 'timezone',
      label: 'Timezone set',
      // shop.timezone is a NOT NULL column that always holds at least the signup-time
      // default, so checking presence alone can never fail. Require an actual confirmation
      // (onboarding profile review or a Settings save) instead.
      passed: Boolean(shop.timezone_confirmed_at),
      blocking: true,
      fixPath: '/user/settings?tab=business',
    },
    {
      key: 'hours',
      label: 'Hours added',
      passed: hasAnyHours(shop.hours),
      blocking: true,
      fixPath: '/user/settings?tab=hours',
    },
    {
      key: 'services',
      label: 'At least one service',
      passed: hasAnyService(shop),
      blocking: true,
      fixPath: '/user/settings?tab=services-hours',
    },
    {
      key: 'staff',
      label: 'Staff added',
      passed: hasAnyStaff(shop),
      blocking: false,
      fixPath: '/user/settings?tab=staff',
    },
    {
      key: 'policies',
      label: 'Policies added',
      passed: hasPolicies(shop),
      blocking: false,
      fixPath: '/user/settings?tab=faq',
    },
  ];
}

export function canProceedToGoLive(items: KnowledgeGateItem[]): boolean {
  return items.filter((item) => item.blocking).every((item) => item.passed);
}
