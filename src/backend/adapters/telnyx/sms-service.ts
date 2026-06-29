import { telnyxHttpFailureIsRetryable } from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import { getTelnyxSmsTimeoutMs } from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { getEnv } from '@/src/backend/config/env';
import { withLogContext } from '@/src/backend/observability/logger';
import type { SmsCategory, SmsSendResult, SmsService } from '@/src/backend/services/sms/types';
import { getCountryConfig } from '@/lib/countries/config';
import { RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
import { retryAsync } from '@/src/backend/net/retry';

type TelnyxMessageCreateResponse = {
  data?: {
    id?: string;
    status?: string;
  };
};

function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}

export class TelnyxSmsService implements SmsService {
  constructor(private readonly apiKey: string) {}

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
    const countryConfig = getCountryConfig(params.countryCode);
    const fallbackSenderNumber = countryConfig.sms.senderType === 'sender_id' && countryConfig.sms.senderId
      ? countryConfig.sms.senderId
      : getEnv().TELNYX_SMS_SENDER_NUMBER?.trim();
    const from = params.from?.trim() || fallbackSenderNumber;
    if (!from) {
      throw new Error('Missing SMS from number');
    }
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
      const errorMessage = err instanceof Error ? err.message : 'unknown_error';
      log.error(
        {
          status,
          category: params.category,
          errorMessage,
          from: maskPhone(from),
          to: maskPhone(params.to),
        },
        'telnyx_sms_send_failed',
      );
      throw new Error(`telnyx_sms_send_failed:${status ?? 'unknown'}`);
    }

    const data = httpResult.parsedJson as TelnyxMessageCreateResponse;
    const providerMessageId = data.data?.id;
    const providerStatus = data.data?.status;

    log.info(
      {
        category: params.category,
        providerMessageId,
        status: providerStatus,
        from: maskPhone(from),
        to: maskPhone(params.to),
      },
      'telnyx_sms_sent',
    );

    return {
      providerMessageId,
      fromNumber: from,
      toNumber: params.to,
      status: providerStatus,
      raw: data,
    };
  }
}
