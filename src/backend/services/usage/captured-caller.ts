import type { CallSummaryNextAction } from '@/src/backend/ports/repositories';

type CapturedCallLike = {
  provider?: string | null;
  callerPhone?: string | null;
  transcriptText?: string | null;
  demoLiveState?: string | null;
  outcome?: string | null;
  summaryServiceRequest?: string | null;
  summaryNextAction?: CallSummaryNextAction | null;
  summaryCallerQuestion?: string | null;
  summaryCallerName?: string | null;
  summaryPreferredTech?: string | null;
  summaryPreferredDatetime?: string | null;
  summaryFollowUpRequired?: boolean | null;
};

const ACTIONS_THAT_CAPTURE: CallSummaryNextAction[] = [
  'booking_created',
  'booking_link_sent',
  'callback_scheduled',
  'cancellation_requested',
  'reschedule_requested',
  'escalated',
];

export function isProductionLiveCall(call: CapturedCallLike): boolean {
  const provider = call.provider ?? '';
  if (provider.includes('demo')) return false;
  if (provider.includes('test')) return false;
  if (call.demoLiveState && call.demoLiveState !== 'preparing') return false;
  if (call.outcome === 'error' || call.outcome === 'missed') return false;
  return true;
}

export function getCapturedCallerReason(call: CapturedCallLike): string | null {
  if (!isProductionLiveCall(call)) return null;
  if (call.summaryCallerName?.trim()) return 'caller_name';
  if (call.summaryServiceRequest?.trim()) return 'service_request';
  if (call.summaryPreferredDatetime?.trim()) return 'preferred_datetime';
  if (call.summaryPreferredTech?.trim()) return 'preferred_tech';
  if (call.summaryCallerQuestion?.trim()) return 'caller_question';
  if (call.summaryFollowUpRequired) return 'follow_up_required';
  if (call.summaryNextAction && ACTIONS_THAT_CAPTURE.includes(call.summaryNextAction)) return `next_action:${call.summaryNextAction}`;
  const transcript = call.transcriptText?.trim() ?? '';
  if (transcript.length >= 120 && call.callerPhone?.trim()) return 'meaningful_transcript';
  return null;
}

export function isCapturedCaller(call: CapturedCallLike): boolean {
  return Boolean(getCapturedCallerReason(call));
}
