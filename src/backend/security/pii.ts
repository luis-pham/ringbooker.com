const EMAIL_PATTERN = /\b([A-Z0-9._%+-])[A-Z0-9._%+-]*(@[A-Z0-9.-]+\.[A-Z]{2,})\b/i;
const PHONE_DIGITS_PATTERN = /\d/g;

export function maskEmail(value: string): string {
  const match = value.match(EMAIL_PATTERN);
  if (!match) return value;
  const [, first, domain] = match;
  return `${first}***${domain.toLowerCase()}`;
}

export function maskPhone(value: string): string {
  const digits = value.match(PHONE_DIGITS_PATTERN)?.join('') ?? '';
  if (digits.length < 6) return value;
  const last4 = digits.slice(-4);
  return `***${last4}`;
}

export function maskStringPII(value: string): string {
  if (value.includes('@')) {
    return maskEmail(value);
  }
  if (value.match(PHONE_DIGITS_PATTERN)?.length && (value.includes('+') || value.includes('(') || value.length >= 10)) {
    return maskPhone(value);
  }
  return value;
}

export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') return maskStringPII(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeForLog(item));
  if (!value || typeof value !== 'object') return value;

  const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.includes('email') && typeof item === 'string') {
      return [key, maskEmail(item)];
    }
    if (
      (normalizedKey.includes('phone') || normalizedKey.includes('caller') || normalizedKey.includes('customer')) &&
      typeof item === 'string'
    ) {
      return [key, maskPhone(item)];
    }
    return [key, sanitizeForLog(item)];
  });
  return Object.fromEntries(entries);
}
