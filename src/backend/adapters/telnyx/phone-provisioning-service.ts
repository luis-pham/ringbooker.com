import { withLogContext } from '@/src/backend/observability/logger';
import { isRetryableHttpStatus, RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
import { retryAsync } from '@/src/backend/net/retry';
import type { AvailablePhoneNumber, PhoneProvisioningService } from '@/src/backend/services/phone-provisioning/types';

type TelnyxAvailableNumber = {
  id?: string;
  phone_number?: string;
  locality?: string;
  administrative_area?: string;
  country_code?: string;
  monthly_cost?: string;
};

type TelnyxNumberSearchResponse = {
  data?: TelnyxAvailableNumber[];
};

type TelnyxNumberOrderResponse = {
  data?: {
    id?: string;
    phone_numbers?: Array<{
      id?: string;
      phone_number?: string;
    }>;
  };
};

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export class TelnyxPhoneProvisioningService implements PhoneProvisioningService {
  constructor(
    private readonly apiKey: string,
    private readonly connectionId: string,
    private readonly messagingProfileId: string,
  ) {}

  async searchAvailableNumbers(params: {
    countryCode: string;
    locality?: string;
    administrativeArea?: string;
    limit?: number;
  }): Promise<AvailablePhoneNumber[]> {
    const limit = Math.max(1, Math.min(params.limit ?? 12, 30));
    const query = toQueryString({
      'filter[country_code]': params.countryCode.toUpperCase(),
      'filter[features]': 'sms,voice',
      'filter[locality]': params.locality,
      'filter[administrative_area]': params.administrativeArea,
      'filter[limit]': limit,
    });
    const url = `https://api.telnyx.com/v2/available_phone_numbers?${query}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`telnyx_available_phone_numbers_failed:${response.status}:${bodyText}`);
    }

    const parsed = (await response.json()) as TelnyxNumberSearchResponse;
    const numbers = parsed.data ?? [];
    return numbers
      .map((item) => ({
        phoneNumber: item.phone_number ?? '',
        locality: item.locality,
        administrativeArea: item.administrative_area,
        countryCode: item.country_code,
        monthlyCost: item.monthly_cost,
      }))
      .filter((item) => item.phoneNumber.length > 0);
  }

  async provisionNumber(params: {
    phoneNumber: string;
    requestId: string;
  }): Promise<{
    phoneNumber: string;
    providerNumberId?: string;
    orderId?: string;
  }> {
    const log = withLogContext({
      provider: 'telnyx',
      requestId: params.requestId,
    });

    const response = await retryAsync(
      async (attempt) => {
        const res = await fetch('https://api.telnyx.com/v2/number_orders', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `rb-number-order:${params.requestId}:${params.phoneNumber}`,
          },
          body: JSON.stringify({
            phone_numbers: [{ phone_number: params.phoneNumber }],
            connection_id: this.connectionId,
            messaging_profile_id: this.messagingProfileId,
          }),
        });
        if (!res.ok && isRetryableHttpStatus(res.status)) {
          const error = new Error(`telnyx_retryable_status:${res.status}`) as Error & { retryable?: boolean };
          error.retryable = true;
          log.warn({ status: res.status, attempt }, 'telnyx_phone_order_retryable_error');
          throw error;
        }
        return res;
      },
      {
        retries: RETRY_POLICIES.telnyxCall.retries,
        initialDelayMs: RETRY_POLICIES.telnyxCall.initialDelayMs,
        maxDelayMs: RETRY_POLICIES.telnyxCall.maxDelayMs,
        shouldRetry: (error) => Boolean((error as { retryable?: boolean })?.retryable),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text();
      log.error({ status: response.status, bodyText }, 'telnyx_phone_order_failed');
      throw new Error(`telnyx_phone_order_failed:${response.status}`);
    }

    const parsed = (await response.json()) as TelnyxNumberOrderResponse;
    const ordered =
      parsed.data?.phone_numbers?.find((item) => item.phone_number === params.phoneNumber) ?? parsed.data?.phone_numbers?.[0];
    return {
      phoneNumber: ordered?.phone_number ?? params.phoneNumber,
      providerNumberId: ordered?.id,
      orderId: parsed.data?.id,
    };
  }
}
