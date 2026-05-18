import { telnyxHttpFailureIsRetryable } from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import { getTelnyxSmsTimeoutMs } from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { getEnv } from '@/src/backend/config/env';
import { withLogContext } from '@/src/backend/observability/logger';
import type { SmsSendResult, SmsService } from '@/src/backend/services/sms/types';
import { getCountryConfig } from '@/lib/countries/config';
import { RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
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
    countryCode?: string;
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
    const countryConfig = getCountryConfig(params.countryCode);
    const from = countryConfig.sms.senderType === 'sender_id' && countryConfig.sms.senderId
      ? countryConfig.sms.senderId
      : getEnv().TELNYX_SMS_SENDER_NUMBER || '+18888401886';
    const log = withLogContext({
      shopId: params.shopId,
      provider: 'telnyx',
    });

    let httpResult;
    try {
      httpResult = await retryAsync(
        async () =>
          telnyxHttpJson({
            method: 'POST',
            path: 'messages',
            body: {
              to: params.to,
              from,
              text: params.body,
            },
            extraHeaders: { 'Idempotency-Key': params.idempotencyKey },
            timeoutMs: getTelnyxSmsTimeoutMs(),
            operation: 'sms.send',
            apiKey: this.apiKey,
            correlation: {
              shopId: params.shopId,
              category: params.category,
              messagePurpose: params.category,
            },
          }),
        {
          retries: RETRY_POLICIES.telnyxSms.retries,
          initialDelayMs: RETRY_POLICIES.telnyxSms.initialDelayMs,
          maxDelayMs: RETRY_POLICIES.telnyxSms.maxDelayMs,
          shouldRetry: telnyxHttpFailureIsRetryable,
        },
      );
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
      log.error(
        {
          status,
          category: params.category,
          err,
        },
        'telnyx_sms_send_failed',
      );
      throw new Error(`telnyx_sms_send_failed:${status ?? 'unknown'}`);
    }

    const data = httpResult.parsedJson as TelnyxMessageCreateResponse;
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
