import { normalizePhoneForStorage } from '@/lib/phone-number';
import { logger } from '@/src/backend/observability/logger';

const DEFAULT_ALLOWED_COUNTRIES = ['US', 'CA'];

const NANP_PREMIUM_OR_HIGH_RISK_NPAS = new Set([
  '900',
  '976',
  '242',
  '246',
  '264',
  '268',
  '284',
  '345',
  '441',
  '473',
  '649',
  '664',
  '721',
  '758',
  '767',
  '784',
  '809',
  '829',
  '849',
  '868',
  '869',
  '876',
]);

export type OwnerHandoffDestinationDecision =
  | { ok: true; e164: string }
  | { ok: false; reason: 'invalid_phone' | 'unverified_owner_phone' | 'country_not_allowed' | 'premium_or_high_risk_destination' };

function allowedCountries(): Set<string> {
  const configured = process.env.RB_OWNER_HANDOFF_ALLOWED_COUNTRIES ?? process.env.OWNER_HANDOFF_ALLOWED_COUNTRIES;
  const values = configured
    ? configured.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_ALLOWED_COUNTRIES;
  return new Set(values);
}

function ownerPhoneIsVerified(shop: { sms_owner_opted_in?: boolean | null }): boolean {
  // Current schema has no separate phone-verification column. Owner SMS opt-in is
  // the only server-side proof that the owner controls this number.
  return shop.sms_owner_opted_in === true;
}

function isAllowedCountry(e164: string, shopCountryCode?: string | null): boolean {
  const allowlist = allowedCountries();
  const country = (shopCountryCode ?? 'US').toUpperCase();
  if (e164.startsWith('+1')) return allowlist.has('US') || allowlist.has('CA') || allowlist.has(country);
  return allowlist.has(country) && !DEFAULT_ALLOWED_COUNTRIES.includes(country);
}

function isPremiumOrHighRisk(e164: string): boolean {
  if (!e164.startsWith('+1') || e164.length < 5) return false;
  return NANP_PREMIUM_OR_HIGH_RISK_NPAS.has(e164.slice(2, 5));
}

export function evaluateOwnerHandoffDestination(params: {
  shop: { id: string; country_code?: string | null; sms_owner_opted_in?: boolean | null };
  ownerPhone: string;
}): OwnerHandoffDestinationDecision {
  const e164 = normalizePhoneForStorage(params.ownerPhone, params.shop.country_code ?? 'US');
  if (!e164) return { ok: false, reason: 'invalid_phone' };
  if (!ownerPhoneIsVerified(params.shop)) return { ok: false, reason: 'unverified_owner_phone' };
  if (!isAllowedCountry(e164, params.shop.country_code)) return { ok: false, reason: 'country_not_allowed' };
  if (isPremiumOrHighRisk(e164)) return { ok: false, reason: 'premium_or_high_risk_destination' };
  return { ok: true, e164 };
}

export function logBlockedOwnerHandoffDestination(params: {
  shopId: string;
  rbCallId?: string | null;
  reason: OwnerHandoffDestinationDecision extends { ok: false; reason: infer R } ? R : string;
}): void {
  logger.warn(
    {
      shop_id: params.shopId,
      call_session_id: params.rbCallId ?? null,
      reason: params.reason,
    },
    'owner_handoff_destination_blocked',
  );
}
