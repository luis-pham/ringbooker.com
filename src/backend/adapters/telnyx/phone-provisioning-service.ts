import { telnyxHttpFailureIsRetryable } from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import {
  getTelnyxProvisioningOrderTimeoutMs,
  getTelnyxProvisioningSearchTimeoutMs,
} from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { withLogContext } from '@/src/backend/observability/logger';
import { RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
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

type TelnyxNumberReleaseResponse = {
  data?: {
    id?: string;
    phone_number?: string;
    status?: string;
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
    const httpResult = await telnyxHttpJson({
      method: 'GET',
      path: `available_phone_numbers?${query}`,
      timeoutMs: getTelnyxProvisioningSearchTimeoutMs(),
      operation: 'phone_numbers.search',
      apiKey: this.apiKey,
    });

    const parsed = httpResult.parsedJson as TelnyxNumberSearchResponse;
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

    let httpResult;
    try {
      httpResult = await retryAsync(
        async () =>
          telnyxHttpJson({
            method: 'POST',
            path: 'number_orders',
            body: {
              phone_numbers: [{ phone_number: params.phoneNumber }],
              connection_id: this.connectionId,
              messaging_profile_id: this.messagingProfileId,
            },
            extraHeaders: { 'Idempotency-Key': `rb-number-order:${params.requestId}:${params.phoneNumber}` },
            timeoutMs: getTelnyxProvisioningOrderTimeoutMs(),
            operation: 'number_orders.create',
            apiKey: this.apiKey,
            correlation: { requestId: params.requestId },
          }),
        {
          retries: RETRY_POLICIES.telnyxCall.retries,
          initialDelayMs: RETRY_POLICIES.telnyxCall.initialDelayMs,
          maxDelayMs: RETRY_POLICIES.telnyxCall.maxDelayMs,
          shouldRetry: telnyxHttpFailureIsRetryable,
        },
      );
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
      log.error({ status, err }, 'telnyx_phone_order_failed');
      throw new Error(`telnyx_phone_order_failed:${status ?? 'unknown'}`);
    }

    const parsed = httpResult.parsedJson as TelnyxNumberOrderResponse;
    const ordered =
      parsed.data?.phone_numbers?.find((item) => item.phone_number === params.phoneNumber) ?? parsed.data?.phone_numbers?.[0];
    return {
      phoneNumber: ordered?.phone_number ?? params.phoneNumber,
      providerNumberId: ordered?.id,
      orderId: parsed.data?.id,
    };
  }

  async releaseNumber(params: {
    phoneNumber: string;
    providerNumberId?: string;
    orderId?: string;
    reason: string;
  }): Promise<void> {
    const log = withLogContext({
      provider: 'telnyx',
      requestId: params.orderId,
    });

    try {
      if (params.providerNumberId) {
        const result = await telnyxHttpJson({
          method: 'DELETE',
          path: `phone_numbers/${encodeURIComponent(params.providerNumberId)}`,
          timeoutMs: getTelnyxProvisioningOrderTimeoutMs(),
          operation: 'phone_numbers.delete',
          apiKey: this.apiKey,
          correlation: {
            requestId: params.orderId,
            purpose: 'forwarding_number_compensation_release',
          },
        });
        const parsed = result.parsedJson as TelnyxNumberReleaseResponse | null;
        log.info(
          {
            httpStatus: result.status,
            releasedPhoneNumber: parsed?.data?.phone_number ?? params.phoneNumber,
            releaseStatus: parsed?.data?.status ?? null,
          },
          'telnyx_phone_number_released',
        );
        return;
      }

      await telnyxHttpJson({
        method: 'POST',
        path: 'phone_numbers/jobs/delete_phone_numbers',
        body: {
          phone_numbers: [params.phoneNumber],
        },
        timeoutMs: getTelnyxProvisioningOrderTimeoutMs(),
        operation: 'phone_numbers.jobs.delete_phone_numbers',
        apiKey: this.apiKey,
        correlation: {
          requestId: params.orderId,
          purpose: 'forwarding_number_compensation_release',
        },
      });
      log.info({ releasedPhoneNumberLast4: params.phoneNumber.slice(-4) }, 'telnyx_phone_number_release_job_created');
    } catch (err: unknown) {
      const status =
        err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
      log.error({ status, err }, 'telnyx_phone_number_release_failed');
      throw new Error(`telnyx_phone_number_release_failed:${status ?? 'unknown'}`);
    }
  }
}
