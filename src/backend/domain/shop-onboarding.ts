import type { Shop } from '@/src/backend/domain/types';

/** Core business profile fields (hours, vertical, owner contact, timezone). */
export function isShopOnboardingComplete(shop: Shop): boolean {
  const hasVertical = typeof shop.vertical === 'string' && shop.vertical.trim().length > 0;
  const hasOwnerName = typeof shop.user_name === 'string' && shop.user_name.trim().length > 0;
  const hasOwnerPhone = typeof shop.user_phone === 'string' && shop.user_phone.trim().length > 0;
  const hasTimezone = typeof shop.timezone === 'string' && shop.timezone.trim().length > 0;
  const hasHours = !!shop.hours && Object.keys(shop.hours).length > 0;
  return hasVertical && hasOwnerName && hasOwnerPhone && hasTimezone && hasHours;
}

export function shopHasConfiguredServices(shop: Shop): boolean {
  if (shop.service_catalog?.services.some((s) => s.active !== false && typeof s.name === 'string' && s.name.trim().length > 0)) {
    return true;
  }
  return shop.services.some((s) => typeof s.name === 'string' && s.name.trim().length > 0);
}

/** User reached the go-live / test step in the setup wizard (step 4). */
export function hasReachedOnboardingTestStep(shop: Shop): boolean {
  return (shop.current_onboarding_step ?? 1) >= 4;
}

/**
 * Setup wizard complete: profile + at least one service + user has opened the test/go-live step.
 * Does not imply payment, forwarding provision, or live answering.
 */
export function isShopSetupWizardComplete(shop: Shop): boolean {
  return isShopOnboardingComplete(shop) && shopHasConfiguredServices(shop) && hasReachedOnboardingTestStep(shop);
}
