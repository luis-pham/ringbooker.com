import { withLogContext } from '@/src/backend/observability/logger';
import type { SmsSendResult, SmsService } from '@/src/backend/services/sms/types';
import { isRetryableHttpStatus, RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
import { retryAsync } from '@/src/backend/net/retry';

type TelnyxMessageCreateResponse = {
  data?: {
    id?: string;
  };
};

export class TelnyxSmsService implements SmsService {
  constructor(private readonly apiKey: string) {}

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
    const log = withLogContext({
      shopId: params.shopId,
      provider: 'telnyx',
    });

    const response = await retryAsync(
      async (attempt) => {
        const res = await fetch('https://api.telnyx.com/v2/messages', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
          },
          body: JSON.stringify({
            to: params.to,
            from: params.from,
            text: params.body,
          }),
        });
        if (!res.ok && isRetryableHttpStatus(res.status)) {
          const error = new Error(`telnyx_retryable_status:${res.status}`) as Error & { retryable?: boolean };
          error.retryable = true;
          log.warn({ status: res.status, attempt, category: params.category }, 'telnyx_sms_retryable_error');
          throw error;
        }
        return res;
      },
      {
        retries: RETRY_POLICIES.telnyxSms.retries,
        initialDelayMs: RETRY_POLICIES.telnyxSms.initialDelayMs,
        maxDelayMs: RETRY_POLICIES.telnyxSms.maxDelayMs,
        shouldRetry: (error) => Boolean((error as { retryable?: boolean })?.retryable),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text();
      log.error(
        {
          status: response.status,
          category: params.category,
          bodyText,
        },
        'telnyx_sms_send_failed',
      );
      throw new Error(`telnyx_sms_send_failed:${response.status}`);
    }

    const data = (await response.json()) as TelnyxMessageCreateResponse;
    const providerMessageId = data.data?.id;

    log.info(
      {
        category: params.category,
        providerMessageId,
      },
      'telnyx_sms_sent',
    );

    return { providerMessageId };
  }
}
