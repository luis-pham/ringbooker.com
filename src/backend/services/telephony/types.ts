import type { TransferResult } from '@/src/backend/domain/types';

export type HumanHandoffCallControlResult = {
  started: boolean;
  /** Telnyx leg id for the owner dial when HTTP succeeded (optional). */
  ownerDialCallControlId?: string;
  failureCode?: string;
  messageForAi?: string;
  /** Persisted session id when handoff state machine is wired. */
  handoffId?: string;
  /** Same AI-initiated handoff already in progress for this call. */
  duplicate?: boolean;
  /** `TELNYX_CALL_CONTROL_DRY_RUN=true` — no owner dial, no DB row. */
  dryRun?: boolean;
};

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

  /**
   * Owner handoff via Telnyx Call Control (outbound owner leg + bridge). Not used for LiveKit room transfers.
   * No-op implementations should return `{ started: false }`.
   */
  requestHumanHandoffViaCallControl(params: {
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
  }): Promise<HumanHandoffCallControlResult>;
}
