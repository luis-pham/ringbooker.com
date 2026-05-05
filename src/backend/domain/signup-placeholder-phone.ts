import { randomInt } from 'node:crypto';

import { SIGNUP_PLACEHOLDER_PHONE_PREFIX } from '@/lib/shop-phone-placeholder';

/** Unique-enough E.164 in fictional 555-010-xxxx block (NOT NULL / UNIQUE `shops.phone_number`). */
export function createSignupPlaceholderBusinessPhoneE164(): string {
  const suffix = randomInt(0, 10_000);
  return `${SIGNUP_PLACEHOLDER_PHONE_PREFIX}${String(suffix).padStart(4, '0')}`;
}
