export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '[no-phone]';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '[phone-redacted]';
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

export function maskPii(obj: Record<string, unknown>): Record<string, unknown> {
  const phoneKeys = ['phone', 'callerPhone', 'from', 'to', 'caller_phone', 'phone_number', 'callerNumber'];
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      phoneKeys.some((phoneKey) => key.toLowerCase().includes(phoneKey.toLowerCase())) && typeof value === 'string'
        ? maskPhone(value)
        : value,
    ]),
  );
}
