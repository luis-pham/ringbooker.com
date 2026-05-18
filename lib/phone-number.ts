import { getCountryConfig } from 'lib/countries/config';

function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function hasExplicitPlus(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith('+'));
}

/**
 * Normalize a raw phone string to E.164, using country as a hint for bare local numbers.
 * If the input already has a + prefix, it is validated and returned as-is.
 */
export function normalizePhone(raw: string, countryCode = 'US'): string {
  if (!raw) return '';
  if (raw.trimStart().startsWith('+')) return raw.trim();

  const config = getCountryConfig(countryCode);
  const digits = digitsOnly(raw);

  switch (config.phonePrefix) {
    case '+1':
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      break;
    case '+61':
      if (digits.startsWith('0') && digits.length === 10) return `+61${digits.slice(1)}`;
      if (digits.length === 9) return `+61${digits}`;
      break;
    case '+44':
      if (digits.startsWith('0') && digits.length === 11) return `+44${digits.slice(1)}`;
      if (digits.length === 10) return `+44${digits}`;
      break;
    default:
      break;
  }
  return `${config.phonePrefix}${digits}`;
}

export function normalizePhoneForStorage(
  value: string | null | undefined,
  countryCode?: string | null,
): string | null {
  const digits = digitsOnly(value);
  if (!digits) return null;

  if (hasExplicitPlus(value)) {
    const normalized = `+${digits}`;
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null;
  }

  const country = countryCode?.trim().toUpperCase() ?? 'US';
  const config = getCountryConfig(country);

  switch (config.phonePrefix) {
    case '+1':
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      break;
    case '+61':
      if (digits.startsWith('0') && digits.length === 10) return `+61${digits.slice(1)}`;
      if (digits.length === 9) return `+61${digits}`;
      break;
    case '+44':
      if (digits.startsWith('0') && digits.length === 11) return `+44${digits.slice(1)}`;
      if (digits.length === 10) return `+44${digits}`;
      break;
  }
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function phoneComparableDigits(value: string | null | undefined): string {
  return digitsOnly(value).replace(/^1(?=\d{10}$)/, '');
}

export function formatPhoneForDisplay(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  const digits = digitsOnly(raw);
  const usDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.length === 10 ? digits : null;
  if (usDigits) return `${usDigits.slice(0, 3)}-${usDigits.slice(3, 6)}-${usDigits.slice(6)}`;
  return raw;
}
