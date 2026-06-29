import { normalizePhoneForStorage } from '@/lib/phone-number';
import { getEnv } from '@/src/backend/config/env';

export function normalizeSmsInboxPhoneNumber(value: string | null | undefined): string | null {
  return normalizePhoneForStorage(value, 'US');
}

export function getAllowedSmsInboxNumbers(): string[] {
  const configured = getEnv().TELNYX_SMS_INBOX_ALLOWED_NUMBERS ?? '';
  const seen = new Set<string>();
  for (const value of configured.split(',')) {
    const normalized = normalizeSmsInboxPhoneNumber(value.trim());
    if (normalized) seen.add(normalized);
  }
  return [...seen];
}

export function isAllowedSmsInboxNumber(value: string | null | undefined): boolean {
  const normalized = normalizeSmsInboxPhoneNumber(value);
  if (!normalized) return false;
  return getAllowedSmsInboxNumbers().includes(normalized);
}
