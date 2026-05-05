/**
 * Signup stores a synthetic `shops.phone_number` when the user did not provide a business line.
 * Uses reserved fictional NANP 555-010-xxxx so we never treat it as a real subscriber number in UI.
 */
export const SIGNUP_PLACEHOLDER_PHONE_PREFIX = '+1555010' as const;

export const SIGNUP_PLACEHOLDER_PHONE_E164_REGEX = /^\+1555010\d{4}$/;

export function isSignupSyntheticPlaceholderPhone(e164: string | null | undefined): boolean {
  const t = e164?.trim();
  if (!t) return false;
  return SIGNUP_PLACEHOLDER_PHONE_E164_REGEX.test(t);
}
