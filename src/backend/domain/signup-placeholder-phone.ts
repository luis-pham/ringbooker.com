import { randomInt } from 'node:crypto';

import { SIGNUP_PLACEHOLDER_PHONE_PREFIX } from '@/lib/shop-phone-placeholder';

/** Unique-enough E.164 in fictional 555-010-xxxx block (NOT NULL / UNIQUE `shops.phone_number`). */
export function createSignupPlaceholderBusinessPhoneE164(): string {
  const suffix = randomInt(0, 10_000);
  return `${SIGNUP_PLACEHOLDER_PHONE_PREFIX}${String(suffix).padStart(4, '0')}`;
}

/**
 * Retry wrapper for shop creation that may hit a UNIQUE constraint on `phone_number`
 * when two signups draw the same placeholder concurrently (1-in-10k per attempt).
 * Calls `attemptFn` with a fresh placeholder on each try; throws after `maxAttempts`.
 */
export async function createShopWithPlaceholderPhoneRetry<T>(
  attemptFn: (phone: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    const phone = createSignupPlaceholderBusinessPhoneE164();
    try {
      return await attemptFn(phone);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/shops_phone_number_key|duplicate key value.*phone_number/i.test(msg)) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
