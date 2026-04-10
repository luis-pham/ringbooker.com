import { SipClient } from 'livekit-server-sdk';

import { withLogContext } from '@/src/backend/observability/logger';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { isRetryableHttpStatus, RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
import { retryAsync } from '@/src/backend/net/retry';

type TelnyxCallCreateResponse = {
  data?: {
    call_control_id?: string;
  };
};

export class TelnyxTelephonyService implements TelephonyService {
  private readonly sipClient: SipClient | null;

  constructor(
    private readonly apiKey: string,
    private readonly appId: string,
    private readonly options?: {
      livekitUrl?: string;
      livekitApiKey?: string;
      livekitApiSecret?: string;
      sipOutboundTrunkId?: string;
    },
  ) {
    if (options?.livekitUrl && options.livekitApiKey && options.livekitApiSecret) {
      this.sipClient = new SipClient(options.livekitUrl, options.livekitApiKey, options.livekitApiSecret);
      return;
    }
    this.sipClient = null;
  }

  private get sipOutboundTrunkId(): string | null {
    const value = this.options?.sipOutboundTrunkId?.trim();
    return value && value.length > 0 ? value : null;
  }

  async transferLiveCallToUser(params: {
    shopId: string;
    userPhone: string;
    roomName: string;
    reason: string;
    idempotencyKey: string;
  }) {
    const log = withLogContext({
      shopId: params.shopId,
      provider: 'telnyx',
    });

    if (!this.sipClient || !this.sipOutboundTrunkId) {
      log.warn(
        {
          roomName: params.roomName,
          reason: params.reason,
        },
        'livekit_sip_transfer_not_configured_fallback_voicemail',
      );
      return {
        initiated: false,
        target: 'voicemail' as const,
      };
    }

    try {
      const participant = await this.sipClient.createSipParticipant(this.sipOutboundTrunkId, params.userPhone, params.roomName, {
        participantIdentity: `rb-transfer-${params.shopId}-${Date.now()}`,
        participantName: 'User',
        displayName: 'User',
        participantAttributes: {
          rb_shop_id: params.shopId,
          rb_reason: params.reason,
          rb_transfer: 'true',
        },
        waitUntilAnswered: false,
      });

      log.info(
        {
          roomName: params.roomName,
          userPhone: params.userPhone,
          participantIdentity: participant.participantIdentity,
        },
        'livekit_sip_transfer_started',
      );

      return {
        initiated: true,
        target: 'user' as const,
        providerCallId: participant.participantIdentity,
      };
    } catch (error) {
      log.error(
        {
          err: error,
          roomName: params.roomName,
          userPhone: params.userPhone,
        },
        'livekit_sip_transfer_failed',
      );
      return {
        initiated: false,
        target: 'voicemail' as const,
      };
    }
  }

  async createOutboundCall(params: {
    shopId: string;
    to: string;
    from: string;
    purpose: 'reminder' | 'callback';
    requestId: string;
    idempotencyKey: string;
    roomName?: string;
  }): Promise<{ providerCallId?: string }> {
    const log = withLogContext({
      requestId: params.requestId,
      shopId: params.shopId,
      provider: 'telnyx',
    });

    if (params.roomName && this.sipClient && this.sipOutboundTrunkId) {
      try {
        log.info(
          {
            purpose: params.purpose,
            roomName: params.roomName,
            to: params.to,
            from: params.from,
          },
          'livekit_sip_outbound_call_started',
        );
        const participant = await this.sipClient.createSipParticipant(this.sipOutboundTrunkId, params.to, params.roomName, {
          fromNumber: params.from,
          participantIdentity: `rb-${params.purpose}-${params.requestId}`,
          participantName: 'Customer',
          displayName: params.to,
          participantAttributes: {
            rb_shop_id: params.shopId,
            rb_request_id: params.requestId,
            rb_call_purpose: params.purpose,
          },
          waitUntilAnswered: true,
          playDialtone: true,
          ringingTimeout: 45,
          maxCallDuration: 20 * 60,
          krispEnabled: true,
          headers: {
            'X-RingBooker-Request-Id': params.requestId,
            'X-RingBooker-Purpose': params.purpose,
          },
        });

        log.info(
          {
            purpose: params.purpose,
            roomName: params.roomName,
            participantIdentity: participant.participantIdentity,
          },
          'livekit_sip_outbound_call_answered',
        );

        return { providerCallId: participant.participantIdentity };
      } catch (error) {
        log.error(
          {
            err: error,
            purpose: params.purpose,
            roomName: params.roomName,
          },
          'livekit_sip_outbound_call_failed',
        );
        throw new Error('livekit_sip_outbound_call_failed');
      }
    }

    if (params.roomName && (!this.sipClient || !this.sipOutboundTrunkId)) {
      log.warn(
        {
          purpose: params.purpose,
          roomName: params.roomName,
        },
        'livekit_sip_not_configured_falling_back_telnyx_call_api',
      );
    }

    const response = await retryAsync(
      async (attempt) => {
        const res = await fetch('https://api.telnyx.com/v2/calls', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': params.idempotencyKey,
          },
          body: JSON.stringify({
            connection_id: this.appId,
            to: params.to,
            from: params.from,
          }),
        });
        if (!res.ok && isRetryableHttpStatus(res.status)) {
          const error = new Error(`telnyx_retryable_status:${res.status}`) as Error & { retryable?: boolean };
          error.retryable = true;
          log.warn({ status: res.status, attempt, purpose: params.purpose }, 'telnyx_call_retryable_error');
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
      log.error(
        {
          status: response.status,
          purpose: params.purpose,
          bodyText,
        },
        'telnyx_outbound_call_failed',
      );
      throw new Error(`telnyx_outbound_call_failed:${response.status}`);
    }

    const data = (await response.json()) as TelnyxCallCreateResponse;
    const providerCallId = data.data?.call_control_id;

    log.info(
      {
        purpose: params.purpose,
        providerCallId,
      },
      'telnyx_outbound_call_created',
    );

    return { providerCallId };
  }
}
