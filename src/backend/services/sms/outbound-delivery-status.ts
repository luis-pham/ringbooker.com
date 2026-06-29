export const FINAL_OUTBOUND_SMS_STATUSES = new Set([
  'delivered',
  'delivery_failed',
  'send_failed',
  'sending_failed',
  'delivery_unconfirmed',
  'unknown',
]);

export type OutboundDeliveryStatusMutation =
  | {
      kind: 'status';
      status: string;
      submittedAt?: Date | null;
      deliveredAt?: Date | null;
      failedAt?: Date | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    }
  | { kind: 'payload_only' }
  | { kind: 'ignored_downgrade' };

export function isFinalOutboundSmsStatus(status: string | null | undefined): boolean {
  return status ? FINAL_OUTBOUND_SMS_STATUSES.has(status) : false;
}

export function buildOutboundDeliveryStatusMutation(params: {
  currentStatus: string;
  eventType: string;
  telnyxStatus: string | null;
  occurredAt: Date | null;
  completedAt: Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): OutboundDeliveryStatusMutation {
  const eventType = params.eventType.toLowerCase();
  const telnyxStatus = params.telnyxStatus?.toLowerCase() ?? null;
  const occurredAt = params.occurredAt ?? null;
  const completedAt = params.completedAt ?? null;
  const finalTime = completedAt ?? occurredAt ?? new Date();

  if (eventType === 'message.sent') {
    if (isFinalOutboundSmsStatus(params.currentStatus)) return { kind: 'ignored_downgrade' };
    return {
      kind: 'status',
      status: 'submitted',
      submittedAt: occurredAt ?? new Date(),
      errorCode: null,
      errorMessage: null,
      failedAt: null,
    };
  }

  if (eventType !== 'message.finalized') {
    return { kind: 'payload_only' };
  }

  if (telnyxStatus === 'delivered') {
    return {
      kind: 'status',
      status: 'delivered',
      deliveredAt: finalTime,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  if (telnyxStatus === 'delivery_failed') {
    if (params.currentStatus === 'delivered') return { kind: 'ignored_downgrade' };
    return {
      kind: 'status',
      status: 'delivery_failed',
      failedAt: finalTime,
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ?? null,
    };
  }

  if (telnyxStatus === 'sending_failed') {
    if (params.currentStatus === 'delivered') return { kind: 'ignored_downgrade' };
    return {
      kind: 'status',
      status: 'send_failed',
      failedAt: finalTime,
      errorCode: params.errorCode ?? null,
      errorMessage: params.errorMessage ?? null,
    };
  }

  if (telnyxStatus === 'delivery_unconfirmed') {
    if (params.currentStatus === 'delivered') return { kind: 'ignored_downgrade' };
    return {
      kind: 'status',
      status: 'delivery_unconfirmed',
    };
  }

  if (telnyxStatus === 'sent') {
    if (isFinalOutboundSmsStatus(params.currentStatus)) return { kind: 'ignored_downgrade' };
    return {
      kind: 'status',
      status: 'submitted',
      submittedAt: occurredAt ?? new Date(),
      errorCode: null,
      errorMessage: null,
      failedAt: null,
    };
  }

  if (telnyxStatus === 'queued' || telnyxStatus === 'sending') {
    if (isFinalOutboundSmsStatus(params.currentStatus)) return { kind: 'ignored_downgrade' };
    return { kind: 'payload_only' };
  }

  if (isFinalOutboundSmsStatus(params.currentStatus)) return { kind: 'ignored_downgrade' };
  return {
    kind: 'status',
    status: 'unknown',
  };
}
