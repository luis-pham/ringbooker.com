import { getEnv } from '@/src/backend/config/env';
import type { SmsCategory, SmsSendResult, SmsService } from '@/src/backend/services/sms/types';

export class NoopSmsService implements SmsService {
  async sendSms(params: {
    to: string;
    from: string;
    body: string;
    shopId: string;
    countryCode?: string;
    category: SmsCategory;
    bookingId?: string;
    idempotencyKey: string;
  }): Promise<SmsSendResult> {
    const from = params.from?.trim() || getEnv().TELNYX_SMS_SENDER_NUMBER?.trim();
    console.log('[NoopSMS] from:', from ?? 'missing');
    console.log('[NoopSMS] to:', params.to);
    console.log('[NoopSMS] category:', params.category);
    console.log('[NoopSMS] bodyLength:', params.body.length);
    return {
      providerMessageId: undefined,
      fromNumber: from ?? undefined,
      toNumber: params.to,
      status: 'noop',
    };
  }
}
