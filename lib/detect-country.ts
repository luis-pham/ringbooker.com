const CANADIAN_AREA_CODES = new Set([
  204, 226, 236, 249, 250, 289, 306, 343, 365, 387, 403, 416, 418, 431, 437, 438, 450, 506, 514, 519,
  548, 579, 581, 587, 604, 613, 639, 647, 672, 705, 709, 742, 778, 780, 782, 807, 819, 825, 867, 873,
  902, 905,
]);

export function normalizeDetectedCountry(country: string | null | undefined): string | null {
  const value = country?.trim().toLowerCase();
  if (!value) return null;
  if (value === 'uk') return 'gb';
  return value;
}

export function detectCountryFromPhone(phone: string): string | null {
  const digits = phone.replace(/[\s\-().]/g, '');
  if (!digits) return null;

  if (digits.startsWith('+1')) {
    const areaCode = Number.parseInt(digits.slice(2, 5), 10);
    return CANADIAN_AREA_CODES.has(areaCode) ? 'ca' : 'us';
  }
  if (digits.startsWith('+44')) return 'gb';
  if (digits.startsWith('+61')) return 'au';
  if (digits.startsWith('+64')) return 'nz';
  if (digits.startsWith('+353')) return 'ie';
  if (digits.startsWith('+65')) return 'sg';

  return null;
}

export function detectCountryFromAddress(address: string): string | null {
  if (!address?.trim()) return null;
  const a = address.toLowerCase();

  if (/\b(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy)\b/.test(a)) return 'us';
  if (/\b\d{5}\b/.test(address)) return 'us';

  if (/\b(ab|bc|mb|nb|nl|ns|nt|nu|on|pe|qc|sk|yt)\b/.test(a)) return 'ca';
  if (/\b[a-z]\d[a-z]\s?\d[a-z]\d\b/i.test(address)) return 'ca';

  if (/\b[a-z]{1,2}\d{1,2}\s?\d[a-z]{2}\b/i.test(address)) return 'gb';

  if (/\b(nsw|vic|qld|sa|wa|tas|act|nt)\b/.test(a)) return 'au';
  if (/\b\d{4}\b/.test(address) && /australia/i.test(a)) return 'au';

  return null;
}

export function detectCountry(phone: string | null | undefined, address: string | null | undefined): string {
  if (phone) {
    const fromPhone = detectCountryFromPhone(phone);
    if (fromPhone) return fromPhone;
  }
  if (address) {
    const fromAddress = detectCountryFromAddress(address);
    if (fromAddress) return fromAddress;
  }
  return 'us';
}
