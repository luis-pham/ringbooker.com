import type { AgentToolContext } from '@/src/agent/tools/types';
import type { BookingDraft } from '@/src/agent/booking/booking-draft';
import { summarizeBookingDraftForLog } from '@/src/agent/booking/booking-draft';
import { normalizePhoneForStorage } from '@/lib/phone-number';

export type BookingActionGuardDecision =
  | {
      allowed: true;
      backendDecision: 'execute_business_tool';
      reason: BookingActionGuardReasonCode;
    }
  | {
      allowed: false;
      backendDecision: 'action_guard_blocked' | 'confirmation_required' | 'incomplete_follow_up_required';
      reason: BookingActionGuardReasonCode;
      messageForAi: string;
      missingFields?: string[];
    };

export type BookingActionGuardReasonCode =
  | 'action_guard_allowed'
  | 'no_booking_draft_evidence'
  | 'booking_intent_required'
  | 'booking_required_fields_missing'
  | 'phone_incomplete'
  | 'time_candidate_low_confidence'
  | 'confirmation_required'
  | 'booking_action_not_completed'
  | 'link_action_not_completed'
  | 'handoff_action_not_completed'
  | 'partial_booking_cannot_end_as_unknown'
  | 'handoff_summary_required';

export type BookingActionGuardState = {
  createBookingCompleted: boolean;
  bookingLinkSent: boolean;
  callbackScheduled: boolean;
  handoffStarted: boolean;
  transferStarted: boolean;
  lastBlockedAction?: {
    toolName: string;
    reason: BookingActionGuardReasonCode;
    missingFields?: string[];
    at: string;
  };
};

type ToolInputRecord = Record<string, unknown>;
type BlockedBackendDecision = Extract<BookingActionGuardDecision, { allowed: false }>['backendDecision'];

const SENSITIVE_BOOKING_TOOLS = new Set([
  'create_booking',
  'send_booking_link',
  'schedule_callback',
  'end_call',
  'request_human_handoff',
  'transfer_to_user',
]);

export function createBookingActionGuardState(): BookingActionGuardState {
  return {
    createBookingCompleted: false,
    bookingLinkSent: false,
    callbackScheduled: false,
    handoffStarted: false,
    transferStarted: false,
  };
}

function asRecord(input: unknown): ToolInputRecord {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as ToolInputRecord : {};
}

function stringField(input: ToolInputRecord, field: string): string {
  const value = input[field];
  return typeof value === 'string' ? value.trim() : '';
}

function hasDraftEvidence(draft: BookingDraft | null | undefined): draft is BookingDraft {
  return Boolean(draft && draft.rawTranscriptEvidence.length > 0);
}

function hasUsableCallerPhone(ctx: AgentToolContext): boolean {
  const trimmed = ctx.callerPhone?.trim();
  if (!trimmed) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 8;
}

function hasCompleteOrTrustedPhone(ctx: AgentToolContext, draft: BookingDraft): boolean {
  if (draft.phoneCaptureActive) return false;
  if (draft.phoneDigits.length > 0 && draft.phoneDigits.length < 10) return false;
  if (draft.phoneDigits.length >= 10) return draft.phoneConfirmed;
  return hasUsableCallerPhone(ctx);
}

function hasCallerNameEvidence(draft: BookingDraft, input: ToolInputRecord): boolean {
  return Boolean(
    stringField(input, 'customerName') ||
    stringField(input, 'callerName') ||
    stringField(input, 'caller_name') ||
    (draft.callerNameCandidates.length > 0 && (draft.confidence.callerName ?? 0) >= 0.55),
  );
}

function hasServiceEvidence(draft: BookingDraft, input: ToolInputRecord): boolean {
  return Boolean(
    stringField(input, 'service') ||
    stringField(input, 'serviceInterest') ||
    stringField(input, 'service_requested') ||
    (draft.serviceCandidates.length > 0 && (draft.confidence.service ?? 0) >= 0.55),
  );
}

function hasDateEvidence(draft: BookingDraft, input: ToolInputRecord): boolean {
  return Boolean(stringField(input, 'date') || draft.dateCandidates.length > 0);
}

function hasTimeEvidence(draft: BookingDraft, input: ToolInputRecord): boolean {
  return Boolean(stringField(input, 'time') || draft.timeCandidates.length > 0);
}

function bookingMissingFields(ctx: AgentToolContext, draft: BookingDraft, input: ToolInputRecord): string[] {
  const missing: string[] = [];
  if (!hasServiceEvidence(draft, input)) missing.push('service');
  if (!hasDateEvidence(draft, input)) missing.push('date');
  if (!hasTimeEvidence(draft, input)) missing.push('time');
  if (!hasCompleteOrTrustedPhone(ctx, draft)) missing.push('phone');
  if (!hasCallerNameEvidence(draft, input)) missing.push('callerName');
  return missing;
}

function missingFieldsMessage(missingFields: string[]): string {
  const readable = missingFields
    .map((field) => {
      if (field === 'callerName') return 'caller name';
      return field;
    })
    .join(', ');
  return `Do not create or close the booking yet. Ask for the missing detail(s): ${readable}.`;
}

function blocked(
  backendDecision: BlockedBackendDecision,
  reason: Exclude<BookingActionGuardReasonCode, 'action_guard_allowed' | 'no_booking_draft_evidence'>,
  messageForAi: string,
  missingFields?: string[],
): BookingActionGuardDecision {
  return {
    allowed: false,
    backendDecision,
    reason,
    messageForAi,
    ...(missingFields && missingFields.length > 0 ? { missingFields } : {}),
  };
}

function allowed(reason: BookingActionGuardReasonCode = 'action_guard_allowed'): BookingActionGuardDecision {
  return {
    allowed: true,
    backendDecision: 'execute_business_tool',
    reason,
  };
}

function guardCreateBooking(ctx: AgentToolContext, draft: BookingDraft, input: ToolInputRecord): BookingActionGuardDecision {
  if (draft.intent !== 'book_appointment') {
    return blocked(
      'confirmation_required',
      'booking_intent_required',
      'Ask the caller to confirm they want to book an appointment before creating a booking.',
    );
  }

  if ((draft.confidence.time ?? 0) > 0 && (draft.confidence.time ?? 0) < 0.55) {
    return blocked(
      'confirmation_required',
      'time_candidate_low_confidence',
      'The appointment time is low confidence. Confirm the time with the caller before creating the booking.',
      ['time'],
    );
  }

  if (draft.phoneDigits.length >= 10 && !draft.phoneConfirmed) {
    return blocked(
      'confirmation_required',
      'confirmation_required',
      'Read back the phone number and wait for the caller to confirm it before creating the booking.',
      ['phone'],
    );
  }

  const missingFields = bookingMissingFields(ctx, draft, input);
  if (draft.phoneCaptureActive || (draft.phoneDigits.length > 0 && draft.phoneDigits.length < 10)) {
    return blocked(
      'confirmation_required',
      'phone_incomplete',
      'The caller started giving a phone number but it is incomplete. Read back the digits you have and ask for the complete number before creating a booking.',
      ['phone'],
    );
  }

  if (missingFields.length > 0) {
    return blocked(
      'confirmation_required',
      'booking_required_fields_missing',
      missingFieldsMessage(missingFields),
      missingFields,
    );
  }

  return allowed();
}

function guardSendBookingLink(ctx: AgentToolContext, draft: BookingDraft, input: ToolInputRecord): BookingActionGuardDecision {
  void input;
  if (draft.intent !== 'book_appointment') {
    return blocked(
      'confirmation_required',
      'booking_intent_required',
      'Ask the caller if they want the booking link before sending it.',
    );
  }

  if (draft.phoneCaptureActive || (draft.phoneDigits.length > 0 && draft.phoneDigits.length < 10)) {
    return blocked(
      'confirmation_required',
      'phone_incomplete',
      'The caller started giving a phone number but it is incomplete. Confirm the complete phone number before sending a booking link.',
      ['phone'],
    );
  }

  if (draft.phoneDigits.length >= 10 && !draft.phoneConfirmed) {
    return blocked(
      'confirmation_required',
      'confirmation_required',
      'Read back the phone number and wait for the caller to confirm it before sending a booking link.',
      ['phone'],
    );
  }

  if (!hasUsableCallerPhone(ctx) && draft.phoneDigits.length < 10) {
    return blocked(
      'confirmation_required',
      'booking_required_fields_missing',
      'Ask for the best phone number before sending a booking link.',
      ['phone'],
    );
  }

  return allowed();
}

function guardScheduleCallback(ctx: AgentToolContext, draft: BookingDraft): BookingActionGuardDecision {
  if (draft.phoneCaptureActive || (draft.phoneDigits.length > 0 && draft.phoneDigits.length < 10)) {
    return blocked(
      'confirmation_required',
      'phone_incomplete',
      'The caller started giving a phone number but it is incomplete. Confirm the complete phone number before recording follow-up.',
      ['phone'],
    );
  }

  if (draft.phoneDigits.length >= 10 && !draft.phoneConfirmed) {
    return blocked(
      'confirmation_required',
      'confirmation_required',
      'Read back the phone number and wait for the caller to confirm it before recording follow-up.',
      ['phone'],
    );
  }

  if (!hasUsableCallerPhone(ctx) && draft.phoneDigits.length < 10) {
    return blocked(
      'confirmation_required',
      'booking_required_fields_missing',
      'Ask for the best phone number before recording follow-up.',
      ['phone'],
    );
  }

  return allowed();
}

function guardEndCall(ctx: AgentToolContext, draft: BookingDraft, input: ToolInputRecord): BookingActionGuardDecision {
  const reason = stringField(input, 'reason') || 'other';
  const state = ctx.actionGuard ?? createBookingActionGuardState();

  if (reason === 'booking_completed' && !state.createBookingCompleted) {
    return blocked(
      'action_guard_blocked',
      'booking_action_not_completed',
      'Do not end the call as booking completed because no successful booking tool result exists. Continue the booking flow or offer follow-up.',
    );
  }

  if (reason === 'link_sent' && !state.bookingLinkSent) {
    return blocked(
      'action_guard_blocked',
      'link_action_not_completed',
      'Do not end the call as link sent because no successful booking-link tool result exists. Send the link or offer follow-up first.',
    );
  }

  if (reason === 'handoff_initiated' && !state.handoffStarted && !state.transferStarted) {
    return blocked(
      'action_guard_blocked',
      'handoff_action_not_completed',
      'Do not end the call as handoff initiated because no live handoff has started. Follow the handoff tool result and continue with fallback capture if needed.',
    );
  }

  if (reason === 'callback_scheduled' && !state.callbackScheduled) {
    return blocked(
      'action_guard_blocked',
      'booking_action_not_completed',
      'Do not end the call as callback scheduled because no follow-up request has been recorded. Record follow-up first.',
    );
  }

  if (draft.intent === 'book_appointment' && !state.createBookingCompleted && !state.bookingLinkSent && !state.callbackScheduled) {
    if ((draft.confidence.time ?? 0) > 0 && (draft.confidence.time ?? 0) < 0.55) {
      return blocked(
        'confirmation_required',
        'time_candidate_low_confidence',
        'Do not end the call yet. Confirm the appointment time or offer owner follow-up for the incomplete booking request.',
        ['time'],
      );
    }

    const missingFields = bookingMissingFields(ctx, draft, input);
    if (missingFields.length > 0 && ['other', 'question_answered', 'booking_completed', 'link_sent'].includes(reason)) {
      return blocked(
        'incomplete_follow_up_required',
        'partial_booking_cannot_end_as_unknown',
        `${missingFieldsMessage(missingFields)} If the caller cannot provide it after two attempts, create an incomplete follow-up path instead of ending as unknown.`,
        missingFields,
      );
    }
  }

  return allowed();
}

function guardHandoff(input: ToolInputRecord): BookingActionGuardDecision {
  const reason = stringField(input, 'reason');
  const summary = stringField(input, 'summary');
  if (['ai_uncertain', 'complex_booking', 'pricing_or_policy_uncertain', 'other'].includes(reason) && summary.length < 12) {
    return blocked(
      'confirmation_required',
      'handoff_summary_required',
      'Add a short, specific summary of why the caller needs the team before attempting handoff.',
    );
  }
  return allowed();
}

export function evaluateBookingActionGuard(
  ctx: AgentToolContext,
  toolName: string,
  toolInput: unknown,
): BookingActionGuardDecision {
  if (!SENSITIVE_BOOKING_TOOLS.has(toolName)) return allowed();

  const draft = ctx.bookingDraft;
  if (!hasDraftEvidence(draft)) return allowed('no_booking_draft_evidence');

  const input = asRecord(toolInput);
  switch (toolName) {
    case 'create_booking':
      return guardCreateBooking(ctx, draft, input);
    case 'send_booking_link':
      return guardSendBookingLink(ctx, draft, input);
    case 'schedule_callback':
      return guardScheduleCallback(ctx, draft);
    case 'end_call':
      return guardEndCall(ctx, draft, input);
    case 'request_human_handoff':
    case 'transfer_to_user':
      return guardHandoff(input);
    default:
      return allowed();
  }
}

export function buildActionGuardBlockedToolOutput(decision: Extract<BookingActionGuardDecision, { allowed: false }>): string {
  return JSON.stringify({
    success: false,
    error: decision.messageForAi,
    code: 'ACTION_GUARD_BLOCKED',
    backendDecision: decision.backendDecision,
    reason: decision.reason,
    missingFields: decision.missingFields ?? [],
    message_for_ai: decision.messageForAi,
  });
}

export function markBookingActionGuardToolResult(ctx: AgentToolContext, toolName: string, outputJson: string): void {
  const state = ctx.actionGuard ?? createBookingActionGuardState();
  ctx.actionGuard = state;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(outputJson) as Record<string, unknown>;
  } catch {
    parsed = null;
  }
  if (!parsed) return;

  if (toolName === 'create_booking' && parsed.success === true) {
    state.createBookingCompleted = true;
  }
  if (toolName === 'send_booking_link' && parsed.success === true) {
    state.bookingLinkSent = true;
  }
  if (toolName === 'schedule_callback' && parsed.success === true) {
    state.callbackScheduled = true;
  }
  if (toolName === 'request_human_handoff' && parsed.success === true && parsed.handoff_started === true) {
    state.handoffStarted = true;
  }
  if (toolName === 'transfer_to_user' && parsed.success === true) {
    state.transferStarted = true;
  }
}

export function applyConfirmedBookingDraftPhone(ctx: AgentToolContext): string | null {
  const draft = ctx.bookingDraft;
  if (!draft?.phoneConfirmed || draft.phoneDigits.length < 10) return null;

  const rawDigits = draft.phoneDigits.join('');
  const normalized = normalizePhoneForStorage(rawDigits, ctx.shop.country_code) ?? rawDigits;
  if (!normalized || normalized === ctx.callerPhone) return null;

  ctx.callerPhone = normalized;
  return normalized;
}

export function recordBookingActionGuardBlocked(
  ctx: AgentToolContext,
  toolName: string,
  decision: Extract<BookingActionGuardDecision, { allowed: false }>,
  now: Date = new Date(),
): void {
  const state = ctx.actionGuard ?? createBookingActionGuardState();
  ctx.actionGuard = state;
  state.lastBlockedAction = {
    toolName,
    reason: decision.reason,
    missingFields: decision.missingFields,
    at: now.toISOString(),
  };
}

export function summarizeBookingActionGuardForLog(ctx: AgentToolContext): Record<string, unknown> {
  const state = ctx.actionGuard ?? createBookingActionGuardState();
  return {
    createBookingCompleted: state.createBookingCompleted,
    bookingLinkSent: state.bookingLinkSent,
    callbackScheduled: state.callbackScheduled,
    handoffStarted: state.handoffStarted,
    transferStarted: state.transferStarted,
    lastBlockedAction: state.lastBlockedAction ?? null,
    bookingDraft: summarizeBookingDraftForLog(ctx.bookingDraft),
  };
}
