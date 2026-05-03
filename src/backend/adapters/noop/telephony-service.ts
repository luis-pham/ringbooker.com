import type { TelephonyService } from '@/src/backend/services/telephony/types';

export class NoopTelephonyService implements TelephonyService {
  async requestHumanHandoffViaCallControl(params: {
    shopId: string;
    parentCallControlId: string;
    openAiLegCallControlId?: string;
    ownerPhone: string;
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
    void params;
    return { started: false, failureCode: 'noop_telephony' };
  }

  async transferLiveCallToUser(params: {
    shopId: string;
    userPhone: string;
    roomName: string;
    reason: string;
    idempotencyKey: string;
  }) {
    void params;
    return {
      initiated: false,
      target: 'voicemail' as const,
    };
  }

  async createOutboundCall(params: {
    shopId: string;
    to: string;
    from: string;
    purpose: 'reminder' | 'callback';
    requestId: string;
    idempotencyKey: string;
    roomName?: string;
  }) {
    void params;
    return {
      providerCallId: undefined,
    };
  }
}
