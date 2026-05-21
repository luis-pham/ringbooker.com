/**
 * provisionShopNumber
 *
 * High-level helper that wraps the Telnyx search + provision flow with
 * automatic area-code selection for US shops and a clear error path for
 * non-US countries that are not yet supported.
 *
 * Intentionally has NO side-effects on the database or email queue —
 * those stay in the HTTP handler so they can stay close to audit logging
 * and session context.
 *
 * Search strategy for US:
 *   1. NPA (area code) + state  → most local result
 *   2. State only               → same-state fallback
 *   3. Country-wide (US)        → last resort
 *
 * Supported non-US countries: CA, GB, AU, NZ, IE
 * All others return error code 'non_us_not_supported'.
 */

import { getAreaCode } from '@/src/backend/services/phone-provisioning/area-code-lookup';
import type { AvailablePhoneNumber, PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';

const MAX_PROVISION_ATTEMPTS = 8;

/** Countries with Telnyx number availability (ISO alpha-2 → Telnyx country code). */
const SUPPORTED_COUNTRY_MAP: Readonly<Record<string, string>> = {
  US: 'US',
  CA: 'CA',
  GB: 'GB',
  AU: 'AU',
  NZ: 'NZ',
  IE: 'IE',
};

export type SearchStrategy = 'area_code' | 'state' | 'country' | 'non_us_country';

export type ProvisionShopNumberOk = {
  ok: true;
  phoneNumber: string;
  providerNumberId?: string;
  orderId?: string;
  /** Area code used in the winning search (US-only). */
  areaCode?: string;
  /** Which search strategy produced the provisioned number. */
  strategy: SearchStrategy;
};

export type ProvisionShopNumberErr = {
  ok: false;
  /** Machine-readable reason. */
  code: 'non_us_not_supported' | 'no_candidates' | 'all_candidates_failed';
  message: string;
};

export type ProvisionShopNumberResult = ProvisionShopNumberOk | ProvisionShopNumberErr;

export type ProvisionShopNumberParams = {
  shopId: string;
  city: string;
  /** Two-letter US state abbreviation (e.g. "CA") or empty string for non-US. */
  state: string;
  zip: string;
  /** ISO alpha-2 country code, e.g. "US", "CA", "GB". Case-insensitive. */
  country: string;
  /**
   * Prefix prepended to every Telnyx idempotency key for this provisioning
   * flow, e.g. `randomUUID()`. Must be unique per invocation.
   */
  requestIdPrefix: string;
  service: PhoneProvisioningService;
};

export async function provisionShopNumber(
  params: ProvisionShopNumberParams,
): Promise<ProvisionShopNumberResult> {
  const countryUpper = params.country.trim().toUpperCase();

  // ── Non-US path ─────────────────────────────────────────────────────────────
  if (countryUpper !== 'US') {
    const telnyxCode = SUPPORTED_COUNTRY_MAP[countryUpper];
    if (!telnyxCode) {
      return {
        ok: false,
        code: 'non_us_not_supported',
        message:
          `Country "${params.country}" is not yet supported for automatic number provisioning. ` +
          `Supported non-US countries: ${Object.keys(SUPPORTED_COUNTRY_MAP).filter((c) => c !== 'US').join(', ')}.`,
      };
    }

    const candidates = await params.service.searchAvailableNumbers({
      countryCode: telnyxCode,
      limit: 12,
    });
    if (!candidates.length) {
      return { ok: false, code: 'no_candidates', message: `No numbers available for country "${params.country}".` };
    }
    const result = await tryProvision(candidates, params.requestIdPrefix, params.service);
    if (!result) {
      return { ok: false, code: 'all_candidates_failed', message: 'All provisioning attempts failed.' };
    }
    return { ok: true, ...result, strategy: 'non_us_country' };
  }

  // ── US path ─────────────────────────────────────────────────────────────────
  const areaCode = getAreaCode(params.city, params.state, params.zip) ?? undefined;
  const stateUpper = params.state.trim().toUpperCase();

  // 1. Area code + state
  if (areaCode && stateUpper) {
    const candidates = await params.service.searchAvailableNumbers({
      countryCode: 'US',
      npa: areaCode,
      administrativeArea: stateUpper,
      limit: 12,
    });
    if (candidates.length) {
      const result = await tryProvision(candidates, params.requestIdPrefix, params.service);
      if (result) return { ok: true, ...result, areaCode, strategy: 'area_code' };
    }
  }

  // 2. State only
  if (stateUpper) {
    const candidates = await params.service.searchAvailableNumbers({
      countryCode: 'US',
      administrativeArea: stateUpper,
      limit: 12,
    });
    if (candidates.length) {
      const result = await tryProvision(candidates, params.requestIdPrefix, params.service);
      if (result) return { ok: true, ...result, areaCode, strategy: 'state' };
    }
  }

  // 3. Country-wide
  const candidates = await params.service.searchAvailableNumbers({ countryCode: 'US', limit: 12 });
  if (!candidates.length) {
    return { ok: false, code: 'no_candidates', message: 'No US phone numbers available.' };
  }
  const result = await tryProvision(candidates, params.requestIdPrefix, params.service);
  if (!result) {
    return { ok: false, code: 'all_candidates_failed', message: 'All provisioning attempts failed.' };
  }
  return { ok: true, ...result, areaCode, strategy: 'country' };
}

/**
 * Iterates through candidates (up to MAX_PROVISION_ATTEMPTS) and returns the
 * first successfully provisioned number, or null if all attempts fail.
 * Individual candidate errors are swallowed so the caller can decide how to
 * report overall failure.
 */
async function tryProvision(
  candidates: AvailablePhoneNumber[],
  requestIdPrefix: string,
  service: PhoneProvisioningService,
): Promise<{ phoneNumber: string; providerNumberId?: string; orderId?: string } | null> {
  for (const candidate of candidates.slice(0, MAX_PROVISION_ATTEMPTS)) {
    try {
      const order = await service.provisionNumber({
        phoneNumber: candidate.phoneNumber,
        requestId: `${requestIdPrefix}:${candidate.phoneNumber}`,
      });
      return {
        phoneNumber: order.phoneNumber,
        providerNumberId: order.providerNumberId,
        orderId: order.orderId,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}
