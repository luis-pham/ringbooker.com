function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function hasExplicitPlus(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith('+'));
}

export function normalizePhoneForStorage(value: string | null | undefined, countryOrAddressHint?: string | null): string | null {
  const digits = digitsOnly(value);
  if (!digits) return null;

  if (hasExplicitPlus(value)) {
    const normalized = `+${digits}`;
    return /^\+\d{8,15}$/.test(normalized) ? normalized : null;
  }

  void countryOrAddressHint;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
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
