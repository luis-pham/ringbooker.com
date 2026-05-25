import { logger } from '@/src/backend/observability/logger';

type BridgeGreetingKey = string;

type BridgeGreetingState = {
  bridgeReady: boolean;
  greetingSent: boolean;
  greetingPending: boolean;
  pendingGreetingPayload: unknown | null;
  sendPendingGreeting: (() => void) | null;
  rbCallId?: string | null;
  shopId?: string | null;
  parentCallControlId: string;
  openaiLegCallControlId: string;
  sentBy: 'bridge_ready' | 'immediate' | null;
};

const sessions = new Map<BridgeGreetingKey, BridgeGreetingState>();
const callControlIndex = new Map<string, BridgeGreetingKey>();

export function makeBridgeGreetingKey(parentCallControlId: string, openaiLegCallControlId: string): BridgeGreetingKey {
  return `${parentCallControlId}:${openaiLegCallControlId}`;
}

function indexSession(key: BridgeGreetingKey, state: BridgeGreetingState): void {
  callControlIndex.set(state.parentCallControlId, key);
  callControlIndex.set(state.openaiLegCallControlId, key);
}

export function initializeBridgeGreetingSession(params: {
  parentCallControlId: string;
  openaiLegCallControlId: string;
  rbCallId?: string | null;
  shopId?: string | null;
}): BridgeGreetingKey {
  const key = makeBridgeGreetingKey(params.parentCallControlId, params.openaiLegCallControlId);
  const existing = sessions.get(key);
  if (existing) {
    existing.rbCallId = params.rbCallId ?? existing.rbCallId;
    existing.shopId = params.shopId ?? existing.shopId;
    indexSession(key, existing);
    return key;
  }

  const state: BridgeGreetingState = {
    bridgeReady: false,
    greetingSent: false,
    greetingPending: false,
    pendingGreetingPayload: null,
    sendPendingGreeting: null,
    rbCallId: params.rbCallId ?? null,
    shopId: params.shopId ?? null,
    parentCallControlId: params.parentCallControlId,
    openaiLegCallControlId: params.openaiLegCallControlId,
    sentBy: null,
  };
  sessions.set(key, state);
  indexSession(key, state);
  return key;
}

function findSessionKey(params: {
  parentCallControlId?: string | null;
  openaiLegCallControlId?: string | null;
  callControlId?: string | null;
  peerCallControlId?: string | null;
}): BridgeGreetingKey | null {
  if (params.parentCallControlId && params.openaiLegCallControlId) {
    const exact = makeBridgeGreetingKey(params.parentCallControlId, params.openaiLegCallControlId);
    if (sessions.has(exact)) return exact;
  }

  for (const candidate of [params.callControlId, params.peerCallControlId, params.parentCallControlId, params.openaiLegCallControlId]) {
    if (!candidate) continue;
    const key = callControlIndex.get(candidate);
    if (key && sessions.has(key)) return key;
  }

  return null;
}

function sendGreetingForState(key: BridgeGreetingKey, state: BridgeGreetingState, sentBy: 'bridge_ready' | 'immediate'): void {
  if (state.greetingSent) {
    logger.info(
      {
        rbCallId: state.rbCallId ?? undefined,
        shopId: state.shopId ?? undefined,
        parentCallControlId: state.parentCallControlId,
        openaiLegCallControlId: state.openaiLegCallControlId,
        sentBy: state.sentBy,
      },
      'openai_sip_greeting_skipped_already_sent',
    );
    return;
  }

  state.greetingSent = true;
  state.greetingPending = false;
  state.sentBy = sentBy;
  const send = state.sendPendingGreeting;
  state.sendPendingGreeting = null;
  state.pendingGreetingPayload = null;

  if (!send) return;
  send();

  if (sentBy === 'bridge_ready') {
    logger.info(
      {
        rbCallId: state.rbCallId ?? undefined,
        shopId: state.shopId ?? undefined,
        parentCallControlId: state.parentCallControlId,
        openaiLegCallControlId: state.openaiLegCallControlId,
      },
      'openai_sip_greeting_sent_after_bridge_ready',
    );
  }
}

export function queueGreetingUntilBridgeReady(params: {
  parentCallControlId: string;
  openaiLegCallControlId: string;
  rbCallId?: string | null;
  shopId?: string | null;
  pendingGreetingPayload: unknown;
  sendGreeting: () => void;
}): 'sent_immediately' | 'queued' | 'already_sent' {
  const key = initializeBridgeGreetingSession(params);
  const state = sessions.get(key);
  if (!state) return 'queued';

  state.rbCallId = params.rbCallId ?? state.rbCallId;
  state.shopId = params.shopId ?? state.shopId;

  if (state.greetingSent) {
    logger.info(
      {
        rbCallId: state.rbCallId ?? undefined,
        shopId: state.shopId ?? undefined,
        parentCallControlId: state.parentCallControlId,
        openaiLegCallControlId: state.openaiLegCallControlId,
      },
      'openai_sip_greeting_skipped_already_sent',
    );
    return 'already_sent';
  }

  state.pendingGreetingPayload = params.pendingGreetingPayload;
  state.sendPendingGreeting = params.sendGreeting;

  if (state.bridgeReady) {
    sendGreetingForState(key, state, 'immediate');
    return 'sent_immediately';
  }

  state.greetingPending = true;
  logger.info(
    {
      rbCallId: state.rbCallId ?? undefined,
      shopId: state.shopId ?? undefined,
      parentCallControlId: state.parentCallControlId,
      openaiLegCallControlId: state.openaiLegCallControlId,
    },
    'openai_sip_greeting_queued_waiting_for_bridge',
  );

  return 'queued';
}

export function markBridgeReadyForGreeting(params: {
  parentCallControlId?: string | null;
  openaiLegCallControlId?: string | null;
  callControlId?: string | null;
  peerCallControlId?: string | null;
}): 'ready' | 'sent' | 'already_sent' | 'not_found' {
  const key = findSessionKey(params);
  if (!key) return 'not_found';
  const state = sessions.get(key);
  if (!state) return 'not_found';

  state.bridgeReady = true;
  if (state.greetingSent) {
    logger.info(
      {
        rbCallId: state.rbCallId ?? undefined,
        shopId: state.shopId ?? undefined,
        parentCallControlId: state.parentCallControlId,
        openaiLegCallControlId: state.openaiLegCallControlId,
      },
      'openai_sip_greeting_skipped_already_sent',
    );
    return 'already_sent';
  }

  if (state.greetingPending && state.sendPendingGreeting) {
    sendGreetingForState(key, state, 'bridge_ready');
    return 'sent';
  }

  return 'ready';
}

export function cleanupBridgeGreetingSessionByCallControlId(callControlId: string | null | undefined): void {
  if (!callControlId) return;
  const key = callControlIndex.get(callControlId);
  if (!key) return;
  const state = sessions.get(key);
  if (!state) return;
  logger.info(
    {
      rbCallId: state.rbCallId ?? undefined,
      shopId: state.shopId ?? undefined,
      parentCallControlId: state.parentCallControlId,
      openaiLegCallControlId: state.openaiLegCallControlId,
      bridgeReady: state.bridgeReady,
      greetingSent: state.greetingSent,
      greetingPending: state.greetingPending,
      sentBy: state.sentBy,
    },
    'openai_sip_greeting_session_final_state',
  );
  sessions.delete(key);
  callControlIndex.delete(state.parentCallControlId);
  callControlIndex.delete(state.openaiLegCallControlId);
}
