import { getEnv } from '@/src/backend/config/env';
import type { SmsSendResult, SmsService } from '@/src/backend/services/sms/types';

export class NoopSmsService implements SmsService {
  async sendSms(params: {
    to: string;
    from: string;
    body: string;
    shopId: string;
    category:
      | 'booking_confirmation'
      | 'reminder_24h'
      | 'reminder_2h'
      | 'missed_call'
      | 'booking_link'
      | 'cancellation_alert'
      | 'booking_request_alert'
      | 'user_alert'
      | 'review_request';
    bookingId?: string;
    idempotencyKey: string;
  }): Promise<SmsSendResult> {
    console.log('[NoopSMS] from:', getEnv().TELNYX_SMS_SENDER_NUMBER || '+18888401886');
    console.log('[NoopSMS] to:', params.to);
    console.log('[NoopSMS] category:', params.category);
    console.log('[NoopSMS] body:', params.body);
    return {
      providerMessageId: undefined,
    };
  }
}
