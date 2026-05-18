'use client';

import { useMemo } from 'react';
import { getCountryConfig, type CountryConfig } from 'lib/countries/config';
import { useGoLive } from './useGoLive';

/**
 * Returns the CountryConfig for the current shop's country.
 * Falls back to US config when country_code is unavailable.
 *
 * Usage in phone input components:
 *   const config = useCountryConfig();
 *   <input placeholder={config.phoneFormat} />
 */
export function useCountryConfig(): CountryConfig {
  const goLive = useGoLive(null);
  const countryCode = goLive.status?.forwarding.country?.toUpperCase() ?? 'US';
  return useMemo(() => getCountryConfig(countryCode), [countryCode]);
}
