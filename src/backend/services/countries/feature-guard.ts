import { getCountryConfig, type CountryConfig } from '@/lib/countries/config';

export class FeatureNotAvailableError extends Error {
  constructor(feature: string, country: string) {
    super(`${feature} is not available in ${country}`);
    this.name = 'FeatureNotAvailableError';
  }
}

/**
 * Throws FeatureNotAvailableError if the shop's country does not support the given feature.
 * Use at API route entry points before performing country-gated operations.
 *
 * @example
 *   requireFeature(shop, 'customerSms')
 *   requireFeature(shop, 'callForwarding')
 */
export function requireFeature(
  shop: { country_code?: string | null },
  feature: keyof CountryConfig['features'],
): void {
  const config = getCountryConfig(shop.country_code);
  if (!config.features[feature]) {
    throw new FeatureNotAvailableError(feature, config.name);
  }
}

/**
 * Returns true if the shop's country supports the given feature.
 * Use when you want conditional behavior rather than an error.
 */
export function hasFeature(
  shop: { country_code?: string | null },
  feature: keyof CountryConfig['features'],
): boolean {
  const config = getCountryConfig(shop.country_code);
  return config.features[feature];
}
