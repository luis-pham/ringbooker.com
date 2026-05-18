import { getCountryConfig } from '@/lib/countries/config';
import type { SmsCategory, SmsService } from './types';

interface SendSmsParams {
  to: string;
  body: string;
  shop: { id: string; country_code?: string | null; timezone: string };
  category: SmsCategory;
  bookingId?: string;
  idempotencyKey: string;
}

function getCurrentHourInTimezone(timezone: string): number {
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone: timezone })).getHours();
  } catch {
    return new Date().getHours();
  }
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
): Promise<{ sent: boolean; reason?: string }> {
  const countryCode = (params.shop.country_code ?? 'US').toUpperCase();
  const config = getCountryConfig(countryCode);

  if (!config.features.smsNotifications) {
    return { sent: false, reason: `sms_not_supported:${config.iso2}` };
  }

  const hour = getCurrentHourInTimezone(params.shop.timezone);
  if (hour < config.sms.quietHours.start || hour >= config.sms.quietHours.end) {
    return { sent: false, reason: 'quiet_hours' };
  }

  await smsService.sendSms({
    to: params.to,
    from: '',
    body: params.body,
    shopId: params.shop.id,
    countryCode,
    category: params.category,
    bookingId: params.bookingId,
    idempotencyKey: params.idempotencyKey,
  });

  return { sent: true };
}
