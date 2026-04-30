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
      | 'callback_ack'
      | 'user_alert'
      | 'review_request';
    bookingId?: string;
    idempotencyKey: string;
  }): Promise<SmsSendResult> {
    void params;
    return {
      providerMessageId: undefined,
    };
  }
}
