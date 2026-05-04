import type { Shop } from '@/src/backend/domain/types';

export function isShopOnboardingComplete(shop: Shop): boolean {
  const hasVertical = typeof shop.vertical === 'string' && shop.vertical.trim().length > 0;
  const hasOwnerName = typeof shop.user_name === 'string' && shop.user_name.trim().length > 0;
  const hasOwnerPhone = typeof shop.user_phone === 'string' && shop.user_phone.trim().length > 0;
  const hasTimezone = typeof shop.timezone === 'string' && shop.timezone.trim().length > 0;
  const hasHours = !!shop.hours && Object.keys(shop.hours).length > 0;
  return hasVertical && hasOwnerName && hasOwnerPhone && hasTimezone && hasHours;
}
