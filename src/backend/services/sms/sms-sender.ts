import { getCountryConfig } from '@/lib/countries/config';
import { getEnv } from '@/src/backend/config/env';
import type { SmsCategory, SmsService } from './types';

interface SendSmsParams {
  to: string;
  body: string;
  shop: {
    id: string;
    country_code?: string | null;
    timezone: string;
    sms_quiet_hours_start?: string | null;
    sms_quiet_hours_end?: string | null;
    telnyx_number?: string | null;
  };
  fromNumber?: string | null;
  locationTelnyxNumber?: string | null;
  allowGlobalFromFallback?: boolean;
  category: SmsCategory;
  bookingId?: string;
  idempotencyKey: string;
}

function getCurrentMinutesInTimezone(timezone: string): number {
  try {
    const current = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    return current.getHours() * 60 + current.getMinutes();
  } catch {
    const current = new Date();
    return current.getHours() * 60 + current.getMinutes();
  }
}

function parseQuietHour(value: string | null | undefined, fallbackHour: number): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return fallbackHour * 60;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return fallbackHour * 60;
  return hours * 60 + minutes;
}

function cleanSenderNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveSmsFromNumber(params: {
  shop: SendSmsParams['shop'];
  countryCode?: string | null;
  fromNumber?: string | null;
  locationTelnyxNumber?: string | null;
  allowGlobalFromFallback?: boolean;
}): string | null {
  const locationNumber = cleanSenderNumber(params.locationTelnyxNumber);
  if (locationNumber) return locationNumber;

  const explicitNumber = cleanSenderNumber(params.fromNumber);
  if (explicitNumber) return explicitNumber;

  const shopNumber = cleanSenderNumber(params.shop.telnyx_number);
  if (shopNumber) return shopNumber;

  if (params.allowGlobalFromFallback === false) return null;

  const countryConfig = getCountryConfig(params.countryCode);
  if (countryConfig.sms.senderType === 'sender_id' && countryConfig.sms.senderId) {
    return countryConfig.sms.senderId;
  }

  return cleanSenderNumber(getEnv().TELNYX_SMS_SENDER_NUMBER);
}

/**
 * Country-aware SMS dispatch. Enforces:
 *   - Feature flag: smsNotifications must be enabled for the shop's country
 *   - Quiet hours: based on country config and the shop's timezone
 *   - Sender selection: toll-free for US/CA, sender ID for AU/GB
 *
 * All existing direct calls to smsService.sendSms() still work unchanged;
 * use this helper for new call sites that want these guardrails automatically.
 */
export async function sendSms(
  smsService: SmsService,
  params: SendSmsParams,
): Promise<{ sent: false; reason: string } | { sent: true; sms: Awaited<ReturnType<SmsService['sendSms']>> }> {
  const countryCode = (params.shop.country_code ?? 'US').toUpperCase();
  const config = getCountryConfig(countryCode);

  if (!config.features.smsNotifications) {
    return { sent: false, reason: `sms_not_supported:${config.iso2}` };
  }

  if (!params.to.startsWith(config.phonePrefix)) {
    return { sent: false, reason: 'international_recipient' };
  }

  const currentMinutes = getCurrentMinutesInTimezone(params.shop.timezone);
  const quietStart = parseQuietHour(params.shop.sms_quiet_hours_start, config.sms.quietHours.start);
  const quietEnd = parseQuietHour(params.shop.sms_quiet_hours_end, config.sms.quietHours.end);
  if (currentMinutes < quietStart || currentMinutes >= quietEnd) {
    return { sent: false, reason: 'quiet_hours' };
  }

  const from = resolveSmsFromNumber({
    shop: params.shop,
    countryCode,
    fromNumber: params.fromNumber,
    locationTelnyxNumber: params.locationTelnyxNumber,
    allowGlobalFromFallback: params.allowGlobalFromFallback,
  });
  if (!from) {
    return { sent: false, reason: 'missing_from_number' };
  }

  const sms = await smsService.sendSms({
    to: params.to,
    from,
    body: params.body,
    shopId: params.shop.id,
    countryCode,
    category: params.category,
    bookingId: params.bookingId,
    idempotencyKey: params.idempotencyKey,
  });

  return { sent: true, sms };
}
