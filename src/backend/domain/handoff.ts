/** Handoff session status — see migration 0025_handoff_sessions.sql */
export type HandoffSessionStatus =
  | 'handoff_requested'
  | 'owner_dialing'
  | 'owner_ringing'
  | 'owner_answered'
  | 'owner_screening_playing'
  | 'owner_dtmf_waiting'
  | 'owner_accepted'
  | 'bridge_requested'
  | 'bridged'
  | 'handoff_completed'
  | 'handoff_failed_no_parent_call'
  | 'handoff_failed_no_owner_phone'
  | 'handoff_failed_not_allowed'
  | 'handoff_failed_owner_no_answer'
  | 'handoff_failed_owner_busy'
  | 'handoff_failed_owner_rejected'
  | 'handoff_failed_owner_timeout'
  | 'handoff_failed_dtmf_timeout'
  | 'handoff_failed_dtmf_rejected'
  | 'handoff_failed_bridge_error'
  | 'handoff_failed_caller_hung_up'
  | 'handoff_failed_duplicate';

export const HANDOFF_TERMINAL_STATUSES: ReadonlySet<HandoffSessionStatus> = new Set<HandoffSessionStatus>([
  'handoff_completed',
  'handoff_failed_no_parent_call',
  'handoff_failed_no_owner_phone',
  'handoff_failed_not_allowed',
  'handoff_failed_owner_no_answer',
  'handoff_failed_owner_busy',
  'handoff_failed_owner_rejected',
  'handoff_failed_owner_timeout',
  'handoff_failed_dtmf_timeout',
  'handoff_failed_dtmf_rejected',
  'handoff_failed_bridge_error',
  'handoff_failed_caller_hung_up',
  'handoff_failed_duplicate',
]);

export type HandoffSessionRecord = {
  id: string;
  shopId: string;
  rbCallId: string;
  idempotencyKey: string;
  parentCallControlId: string;
  parentCallSessionId: string | null;
  ownerCallControlId: string | null;
  openaiCallId: string | null;
  ownerPhone: string;
  callerPhone: string | null;
  callerName: string | null;
  reason: string;
  urgency: string;
  summary: string;
  serviceRequested: string | null;
  preferredTime: string | null;
  status: HandoffSessionStatus;
  failedReason: string | null;
  errorMessage: string | null;
  dtmfRetryCount: number;
  fallbackSmsSent: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};
