import type { TelephonyService } from '@/src/backend/services/telephony/types';

export class NoopTelephonyService implements TelephonyService {
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
