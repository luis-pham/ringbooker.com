import type { TransferResult } from '@/src/backend/domain/types';

export interface TelephonyService {
  transferLiveCallToUser(params: {
    shopId: string;
    userPhone: string;
    roomName: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<TransferResult>;

  createOutboundCall(params: {
    shopId: string;
    to: string;
    from: string;
    purpose: 'reminder' | 'callback';
    requestId: string;
    idempotencyKey: string;
    roomName?: string;
  }): Promise<{ providerCallId?: string }>;
}
