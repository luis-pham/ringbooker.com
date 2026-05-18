import { SipClient } from 'livekit-server-sdk';

import { withLogContext } from '@/src/backend/observability/logger';
import { incrementMetric } from '@/src/backend/observability/metrics';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import type { HandoffSessionsRepository, JobsRepository } from '@/src/backend/ports/repositories';
import { dialOwnerFromParentCall } from '@/src/backend/services/calls/handoff-call-control';
import { isTelnyxCallControlDryRunEnv } from '@/src/backend/webhooks/telnyx-call-control';
import { telnyxHttpFailureIsRetryable } from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';
import { resolveTelnyxOutboundCallsConnectionId } from '@/src/backend/adapters/telnyx/telnyx-outbound-connection-id';
import { getTelnyxCallsCreateTimeoutMs } from '@/src/backend/adapters/telnyx/telnyx-timeouts';
import { RETRY_POLICIES } from '@/src/backend/net/provider-retry-policy';
import { retryAsync } from '@/src/backend/net/retry';
import {
  evaluateOwnerHandoffDestination,
  logBlockedOwnerHandoffDestination,
} from '@/src/backend/services/calls/destination-policy';

type TelnyxCallCreateResponse = {
  data?: {
    call_control_id?: string;
  };
};

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export class TelnyxTelephonyService implements TelephonyService {
  private readonly sipClient: SipClient | null;

  async requestHumanHandoffViaCallControl(params: {
    shopId: string;
    parentCallControlId: string;
    openAiLegCallControlId?: string;
    ownerPhone: string;
    ownerPhoneVerified?: boolean;
    shopCountryCode?: string | null;
    inboundDid: string;
    rbCallId: string;
    reason: string;
    urgency: string;
    summary: string;
    callerPhone: string;
    callerName?: string;
    serviceRequested?: string;
    preferredTime?: string;
    idempotencyKey: string;
  }) {
    const log = withLogContext({
      shopId: params.shopId,
      provider: 'telnyx',
      requestId: params.rbCallId,
    });

    const handoffRepo = this.options?.handoffSessionsRepository;
    const jobsRepo = this.options?.jobsRepository;

    if (!handoffRepo) {
      log.warn({ rbCallId: params.rbCallId, shopId: params.shopId }, 'handoff_sessions_repository_unconfigured');
      return {
        started: false,
        failureCode: 'handoff_repo_unconfigured',
        messageForAi:
          "I wasn't able to start a live handoff on this deployment. I can make sure the team gets your message.",
      };
    }

    if (isTelnyxCallControlDryRunEnv()) {
      log.info(
        { parentCallControlId: params.parentCallControlId, rbCallId: params.rbCallId, shopId: params.shopId },
        'telnyx_handoff_dry_run',
      );
      incrementMetric('handoff_requested_total', { shopId: params.shopId, dry_run: 'true' });
      return {
        started: true,
        dryRun: true,
        handoffId: 'dry-run',
        messageForAi: 'Let me try to reach the team now.',
      };
    }

    const resolvedConn = resolveTelnyxOutboundCallsConnectionId(log);
    if (!resolvedConn) {
      log.warn({ rbCallId: params.rbCallId, shopId: params.shopId }, 'telnyx_owner_leg_connection_id_unresolved');
      return {
        started: false,
        failureCode: 'telnyx_connection_id_misconfigured',
        messageForAi:
          "I wasn't able to complete the transfer setup. I can make sure the team gets your message.",
      };
    }
    const connectionId = resolvedConn.connectionId;
    const fromDid = params.inboundDid?.trim();
    if (!fromDid || !fromDid.startsWith('+')) {
      log.warn({ rbCallId: params.rbCallId }, 'handoff_inbound_did_missing');
      return {
        started: false,
        failureCode: 'missing_inbound_did',
        messageForAi:
          "I wasn't able to complete the transfer setup. I can make sure the team gets your message.",
      };
    }

    const destination = evaluateOwnerHandoffDestination({
      shop: {
        id: params.shopId,
        country_code: params.shopCountryCode ?? 'US',
        sms_owner_opted_in: params.ownerPhoneVerified === true,
      },
      ownerPhone: params.ownerPhone,
    });
    if (!destination.ok) {
      logBlockedOwnerHandoffDestination({
        shopId: params.shopId,
        rbCallId: params.rbCallId,
        reason: destination.reason,
      });
      return {
        started: false,
        failureCode: `destination_policy_${destination.reason}`,
        messageForAi:
          "I couldn't reach the team on the phone right now. I'll make sure they get your message after this call.",
      };
    }
    const ownerE164 = destination.e164;

    const active = await handoffRepo.findActiveByRbCallId(params.shopId, params.rbCallId);
    if (active) {
      incrementMetric('handoff_duplicate_request_total', { shopId: params.shopId });
      log.info(
        { handoffId: active.id, rbCallId: params.rbCallId, parentCallControlId: params.parentCallControlId },
        'telnyx_handoff_duplicate_in_flight',
      );
      return {
        started: true,
        handoffId: active.id,
        duplicate: true,
        messageForAi: 'Let me try to reach the team now.',
      };
    }

    const idempotencyKey = `handoff:${params.rbCallId}:${params.reason}:${params.ownerPhone}`;

    const session = await handoffRepo.create({
      shopId: params.shopId,
      rbCallId: params.rbCallId,
      idempotencyKey,
      parentCallControlId: params.parentCallControlId,
      ownerPhone: ownerE164,
      callerPhone: params.callerPhone,
      callerName: params.callerName ?? null,
      reason: params.reason,
      urgency: params.urgency,
      summary: params.summary,
      serviceRequested: params.serviceRequested ?? null,
      preferredTime: params.preferredTime ?? null,
      status: 'handoff_requested',
    });
    if (params.openAiLegCallControlId?.trim()) {
      await handoffRepo.update(session.id, { openaiCallId: params.openAiLegCallControlId.trim() });
    }

    await handoffRepo.update(session.id, { status: 'owner_dialing' });
    incrementMetric('handoff_requested_total', { shopId: params.shopId });

    log.info(
      {
        parentCallControlId: params.parentCallControlId,
        rbCallId: params.rbCallId,
        handoffId: session.id,
        urgency: params.urgency,
        openaiLegCallControlId: params.openAiLegCallControlId ?? null,
      },
      'telnyx_call_control_create_owner_leg_started',
    );

    const result = await dialOwnerFromParentCall({
      parentCallControlId: params.parentCallControlId,
      ownerE164,
      fromDidE164: fromDid,
      connectionId,
      apiKey: this.apiKey,
      rbCallId: params.rbCallId,
      shopId: params.shopId,
      handoffId: session.id,
      reason: params.reason,
      urgency: params.urgency,
      callerPhone: params.callerPhone,
      inboundDid: params.inboundDid,
      fetchImpl: this.options?.testingTelnyxFetch,
    });

    if (result.ok) {
      if (result.ownerDialCallControlId) {
        await handoffRepo.update(session.id, { ownerCallControlId: result.ownerDialCallControlId });
      }
      log.info(
        {
          parentCallControlId: params.parentCallControlId,
          ownerLegCallControlId: result.ownerDialCallControlId ?? null,
          rbCallId: params.rbCallId,
          shopId: params.shopId,
          handoffId: session.id,
        },
        'telnyx_call_control_create_owner_leg_succeeded',
      );
      incrementMetric('handoff_owner_dial_started_total', { shopId: params.shopId });
      return { started: true, handoffId: session.id, ownerDialCallControlId: result.ownerDialCallControlId };
    }

    log.warn(
      {
        status: result.status,
        body: result.text,
        handoffId: session.id,
        parentCallControlId: params.parentCallControlId,
        telnyx_duration_ms: result.durationMs,
        errorKind: result.errorKind,
      },
      'telnyx_call_control_create_owner_leg_failed',
    );

    await handoffRepo.update(session.id, {
      status: 'handoff_failed_bridge_error',
      failedReason: 'owner_dial_http',
      errorMessage: `${result.status}`,
      completedAt: new Date(),
    });

    if (jobsRepo) {
      try {
        await jobsRepo.enqueue({
          shopId: params.shopId,
          type: 'handoff_failed_owner_sms',
          payload: {
            rbCallId: params.rbCallId,
            handoffId: session.id,
            summary: params.summary,
            reason: params.reason,
            urgency: params.urgency,
            callerPhone: params.callerPhone,
            failureCode: `dial_http_${result.status}`,
          },
          runAt: new Date(),
          idempotencyKey: `handoff_failed_owner_summary:${params.rbCallId}:${session.id}`,
        });
      } catch (err) {
        log.warn({ err, shopId: params.shopId, rbCallId: params.rbCallId }, 'handoff_failed_owner_sms_enqueue_after_dial_fail');
      }
    }

    return {
      started: false,
      failureCode: `dial_http_${result.status}`,
      handoffId: session.id,
      messageForAi:
        "I couldn't reach the team on the phone right now. I'll make sure they get your message after this call.",
    };
  }

  constructor(
    private readonly apiKey: string,
    private readonly appId: string,
    private readonly options?: {
      livekitUrl?: string;
      livekitApiKey?: string;
      livekitApiSecret?: string;
      sipOutboundTrunkId?: string;
      handoffSessionsRepository?: HandoffSessionsRepository;
      jobsRepository?: JobsRepository;
      /** Test double for Call Control HTTP (handoff dial). */
      testingTelnyxFetch?: typeof fetch;
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
          krispEnabled: parseBooleanEnv(process.env.LIVEKIT_SIP_KRISP_ENABLED, false),
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

    let httpResult;
    try {
      httpResult = await retryAsync(
        async () =>
          telnyxHttpJson({
            method: 'POST',
            path: 'calls',
            body: {
              connection_id: this.appId,
              to: params.to,
              from: params.from,
            },
            extraHeaders: { 'Idempotency-Key': params.idempotencyKey },
            timeoutMs: getTelnyxCallsCreateTimeoutMs(),
            operation: 'calls.create',
            apiKey: this.apiKey,
            correlation: {
              shopId: params.shopId,
              purpose: params.purpose,
              requestId: params.requestId,
            },
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
      log.error(
        {
          status,
          purpose: params.purpose,
          err,
        },
        'telnyx_outbound_call_failed',
      );
      throw new Error(`telnyx_outbound_call_failed:${status ?? 'unknown'}`);
    }

    const data = httpResult.parsedJson as TelnyxCallCreateResponse;
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
