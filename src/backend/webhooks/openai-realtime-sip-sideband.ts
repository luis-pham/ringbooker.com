import WebSocket from 'ws';

import { getSipShopToolNameSet } from '@/src/agent/sip/sip-tool-definitions';
import type {
  AppointmentTimePrePopulateAttempt,
  AppointmentTimePrePopulateResult,
  AvailabilityCheckPrePopulateResult,
} from '@/src/agent/sip/sip-tool-executor';
import { getEnv } from '@/src/backend/config/env';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';
import { logger } from '@/src/backend/observability/logger';
import {
  buildDirectWebDemoClientSecretAudioInput,
  buildOpenAiSipAcceptAudioInputFromEnv,
} from '@/src/backend/webhooks/openai-sip-accept-payload';
import { queueGreetingUntilBridgeReady } from '@/src/backend/webhooks/openai-sip-bridge-greeting-coordinator';

function compactToolOutput(output: string): string {
  return output.length > 8000 ? `${output.slice(0, 8000)}…` : output;
}

function parseToolOutputObject(output: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(output) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export type OpenAiRealtimeSipSidebandParams =
  | {
      variant: 'demo';
      callId: string;
      apiKey: string;
      /** When false, only connect briefly then close (smoke / reduced surface). */
      enableToolLoop: boolean;
      /** Explicit first-turn instruction so SIP demo speaks before caller audio. */
      initialResponseInstructions?: string | null;
      /** When set, used for accepted-to-first-response timing. */
      acceptedAtMs?: number;
      /** Called when the sideband WS closes (call ended or dropped) — used to cancel duration timers. */
      onEnded?: () => void;
      /** Called for each completed transcript segment (AI speech or caller speech). Fire-and-forget. */
      onTranscript?: (speaker: 'caller' | 'assistant', text: string) => void;
      /**
       * Called when the AI invokes the `end_call` tool and the goodbye audio buffer has stopped.
       * Caller is responsible for issuing the hangup (Telnyx) so the call terminates cleanly.
       */
      onEndCall?: () => void;
    }
  | {
      variant: 'shop';
      callId: string;
      apiKey: string;
      executeBusinessTool: (toolName: string, argsJson: string) => Promise<string>;
      /** One short greeting instruction for first `response.create` (shop welcome or default). */
      initialResponseInstructions?: string | null;
      /**
       * Production Call Control path: delay first greeting until Telnyx confirms parent ↔ OpenAI bridge readiness.
       * Demo/TeXML calls do not set this gate.
       */
      initialResponseBridgeGate?: {
        parentCallControlId: string;
        openaiLegCallControlId: string;
        rbCallId?: string | null;
        shopId?: string | null;
      };
      /** When set, used for `openai_accepted_to_initial_response_ms` after first greeting send. */
      acceptedAtMs?: number;
      /** Called for each completed transcript segment (AI speech or caller speech). Fire-and-forget. */
      onTranscript?: (speaker: 'caller' | 'assistant', text: string) => void;
      /** Called when the WS successfully opens (useful for reconnect attempt tracking). */
      onConnected?: () => void;
      /**
       * Called when the WS closes with an unexpected code (not 1000/1001) after at least one
       * successful open — signals that the AI session dropped mid-call rather than ended cleanly.
       */
      onWsDropped?: (closeCode: number) => void;
      /**
       * If set, inject a wrap-up system message into the AI session at this offset from WS open.
       * Uses `conversation.item.create` + `response.create` so it doesn't replace the full prompt.
       */
      softLimitMs?: number;
      softLimitInstruction?: string;
      /**
       * If set, call `onHardLimit` at this offset from WS open.
       * Caller is responsible for playing a goodbye message and hanging up.
       */
      hardLimitMs?: number;
      onHardLimit?: () => void;
      /**
       * Called when the AI invokes the `end_call` tool and the goodbye audio buffer has stopped.
       * Caller is responsible for issuing the hangup command (after this fires, audio is done).
       */
      onEndCall?: () => void;
      /**
       * Called when a caller utterance contains a recognizable appointment time (explicit AM/PM)
       * and the sideband needs backend validation evidence before responding.
       *
       * Fires the raw transcript so the server can pre-populate
       * `ctx.appointmentTimeValidation.latest`, then the sideband injects that validation
       * result directly into the Realtime conversation for a single low-latency response.
       * Best-effort: guards still enforce validation before any booking action.
       */
      onCallerTranscriptPrePopulate?: (
        transcript: string,
      ) =>
        | AppointmentTimePrePopulateAttempt
        | AppointmentTimePrePopulateResult
        | Promise<AppointmentTimePrePopulateResult | null>
        | null
        | void;
      /**
       * Called synchronously after a valid appointment-time prepopulate result is ready.
       * The owner may start an availability prefetch and keep the promise outside sideband.
       */
      onValidationPrePopulateComplete?: (result: AppointmentTimePrePopulateResult) => void;
      /**
       * Called immediately before `response.create` on the direct validation path.
       * Must enforce its own short timeout budget and return only already-safe evidence.
       */
      onBeforeResponseCreate?: () => Promise<{ availabilityResult: AvailabilityCheckPrePopulateResult | null }>;
      /**
       * Called on VAD `speech_stopped`, before transcription completes.
       * Used only for safe, already-known session state prefetches.
       */
      onCallerSpeechStopped?: () => void;
    };

/**
 * Sideband: connect to Realtime WS for an accepted SIP call on the same `call_id`.
 * OpenAI Realtime SIP does not speak until a client sends `response.create` on this socket
 * (see Realtime SIP guide — WebSocket monitor section).
 * Demo: handles `demo_noop` only. Shop: runs shared booking tools via `executeBusinessTool`.
 *
 * SIP demo accept sets `audio.input.turn_detection.create_response: false` so VAD does not answer before the
 * sideband `response.create` greeting; after that greeting finishes we must send `session.update` (same as
 * browser direct demo) or user speech never triggers assistant turns.
 */
const SOFT_LIMIT_WRAP_UP_INSTRUCTION =
  "You must now wrap up the call politely. Say something like: 'Is there anything else I can help you with before we finish?'";
const VALIDATE_APPOINTMENT_TIME_TOOL_NAME = 'validate_appointment_time';
const CHECK_AVAILABILITY_TOOL_NAME = 'check_availability';
const SEND_BOOKING_LINK_TOOL_NAME = 'send_booking_link';
const TIME_VALIDATION_UNAVAILABLE_INSTRUCTION =
  'The backend could not validate that appointment time from the last caller turn. Ask the caller to repeat the appointment date and time. Do not say the time is valid, invalid, available, booked, or captured yet.';
const BOOKING_LINK_FINAL_RESPONSE_INSTRUCTION =
  "The booking link was sent successfully.\nDeliver ONE final message combining confirmation and goodbye. Example:\n'Perfect — booking link sent to your phone. The team will confirm shortly. Thanks for calling, have a great day!'\nThen call end_call immediately.\nDo not say 'One moment' or any separate filler.\nDo not send another message after this one.";
const SIDE_BAND_QUEUE_LIMIT = 3;
const TRANSCRIPTION_TIMEOUT_MS = 2_000;

type SidebandTurnState =
  | 'idle'
  | 'validating_time'
  | 'waiting_model_response'
  | 'executing_tool'
  | 'waiting_audio';

type SidebandTurnMode =
  | 'caller_response'
  | 'direct_validation'
  | 'business_tool'
  | null;

function mentionsBookingFlow(text: string): boolean {
  return /\b(book(?:ing)?|appointment|schedul(?:e|ing)?|reschedul(?:e|ing)?|availability)\b/i.test(text)
    || /\b(?:what|which)\s+(?:date|day|time)\b/i.test(text)
    || /\b(?:date|day)\s+and\s+time\b/i.test(text);
}

function includesSpecificTime(text: string): boolean {
  return /\b\d{1,2}(?::[0-5]\d)?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)\b/i.test(text)
    || /\b(?:noon|midnight)\b/i.test(text)
    || /\b(?:at|around|by)\s+\d{1,2}(?::[0-5]\d)?\b/i.test(text);
}

function isPrePopulateAttempt(value: unknown): value is AppointmentTimePrePopulateAttempt {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'result' in value &&
    (value as { result?: unknown }).result instanceof Promise
  );
}

export function startOpenAiRealtimeSipSideband(
  params: OpenAiRealtimeSipSidebandParams,
  /** @internal test-only: override URL / timing so tests can point at a local server without real env */
  _options?: { wsUrlOverride?: string; greetingDelayMs?: number },
): void {
  const greetingDelayMs = _options?.greetingDelayMs ?? getEnv().OPENAI_SIP_SIDEBAND_GREETING_DELAY_MS ?? 100;
  const timeoutMs = params.variant === 'shop' ? 25 * 60_000 : 45_000;
  const url = _options?.wsUrlOverride ?? `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(params.callId)}`;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
  });

  const t = setTimeout(() => {
    try {
      ws.terminate();
    } catch {
      /* ignore */
    }
  }, timeoutMs);
  t.unref?.();

  let wsOpened = false;
  let softLimitTimer: ReturnType<typeof setTimeout> | null = null;
  let hardLimitTimer: ReturnType<typeof setTimeout> | null = null;
  let initialResponseSent = false;
  let vadResumeAfterWelcomeSent = false;
  let shopVadResumeAfterWelcomeSent = false;
  let shopManualTurnResponseEnabled = false;
  let shopBookingFlowActive = false;
  let initialGreetingAudioStarted = false;
  let initialGreetingAudioStopped = false;
  let sawUserSpeechBeforeInitial = false;
  let lastSpeechStartedAtMs: number | null = null;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSpeechStoppedAtMs: number | null = null;
  let lastTranscriptionCompleteAtMs: number | null = null;
  let lastResponseCreateSentAtMs: number | null = null;
  let lastToolCallReceivedAtMs: number | null = null;
  let lastToolResultSentAtMs: number | null = null;
  let lastAudioResponseStartAtMs: number | null = null;
  let lastOutputAudioBufferStartedAtMs: number | null = null;
  let waitingForAudioResponseStart = false;
  let sidebandTurnState: SidebandTurnState = 'idle';
  let sidebandTurnMode: SidebandTurnMode = null;
  let queuedCallerTranscripts: string[] = [];
  let activeCallerTranscript: string | null = null;
  let activeTurnToken = 0;
  let turnStateTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let currentTurnAudioStarted = false;
  let pendingTranscriptionTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  let timedOutTranscriptionItems = new Set<string>();

  /** Set when AI calls end_call; next output_audio_buffer.stopped triggers onEndCall. */
  let pendingHangupAfterAudio = false;
  /** Set after booking-link final response is requested; audio stop triggers hangup if model skips end_call. */
  let pendingAutoEndAfterFinalAudio = false;
  /** Local idempotency guard; the caller's onEndCall callback also guards Telnyx hangup. */
  let hangupInitiated = false;
  /** Fallback: fire onEndCall after this many ms if output_audio_buffer.stopped never arrives. */
  let pendingHangupFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  function fireOnEndCall(): void {
    if (pendingHangupFallbackTimer) { clearTimeout(pendingHangupFallbackTimer); pendingHangupFallbackTimer = null; }
    pendingHangupAfterAudio = false;
    pendingAutoEndAfterFinalAudio = false;
    if (hangupInitiated) return;
    hangupInitiated = true;
    params.onEndCall?.();
  }

  const needsDemoVadResumeAfterWelcome =
    params.variant === 'demo' && params.enableToolLoop;

  function timingSessionId(): string {
    return params.variant === 'shop'
      ? params.initialResponseBridgeGate?.rbCallId ?? params.callId
      : params.callId;
  }

  function elapsedSince(markMs: number | null, nowMs: number): number | null {
    return markMs === null ? null : nowMs - markMs;
  }

  function logTiming(label: string, fields: Record<string, unknown> = {}, nowMs = Date.now()): void {
    const timestamp = new Date(nowMs).toISOString();
    logger.info(
      {
        callSessionId: timingSessionId(),
        providerCallId: params.callId,
        timestamp,
        ...fields,
      },
      `[TIMING] ${label} at ${timestamp}`,
    );
  }

  type RealtimeTimingEvent = {
    type?: string;
    event_id?: string;
    response_id?: string;
    item_id?: string;
    call_id?: string;
    output_index?: number;
    content_index?: number;
    audio_start_ms?: number;
    audio_end_ms?: number;
    status?: string;
    response?: {
      id?: unknown;
      status?: unknown;
      status_details?: unknown;
    };
    item?: {
      id?: unknown;
      type?: unknown;
      role?: unknown;
      name?: unknown;
    };
    error?: {
      type?: unknown;
      code?: unknown;
      message?: unknown;
    };
  };

  function eventTimingFields(evt: RealtimeTimingEvent, nowMs: number): Record<string, unknown> {
    return {
      eventType: evt.type ?? null,
      eventId: evt.event_id ?? null,
      responseId: evt.response_id ?? (typeof evt.response?.id === 'string' ? evt.response.id : null),
      itemId: evt.item_id ?? (typeof evt.item?.id === 'string' ? evt.item.id : null),
      toolCallId: evt.call_id ?? null,
      outputIndex: typeof evt.output_index === 'number' ? evt.output_index : null,
      contentIndex: typeof evt.content_index === 'number' ? evt.content_index : null,
      audioStartMs: typeof evt.audio_start_ms === 'number' ? evt.audio_start_ms : null,
      audioEndMs: typeof evt.audio_end_ms === 'number' ? evt.audio_end_ms : null,
      status: evt.status ?? (typeof evt.response?.status === 'string' ? evt.response.status : null),
      responseStatusDetails: evt.response?.status_details ?? null,
      itemType: typeof evt.item?.type === 'string' ? evt.item.type : null,
      itemRole: typeof evt.item?.role === 'string' ? evt.item.role : null,
      itemName: typeof evt.item?.name === 'string' ? evt.item.name : null,
      errorType: evt.error?.type ?? null,
      errorCode: evt.error?.code ?? null,
      sidebandTurnState,
      sidebandTurnMode,
      elapsedSinceSpeechStartedMs: elapsedSince(lastSpeechStartedAtMs, nowMs),
      elapsedSinceSpeechStoppedMs: elapsedSince(lastSpeechStoppedAtMs, nowMs),
      elapsedSinceTranscriptionMs: elapsedSince(lastTranscriptionCompleteAtMs, nowMs),
      elapsedSinceResponseCreateMs: elapsedSince(lastResponseCreateSentAtMs, nowMs),
      elapsedSinceToolCallMs: elapsedSince(lastToolCallReceivedAtMs, nowMs),
      elapsedSinceToolResultMs: elapsedSince(lastToolResultSentAtMs, nowMs),
      elapsedSinceAudioResponseStartMs: elapsedSince(lastAudioResponseStartAtMs, nowMs),
      elapsedSinceOutputAudioBufferStartedMs: elapsedSince(lastOutputAudioBufferStartedAtMs, nowMs),
    };
  }

  function logRealtimeTiming(label: string, evt: RealtimeTimingEvent, fields: Record<string, unknown> = {}): void {
    const nowMs = Date.now();
    logTiming(label, { ...eventTimingFields(evt, nowMs), ...fields }, nowMs);
  }

  function realtimeItemId(evt: RealtimeTimingEvent): string | null {
    return evt.item_id ?? (typeof evt.item?.id === 'string' ? evt.item.id : null);
  }

  function clearPendingTranscriptionTimeout(itemId: string | null): void {
    if (!itemId) return;
    const timeout = pendingTranscriptionTimeouts.get(itemId);
    if (!timeout) return;
    clearTimeout(timeout);
    pendingTranscriptionTimeouts.delete(itemId);
  }

  function wasTranscriptionTimedOut(itemId: string | null): boolean {
    if (!itemId || !timedOutTranscriptionItems.has(itemId)) return false;
    timedOutTranscriptionItems.delete(itemId);
    return true;
  }

  function clearAllTranscriptionTimeouts(): void {
    for (const timeout of pendingTranscriptionTimeouts.values()) {
      clearTimeout(timeout);
    }
    pendingTranscriptionTimeouts.clear();
    timedOutTranscriptionItems.clear();
  }

  function startTranscriptionTimeout(itemId: string | null, speechStoppedAtMs: number): void {
    if (!itemId) return;
    clearPendingTranscriptionTimeout(itemId);
    timedOutTranscriptionItems.delete(itemId);

    const timeout = setTimeout(() => {
      pendingTranscriptionTimeouts.delete(itemId);
      timedOutTranscriptionItems.add(itemId);
      logger.warn(
        { callId: params.callId, itemId, timeoutMs: TRANSCRIPTION_TIMEOUT_MS },
        'openai_sip_shop_transcription_timeout_reset_listening',
      );
      sendRealtimeEvent(
        { type: 'conversation.item.delete', item_id: itemId },
        'openai_sip_shop_transcription_timeout_item_delete_failed',
      );
      logTiming(
        'transcription_timeout',
        {
          itemId,
          timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
          elapsedSinceSpeechStoppedMs: elapsedSince(speechStoppedAtMs, Date.now()),
        },
      );
    }, TRANSCRIPTION_TIMEOUT_MS);
    timeout.unref?.();
    pendingTranscriptionTimeouts.set(itemId, timeout);
  }

  function normalizeTranscriptForQueue(transcript: string): string {
    return transcript
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function shouldQueueCallerTranscript(transcript: string): boolean {
    const normalized = normalizeTranscriptForQueue(transcript);
    if (normalized.length < 2) return false;
    const fillers = new Set([
      'hello',
      'hi',
      'hey',
      'what',
      'okay',
      'ok',
      'yeah',
      'yes',
      'yep',
      'no',
      'nope',
      'uh',
      'um',
      'hmm',
      'hm',
      'are you there',
      'still there',
      'nothing',
      'nothing else',
    ]);
    return !fillers.has(normalized);
  }

  function sendRealtimeEvent(payload: Record<string, unknown>, logName: string): boolean {
    if (ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch (err) {
      logger.warn({ err, callId: params.callId }, logName);
      return false;
    }
  }

  function clearTurnStateTimeout(): void {
    if (turnStateTimeoutHandle) {
      clearTimeout(turnStateTimeoutHandle);
      turnStateTimeoutHandle = null;
    }
  }

  function processQueuedTranscript(): void {
    if (sidebandTurnState !== 'idle') return;
    const queued = queuedCallerTranscripts.shift();
    if (!queued) return;
    logTiming('queued_transcript_processed', {
      transcript: queued,
      remainingQueueDepth: queuedCallerTranscripts.length,
    });
    logger.info(
      { callId: params.callId, transcript: queued, remainingQueueDepth: queuedCallerTranscripts.length },
      'openai_sip_shop_queued_transcript_processed',
    );
    createShopResponseForCallerTurn(queued);
  }

  function releaseTurnState(options: { processQueue?: boolean; clearQueue?: boolean } = {}): void {
    clearTurnStateTimeout();
    sidebandTurnState = 'idle';
    sidebandTurnMode = null;
    activeCallerTranscript = null;
    currentTurnAudioStarted = false;
    activeTurnToken += 1;
    if (options.clearQueue) queuedCallerTranscripts = [];
    if (options.processQueue !== false) {
      setImmediate(processQueuedTranscript);
    }
  }

  function startTurnStateTimeout(ms: number, token: number): void {
    clearTurnStateTimeout();
    turnStateTimeoutHandle = setTimeout(() => {
      turnStateTimeoutHandle = null;
      if (token !== activeTurnToken || sidebandTurnState === 'idle') return;
      const timedOutState = sidebandTurnState;
      const timedOutMode = sidebandTurnMode;
      logTiming('turn_state_timeout', {
        state: timedOutState,
        mode: timedOutMode,
        timeoutMs: ms,
      });
      logger.warn(
        { callId: params.callId, state: timedOutState, mode: timedOutMode, timeoutMs: ms },
        'openai_sip_shop_turn_state_timeout',
      );

      if (timedOutState === 'validating_time') {
        const sent = sendShopResponseCreate({
          instructions: TIME_VALIDATION_UNAVAILABLE_INSTRUCTION,
          toolChoice: 'none',
          state: 'waiting_audio',
          mode: 'caller_response',
          timeoutMs: 8_000,
          token,
          forceAppointmentTimeValidation: false,
        });
        if (!sent) releaseTurnState();
        return;
      }

      if (timedOutState === 'executing_tool') {
        // Avoid releasing the lock while a side-effecting booking/SMS tool may still finish.
        startTurnStateTimeout(30_000, token);
        return;
      }

      if (timedOutState === 'waiting_audio' && pendingAutoEndAfterFinalAudio) {
        logger.warn(
          { callId: params.callId, timeoutMs: ms },
          'auto_hangup_after_booking_link_final_audio',
        );
        fireOnEndCall();
        releaseTurnState({ processQueue: false, clearQueue: true });
        return;
      }

      sendRealtimeEvent({ type: 'response.cancel' }, 'openai_sip_shop_turn_timeout_cancel_failed');
      releaseTurnState();
    }, ms);
  }

  function beginTurnState(
    state: SidebandTurnState,
    mode: Exclude<SidebandTurnMode, null>,
    transcript: string | null,
    timeoutMs: number,
  ): number {
    activeTurnToken += 1;
    const token = activeTurnToken;
    sidebandTurnState = state;
    sidebandTurnMode = mode;
    activeCallerTranscript = transcript;
    currentTurnAudioStarted = false;
    startTurnStateTimeout(timeoutMs, token);
    return token;
  }

  function queueCallerTranscriptWhileInFlight(transcript: string): void {
    if (!shouldQueueCallerTranscript(transcript)) {
      logger.info(
        { callId: params.callId, transcript, state: sidebandTurnState },
        'openai_sip_shop_ignored_filler_while_in_flight',
      );
      return;
    }

    const normalized = normalizeTranscriptForQueue(transcript);
    const activeNormalized = activeCallerTranscript ? normalizeTranscriptForQueue(activeCallerTranscript) : '';
    const lastQueuedNormalized = queuedCallerTranscripts.length > 0
      ? normalizeTranscriptForQueue(queuedCallerTranscripts[queuedCallerTranscripts.length - 1] ?? '')
      : '';
    if (normalized === activeNormalized || normalized === lastQueuedNormalized) {
      logger.info(
        { callId: params.callId, transcript, state: sidebandTurnState },
        'openai_sip_shop_ignored_duplicate_while_in_flight',
      );
      return;
    }

    queuedCallerTranscripts.push(transcript);
    if (queuedCallerTranscripts.length > SIDE_BAND_QUEUE_LIMIT) {
      queuedCallerTranscripts = queuedCallerTranscripts.slice(-SIDE_BAND_QUEUE_LIMIT);
    }
    logger.info(
      { callId: params.callId, transcript, state: sidebandTurnState, queueDepth: queuedCallerTranscripts.length },
      'openai_sip_shop_queued_transcript_while_in_flight',
    );
  }

  function generateInjectedValidationCallId(): string {
    return `call_rb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function sendShopResponseCreate(paramsSend: {
    instructions?: string;
    toolChoice?: 'none';
    state: SidebandTurnState;
    mode: Exclude<SidebandTurnMode, null>;
    timeoutMs: number;
    token: number;
    forceAppointmentTimeValidation: boolean;
  }): boolean {
    if (paramsSend.token !== activeTurnToken) return false;
    const response: Record<string, unknown> = {};
    if (paramsSend.instructions) response.instructions = paramsSend.instructions;
    if (paramsSend.toolChoice) response.tool_choice = paramsSend.toolChoice;
    const sent = sendRealtimeEvent(
      {
        type: 'response.create',
        ...(Object.keys(response).length > 0 ? { response } : {}),
      },
      'openai_sip_shop_caller_turn_response_failed',
    );
    if (!sent) return false;

    sidebandTurnState = paramsSend.state;
    sidebandTurnMode = paramsSend.mode;
    startTurnStateTimeout(paramsSend.timeoutMs, paramsSend.token);
    lastResponseCreateSentAtMs = Date.now();
    waitingForAudioResponseStart = true;
    logTiming(
      'response_create_sent',
      {
        forceAppointmentTimeValidation: paramsSend.forceAppointmentTimeValidation,
        elapsedSinceTranscriptionMs: elapsedSince(lastTranscriptionCompleteAtMs, lastResponseCreateSentAtMs),
        elapsedSinceSpeechStoppedMs: elapsedSince(lastSpeechStoppedAtMs, lastResponseCreateSentAtMs),
      },
      lastResponseCreateSentAtMs,
    );
    logger.info(
      { callId: params.callId, forceAppointmentTimeValidation: paramsSend.forceAppointmentTimeValidation },
      'openai_sip_shop_caller_turn_response_created',
    );
    return true;
  }

  async function injectValidationResultAndRespond(
    validation: AppointmentTimePrePopulateResult,
    startedAtMs: number,
    token: number,
  ): Promise<void> {
    if (token !== activeTurnToken || ws.readyState !== WebSocket.OPEN) return;
    const injectStartedAtMs = Date.now();
    logTiming('inject_validation_start', {
      date: validation.date,
      time: validation.time,
      valid: validation.valid,
      elapsedSincePrepopulateStartMs: injectStartedAtMs - startedAtMs,
    }, injectStartedAtMs);

    const callIdTool = generateInjectedValidationCallId();
    const toolInput = { date: validation.date, time: validation.time };
    const toolOutput = {
      success: true,
      valid: validation.valid,
      reason: validation.reason,
      normalizedDatetimeUtc: validation.normalizedDatetimeUtc,
      messageForAi: validation.messageForAi,
    };
    const validationSummaryLines = [
      'The backend has already validated the appointment time for this caller turn.',
      `Requested date: ${validation.date}`,
      `Requested time: ${validation.time}`,
      `Valid: ${validation.valid ? 'yes' : 'no'}`,
      `Reason: ${validation.reason}`,
      `Instruction from backend: ${validation.messageForAi}`,
      'Do not call validate_appointment_time again for this turn. Respond now using this validation result.',
    ];

    const functionCallSent = sendRealtimeEvent(
      {
        type: 'conversation.item.create',
        item: {
          type: 'function_call',
          call_id: callIdTool,
          name: VALIDATE_APPOINTMENT_TIME_TOOL_NAME,
          arguments: JSON.stringify(toolInput),
          status: 'completed',
        },
      },
      'openai_sip_shop_validation_function_call_inject_failed',
    );
    if (!functionCallSent) {
      releaseTurnState();
      return;
    }

    const outputSent = sendRealtimeEvent(
      {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callIdTool,
          output: compactToolOutput(JSON.stringify(toolOutput)),
        },
      },
      'openai_sip_shop_validation_function_output_inject_failed',
    );
    if (!outputSent) {
      releaseTurnState();
      return;
    }

    let availabilityInjected = false;
    if (params.variant === 'shop' && validation.valid) {
      params.onValidationPrePopulateComplete?.(validation);

      let availabilityResult: AvailabilityCheckPrePopulateResult | null = null;
      try {
        availabilityResult = (await params.onBeforeResponseCreate?.())?.availabilityResult ?? null;
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_shop_availability_before_response_failed');
      }
      if (token !== activeTurnToken || ws.readyState !== WebSocket.OPEN) return;

      if (availabilityResult) {
        const availabilityCallId = generateInjectedValidationCallId();
        const availabilityInput = {
          date: availabilityResult.date,
          time: availabilityResult.time,
          service: availabilityResult.service,
          ...(availabilityResult.techName ? { techName: availabilityResult.techName } : {}),
        };
        const availabilityOutput = {
          available: availabilityResult.available,
          ...(availabilityResult.suggestions !== undefined ? { suggestions: availabilityResult.suggestions } : {}),
        };
        const availabilityCallSent = sendRealtimeEvent(
          {
            type: 'conversation.item.create',
            item: {
              type: 'function_call',
              call_id: availabilityCallId,
              name: CHECK_AVAILABILITY_TOOL_NAME,
              arguments: JSON.stringify(availabilityInput),
              status: 'completed',
            },
          },
          'openai_sip_shop_availability_function_call_inject_failed',
        );
        if (!availabilityCallSent) {
          releaseTurnState();
          return;
        }

        const availabilityOutputSent = sendRealtimeEvent(
          {
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: availabilityCallId,
              output: compactToolOutput(JSON.stringify(availabilityOutput)),
            },
          },
          'openai_sip_shop_availability_function_output_inject_failed',
        );
        if (!availabilityOutputSent) {
          releaseTurnState();
          return;
        }

        availabilityInjected = true;
        const injectedAtMs = Date.now();
        validationSummaryLines.push(
          `Availability checked: ${availabilityResult.available ? 'available' : 'not available'}.`,
          'Do not call check_availability again for this turn. Use the injected availability result.',
        );
        logTiming('availability_injected_directly', {
          provider: availabilityResult.providerId,
          service: availabilityResult.service,
          date: availabilityResult.date,
          time: availabilityResult.time,
          available: availabilityResult.available,
          elapsedMs: injectedAtMs - (availabilityResult.prefetchStartedAtMs ?? availabilityResult.fetchedAtMs),
        }, injectedAtMs);
      } else {
        logTiming('availability_not_ready_before_response', {
          date: validation.date,
          time: validation.time,
        });
      }
    }

    lastToolResultSentAtMs = Date.now();
    const responseSent = sendShopResponseCreate({
      instructions: validationSummaryLines.join('\n'),
      toolChoice: (!validation.valid || availabilityInjected) ? 'none' : undefined,
      state: 'waiting_audio',
      mode: 'caller_response',
      timeoutMs: 8_000,
      token,
      forceAppointmentTimeValidation: true,
    });
    const completedAtMs = Date.now();
    logTiming('inject_validation_complete', {
      date: validation.date,
      time: validation.time,
      valid: validation.valid,
      elapsedMs: completedAtMs - injectStartedAtMs,
      responseSent,
    }, completedAtMs);
    if (!responseSent) releaseTurnState();
  }

  function cancelInitialTimer(): void {
    if (initialTimer) {
      clearTimeout(initialTimer);
      initialTimer = null;
    }
  }

  function trySendInitialResponse(): void {
    const instructions = params.initialResponseInstructions?.trim();
    if (initialResponseSent) return;
    if (params.variant === 'shop' && sawUserSpeechBeforeInitial) {
      return;
    }
    logger.info(
      { callId: params.callId, variant: params.variant, hasInstructions: Boolean(instructions) },
      'openai_sip_initial_response_create_started',
    );
    try {
      ws.send(
        JSON.stringify({
          type: 'response.create',
          ...(instructions ? { response: { instructions } } : {}),
        }),
      );
      initialResponseSent = true;
      logger.info({ callId: params.callId, variant: params.variant }, 'openai_sip_initial_response_create_sent');
      incrementMetric('initial_response_create_total', { outcome: 'sent' });
      if (typeof params.acceptedAtMs === 'number') {
        observeDurationMs('openai_accepted_to_initial_response_ms', Date.now() - params.acceptedAtMs, {});
      }
    } catch (err) {
      logger.warn({ err, callId: params.callId, variant: params.variant }, 'openai_sip_initial_response_failed');
      incrementMetric('initial_response_create_total', { outcome: 'failed' });
    }
  }

  function queueOrSendInitialResponse(): void {
    if (params.variant !== 'shop' || !params.initialResponseBridgeGate) {
      trySendInitialResponse();
      return;
    }

    const instructions = params.initialResponseInstructions?.trim();
    queueGreetingUntilBridgeReady({
      ...params.initialResponseBridgeGate,
      pendingGreetingPayload: { instructions: instructions ?? null },
      sendGreeting: trySendInitialResponse,
    });
  }

  function maybeResumeDemoVadAfterWelcome(fromEvent: string): void {
    if (!needsDemoVadResumeAfterWelcome || !initialResponseSent || vadResumeAfterWelcomeSent) return;
    if (ws.readyState !== WebSocket.OPEN) return;

    const { turnDetectionAfterWelcome: td } = buildDirectWebDemoClientSecretAudioInput();
    if (!td || typeof td !== 'object' || Array.isArray(td)) {
      logger.info({ callId: params.callId, fromEvent }, 'openai_sip_demo_vad_resume_skipped_no_turn_detection');
      return;
    }
    if (td.create_response !== true) {
      logger.info(
        { callId: params.callId, fromEvent, create_response: td.create_response },
        'openai_sip_demo_vad_resume_skipped_create_response_off',
      );
      return;
    }

    vadResumeAfterWelcomeSent = true;
    try {
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            audio: {
              input: {
                turn_detection: td,
              },
            },
          },
        }),
      );
      logger.info(
        { callId: params.callId, fromEvent, vadType: (td as { type?: string }).type },
        'openai_sip_demo_vad_resume_sent',
      );
    } catch (err) {
      vadResumeAfterWelcomeSent = false;
      logger.warn({ err, callId: params.callId, fromEvent }, 'openai_sip_demo_vad_resume_send_failed');
    }
  }

  function maybeResumeShopVadAfterWelcome(fromEvent: string): void {
    if (params.variant !== 'shop' || !params.initialResponseBridgeGate || !initialResponseSent || shopVadResumeAfterWelcomeSent) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    const td = buildOpenAiSipAcceptAudioInputFromEnv().turn_detection;
    if (!td || typeof td !== 'object' || Array.isArray(td)) return;

    shopVadResumeAfterWelcomeSent = true;
    try {
      ws.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            audio: {
              input: {
                // Sideband owns shop responses after greeting so it can perform required
                // appointment-time validation before any spoken scheduling decision.
                turn_detection: { ...td, create_response: false },
              },
            },
          },
        }),
      );
      shopManualTurnResponseEnabled = true;
      logger.info({ callId: params.callId, fromEvent }, 'openai_sip_shop_vad_resumed_after_greeting');
    } catch (err) {
      shopVadResumeAfterWelcomeSent = false;
      logger.warn({ err, callId: params.callId, fromEvent }, 'openai_sip_shop_vad_resume_failed');
    }
  }

  function createShopResponseForCallerTurn(transcript: string): void {
    if (params.variant !== 'shop' || !params.initialResponseBridgeGate || !shopManualTurnResponseEnabled) return;
    if (ws.readyState !== WebSocket.OPEN) return;

    if (sidebandTurnState !== 'idle') {
      queueCallerTranscriptWhileInFlight(transcript);
      return;
    }

    const inBookingFlow = shopBookingFlowActive || mentionsBookingFlow(transcript);
    const forceTimeValidation = inBookingFlow && includesSpecificTime(transcript);
    shopBookingFlowActive = inBookingFlow;

    if (forceTimeValidation) {
      const turnToken = beginTurnState('validating_time', 'direct_validation', transcript, 5_000);
      const prePopulateStartedAtMs = Date.now();
      const prePopulateAttempt = params.onCallerTranscriptPrePopulate?.(transcript);
      const prePopulatePreview = isPrePopulateAttempt(prePopulateAttempt) ? prePopulateAttempt.preview : null;
      logTiming(
        'prepopulate_start',
        {
          transcript,
          date: prePopulatePreview?.date ?? null,
          time: prePopulatePreview?.time ?? null,
          elapsedSinceTranscriptionMs: elapsedSince(lastTranscriptionCompleteAtMs, prePopulateStartedAtMs),
          elapsedSinceSpeechStoppedMs: elapsedSince(lastSpeechStoppedAtMs, prePopulateStartedAtMs),
        },
        prePopulateStartedAtMs,
      );
      const prePopulateResult = isPrePopulateAttempt(prePopulateAttempt)
        ? prePopulateAttempt.result
        : prePopulateAttempt;
      void Promise.resolve(prePopulateResult)
        .then((result) => {
          if (turnToken !== activeTurnToken) return;
          const completedAtMs = Date.now();
          if (!result) {
            logTiming(
              'prepopulate_complete',
              {
                elapsedMs: completedAtMs - prePopulateStartedAtMs,
                result: 'error',
              },
              completedAtMs,
            );
            sendShopResponseCreate({
              instructions: TIME_VALIDATION_UNAVAILABLE_INSTRUCTION,
              toolChoice: 'none',
              state: 'waiting_audio',
              mode: 'caller_response',
              timeoutMs: 8_000,
              token: turnToken,
              forceAppointmentTimeValidation: false,
            });
            return;
          }
          logger.info(
            {
              callId: params.callId,
              date: result.date,
              time: result.time,
              timestamp: result.timestamp,
              status: result.status,
              valid: result.valid,
            },
            `prepopulate: appointmentTimeValidation set for ${result.date} ${result.time} at ${result.timestamp}`,
          );
          logTiming(
            'prepopulate_complete',
            {
              date: result.date,
              time: result.time,
              cacheStatus: result.status,
              elapsedMs: completedAtMs - prePopulateStartedAtMs,
              result: result.valid ? 'valid' : 'invalid',
            },
            completedAtMs,
          );
          void injectValidationResultAndRespond(result, prePopulateStartedAtMs, turnToken);
        })
        .catch((err: unknown) => {
          if (turnToken !== activeTurnToken) return;
          const completedAtMs = Date.now();
          logTiming(
            'prepopulate_complete',
            {
              elapsedMs: completedAtMs - prePopulateStartedAtMs,
              result: 'error',
            },
            completedAtMs,
          );
          logger.warn({ err, callId: params.callId }, 'prepopulate: appointmentTimeValidation failed');
          sendShopResponseCreate({
            instructions: TIME_VALIDATION_UNAVAILABLE_INSTRUCTION,
            toolChoice: 'none',
            state: 'waiting_audio',
            mode: 'caller_response',
            timeoutMs: 8_000,
            token: turnToken,
            forceAppointmentTimeValidation: false,
          });
        });
      return;
    }

    const turnToken = beginTurnState('waiting_model_response', 'caller_response', transcript, 8_000);
    const sent = sendShopResponseCreate({
      state: 'waiting_model_response',
      mode: 'caller_response',
      timeoutMs: 8_000,
      token: turnToken,
      forceAppointmentTimeValidation: false,
    });
    if (!sent) releaseTurnState();
  }

  ws.on('open', () => {
    wsOpened = true;
    logger.info(
      { callId: params.callId, variant: params.variant },
      params.variant === 'shop' ? 'openai_sip_sideband_connected' : 'openai_sip_sideband_ws_open',
    );

    if (params.variant === 'shop') {
      params.onConnected?.();

      if (params.softLimitMs) {
        softLimitTimer = setTimeout(() => {
          softLimitTimer = null;
          if (ws.readyState !== WebSocket.OPEN) return;
          const instruction = params.softLimitInstruction?.trim() || SOFT_LIMIT_WRAP_UP_INSTRUCTION;
          try {
            ws.send(
              JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'system',
                  content: [{ type: 'input_text', text: instruction }],
                },
              }),
            );
            ws.send(JSON.stringify({ type: 'response.create' }));
            logger.info({ callId: params.callId }, 'openai_sip_shop_soft_limit_instruction_injected');
          } catch (err) {
            logger.warn({ err, callId: params.callId }, 'openai_sip_shop_soft_limit_inject_failed');
          }
        }, params.softLimitMs);
      }

      if (params.hardLimitMs) {
        hardLimitTimer = setTimeout(() => {
          hardLimitTimer = null;
          pendingAutoEndAfterFinalAudio = false;
          logger.warn({ callId: params.callId }, 'openai_sip_shop_hard_limit_reached');
          params.onHardLimit?.();
        }, params.hardLimitMs);
      }
    }

    if (params.variant === 'demo') {
      if (!params.enableToolLoop) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        return;
      }
      // Brief pause after WS open so SIP media/session can settle (see OPENAI_SIP_SIDEBAND_GREETING_DELAY_MS).
      initialTimer = setTimeout(() => {
        initialTimer = null;
        trySendInitialResponse();
      }, greetingDelayMs);
      return;
    }

    if (params.variant === 'shop' && params.initialResponseBridgeGate) {
      // `call.bridged` is the media-ready gate; do not add a fixed greeting delay on this path.
      queueOrSendInitialResponse();
    } else {
      initialTimer = setTimeout(() => {
        initialTimer = null;
        queueOrSendInitialResponse();
      }, greetingDelayMs);
    }
  });

  ws.on('message', (data) => {
    let evt: RealtimeTimingEvent & { name?: string; arguments?: string; transcript?: string };
    try {
      evt = JSON.parse(String(data)) as typeof evt;
    } catch {
      return;
    }

    if (
      params.variant === 'shop' &&
      !params.initialResponseBridgeGate &&
      evt.type === 'input_audio_buffer.speech_started' &&
      !initialResponseSent
    ) {
      sawUserSpeechBeforeInitial = true;
      cancelInitialTimer();
      logger.info({ callId: params.callId }, 'openai_sip_initial_response_skipped_user_speaking');
      incrementMetric('initial_response_create_total', { outcome: 'skipped_speaking' });
    }

    if (evt.type === 'input_audio_buffer.speech_started') {
      lastSpeechStartedAtMs = Date.now();
      logTiming('input_speech_started', eventTimingFields(evt, lastSpeechStartedAtMs), lastSpeechStartedAtMs);
    }

    if (evt.type === 'input_audio_buffer.speech_stopped') {
      lastSpeechStoppedAtMs = Date.now();
      logTiming('VAD speech_stopped', eventTimingFields(evt, lastSpeechStoppedAtMs), lastSpeechStoppedAtMs);
      if (params.variant === 'shop' && params.initialResponseBridgeGate && shopManualTurnResponseEnabled) {
        startTranscriptionTimeout(realtimeItemId(evt), lastSpeechStoppedAtMs);
        try {
          params.onCallerSpeechStopped?.();
        } catch (err) {
          logger.warn({ err, callId: params.callId }, 'openai_sip_shop_speech_stopped_prefetch_callback_failed');
        }
      }
    }

    if (evt.type === 'response.created') {
      logRealtimeTiming('response_created', evt);
    }

    if (evt.type === 'response.audio.delta' && waitingForAudioResponseStart) {
      lastAudioResponseStartAtMs = Date.now();
      waitingForAudioResponseStart = false;
      logTiming(
        'audio_response_start',
        {
          ...eventTimingFields(evt, lastAudioResponseStartAtMs),
          elapsedSinceResponseCreateMs: elapsedSince(lastResponseCreateSentAtMs, lastAudioResponseStartAtMs),
          elapsedSinceToolResultMs: elapsedSince(lastToolResultSentAtMs, lastAudioResponseStartAtMs),
          elapsedSinceSpeechStoppedMs: elapsedSince(lastSpeechStoppedAtMs, lastAudioResponseStartAtMs),
          totalLatencyMs: elapsedSince(lastSpeechStoppedAtMs, lastAudioResponseStartAtMs),
        },
        lastAudioResponseStartAtMs,
      );
    }

    if (evt.type === 'response.done') {
      logRealtimeTiming('response_done', evt);
    }

    if (
      needsDemoVadResumeAfterWelcome &&
      (evt.type === 'response.done' || evt.type === 'output_audio_buffer.stopped')
    ) {
      maybeResumeDemoVadAfterWelcome(evt.type ?? 'unknown');
    }

    if (params.variant === 'shop' && params.initialResponseBridgeGate && initialResponseSent) {
      if (evt.type === 'output_audio_buffer.started' && !initialGreetingAudioStarted) {
        initialGreetingAudioStarted = true;
        logger.info({ callId: params.callId }, 'openai_sip_initial_greeting_audio_started');
      }
      if (evt.type === 'output_audio_buffer.started') {
        lastOutputAudioBufferStartedAtMs = Date.now();
        logTiming(
          'output_audio_buffer_started',
          eventTimingFields(evt, lastOutputAudioBufferStartedAtMs),
          lastOutputAudioBufferStartedAtMs,
        );
      }
      if (evt.type === 'output_audio_buffer.started' && sidebandTurnState !== 'idle') {
        currentTurnAudioStarted = true;
      }
      if (evt.type === 'output_audio_buffer.started' && lastSpeechStoppedAtMs !== null) {
        const audioSentAtMs = Date.now();
        logTiming(
          'audio_sent_to_caller',
          {
            ...eventTimingFields(evt, audioSentAtMs),
            elapsedSinceAudioStartMs: elapsedSince(lastAudioResponseStartAtMs, audioSentAtMs),
            elapsedSinceResponseCreateMs: elapsedSince(lastResponseCreateSentAtMs, audioSentAtMs),
            elapsedSinceSpeechStoppedMs: elapsedSince(lastSpeechStoppedAtMs, audioSentAtMs),
          },
          audioSentAtMs,
        );
      }
      if (evt.type === 'output_audio_buffer.stopped') {
        logRealtimeTiming('output_audio_buffer_stopped', evt);
      }
      if (evt.type === 'output_audio_buffer.stopped' && !initialGreetingAudioStopped) {
        initialGreetingAudioStopped = true;
        logger.info({ callId: params.callId }, 'openai_sip_initial_greeting_audio_stopped');
        maybeResumeShopVadAfterWelcome(evt.type);
      }
      if (evt.type === 'output_audio_buffer.stopped' && sidebandTurnState !== 'idle') {
        const willAutoEnd = pendingAutoEndAfterFinalAudio;
        releaseTurnState({ processQueue: !willAutoEnd, clearQueue: willAutoEnd });
      }
    }

    if (
      params.variant === 'shop' &&
      params.initialResponseBridgeGate &&
      evt.type === 'response.done' &&
      sidebandTurnState !== 'idle' &&
      !currentTurnAudioStarted &&
      sidebandTurnState !== 'executing_tool'
    ) {
      releaseTurnState();
    }

    if (
      params.variant === 'shop' &&
      params.initialResponseBridgeGate &&
      evt.type === 'error' &&
      sidebandTurnState !== 'idle'
    ) {
      logger.warn({ callId: params.callId, state: sidebandTurnState }, 'openai_sip_shop_response_error_releasing_turn');
      releaseTurnState();
    }

    // Fire onEndCall once the goodbye audio finishes playing.
    if (pendingHangupAfterAudio && evt.type === 'output_audio_buffer.stopped') {
      fireOnEndCall();
    }

    if (pendingAutoEndAfterFinalAudio && evt.type === 'output_audio_buffer.stopped') {
      logger.warn(
        { callId: params.callId },
        'auto_hangup_after_booking_link_final_audio',
      );
      fireOnEndCall();
    }

    // Capture completed transcript segments.
    {
      const transcript = typeof evt.transcript === 'string' ? evt.transcript.trim() : '';
      // GA Realtime emits `response.output_audio_transcript.done`; the legacy
      // `response.audio_transcript.done` is kept as a fallback for beta-mode sessions.
      const speaker: 'assistant' | 'caller' | null =
        evt.type === 'response.output_audio_transcript.done' || evt.type === 'response.audio_transcript.done'
          ? 'assistant'
          : evt.type === 'conversation.item.input_audio_transcription.completed'
            ? 'caller'
            : null;
      if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const itemId = realtimeItemId(evt);
        const timedOut = wasTranscriptionTimedOut(itemId);
        clearPendingTranscriptionTimeout(itemId);
        if (timedOut) {
          logger.warn(
            { callId: params.callId, itemId, transcript },
            'openai_sip_shop_late_transcription_ignored_after_timeout',
          );
          return;
        }
      }

      if (transcript && speaker) {
        const transcriptCompletedAtMs = Date.now();
        if (speaker === 'caller') {
          lastTranscriptionCompleteAtMs = transcriptCompletedAtMs;
          logTiming(
            'transcription_complete',
            {
              ...eventTimingFields(evt, transcriptCompletedAtMs),
              transcript,
              elapsedSinceSpeechStoppedMs: elapsedSince(lastSpeechStoppedAtMs, lastTranscriptionCompleteAtMs),
            },
            lastTranscriptionCompleteAtMs,
          );
        } else {
          logTiming(
            'assistant_transcript_complete',
            {
              ...eventTimingFields(evt, transcriptCompletedAtMs),
              transcript,
              elapsedSinceResponseCreateMs: elapsedSince(lastResponseCreateSentAtMs, transcriptCompletedAtMs),
              elapsedSinceOutputAudioBufferStartedMs: elapsedSince(lastOutputAudioBufferStartedAtMs, transcriptCompletedAtMs),
            },
            transcriptCompletedAtMs,
          );
        }
        // Both shop and demo calls persist the full transcript via the callback.
        params.onTranscript?.(speaker, transcript);
        logger.info(
          {
            callSessionId: params.callId,
            providerCallId: params.callId,
            eventType: evt.type,
            rawUserTranscript: speaker === 'caller' ? transcript : null,
            normalizedUserText: speaker === 'caller' ? transcript.replace(/\s+/g, ' ').trim() : null,
            rawAssistantTranscript: speaker === 'assistant' ? transcript : null,
            reason: speaker === 'caller' ? 'caller_transcript_completed' : 'assistant_transcript_completed',
          },
          'openai_sip_realtime_transcript_event',
        );
        if (params.variant === 'shop' && params.initialResponseBridgeGate) {
          if (speaker === 'assistant' && mentionsBookingFlow(transcript)) {
            shopBookingFlowActive = true;
          } else if (speaker === 'caller') {
            createShopResponseForCallerTurn(transcript);
          }
        }
      }
    }

    if (
      params.variant === 'shop' &&
      params.initialResponseBridgeGate &&
      shopManualTurnResponseEnabled &&
      evt.type === 'conversation.item.input_audio_transcription.failed'
    ) {
      const itemId = realtimeItemId(evt);
      const timedOut = wasTranscriptionTimedOut(itemId);
      clearPendingTranscriptionTimeout(itemId);
      if (timedOut) {
        logger.warn(
          { callId: params.callId, itemId },
          'openai_sip_shop_late_transcription_failure_ignored_after_timeout',
        );
        return;
      }
      logger.warn({ callId: params.callId }, 'openai_sip_shop_caller_transcription_failed_using_unvalidated_response');
      createShopResponseForCallerTurn('');
    }

    if (evt.type !== 'response.function_call_arguments.done') return;

    if (params.variant === 'demo') {
      if (!params.enableToolLoop) return;
      const callIdTool = typeof evt.call_id === 'string' ? evt.call_id : undefined;
      if (!callIdTool) return;

      // end_call: acknowledge, arm the hangup trigger, skip response.create.
      if (evt.name === 'end_call') {
        try {
          ws.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: callIdTool,
                output: compactToolOutput(JSON.stringify({ ok: true })),
              },
            }),
          );
          logger.info({ callId: params.callId }, 'openai_sip_demo_end_call_tool_acknowledged');
        } catch (err) {
          logger.warn({ err, callId: params.callId }, 'openai_sip_demo_end_call_ack_failed');
        }
        if (params.onEndCall) {
          pendingAutoEndAfterFinalAudio = false;
          pendingHangupAfterAudio = true;
          pendingHangupFallbackTimer = setTimeout(fireOnEndCall, 5_000);
        }
        return;
      }

      if (evt.name !== 'demo_noop') return;

      const payload = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callIdTool,
          output: compactToolOutput(JSON.stringify({ ok: true, echo: 'demo_noop_ack' })),
        },
      };
      try {
        ws.send(JSON.stringify(payload));
        ws.send(JSON.stringify({ type: 'response.create' }));
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_tool_reply_failed');
      }
      return;
    }

    const toolName = evt.name;
    if (!toolName || !getSipShopToolNameSet().has(toolName)) return;
    const callIdTool = typeof evt.call_id === 'string' ? evt.call_id : undefined;
    if (!callIdTool) return;

    // end_call: acknowledge immediately, skip response.create (AI already said goodbye),
    // then wait for output_audio_buffer.stopped before triggering the actual hangup.
    if (toolName === 'end_call') {
      try {
        ws.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callIdTool,
              output: compactToolOutput(JSON.stringify({ ok: true })),
            },
          }),
        );
        logger.info(
          {
            callSessionId: params.callId,
            providerCallId: params.callId,
            eventType: 'tool_call',
            proposedTool: toolName,
            backendDecision: 'acknowledged_end_call',
          },
          'openai_sip_tool_decision',
        );
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_end_call_ack_failed');
      }
      if (params.variant === 'shop' && params.onEndCall && !hangupInitiated) {
        pendingAutoEndAfterFinalAudio = false;
        pendingHangupAfterAudio = true;
        // Fallback: if output_audio_buffer.stopped never arrives (e.g., SIP path doesn't emit it),
        // fire onEndCall after 5 s so the call isn't left open indefinitely.
        pendingHangupFallbackTimer = setTimeout(fireOnEndCall, 5_000);
      }
      releaseTurnState({ processQueue: false, clearQueue: true });
      return;
    }

    const argsJson = typeof evt.arguments === 'string' ? evt.arguments : '{}';
    const toolTurnToken = sidebandTurnState === 'idle'
      ? beginTurnState('executing_tool', 'business_tool', null, 30_000)
      : activeTurnToken;
    sidebandTurnState = 'executing_tool';
    sidebandTurnMode = 'business_tool';
    startTurnStateTimeout(30_000, toolTurnToken);
    lastToolCallReceivedAtMs = Date.now();
    logTiming(
      'tool_call_received',
      {
        tool: toolName,
        elapsedSinceResponseCreateMs: elapsedSince(lastResponseCreateSentAtMs, lastToolCallReceivedAtMs),
      },
      lastToolCallReceivedAtMs,
    );
    logger.info(
      {
        callSessionId: params.callId,
        providerCallId: params.callId,
        eventType: 'tool_call',
        proposedTool: toolName,
        backendDecision: 'execute_business_tool',
        toolArgsPreview: argsJson.slice(0, 1000),
      },
      'openai_sip_tool_decision',
    );
    void (async () => {
      let output: string;
      try {
        output = await params.executeBusinessTool(toolName, argsJson);
        logger.info(
          {
            callSessionId: params.callId,
            providerCallId: params.callId,
            eventType: 'tool_result',
            proposedTool: toolName,
            backendDecision: 'tool_executed',
            reason: 'tool_execution_completed',
          },
          'openai_sip_tool_decision',
        );
      } catch (err) {
        logger.warn({ err, callId: params.callId, toolName }, 'openai_sip_shop_tool_handler_failed');
        output = JSON.stringify({ error: 'Tool execution failed. Please try again.' });
      }
      const payload = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callIdTool,
          output: compactToolOutput(output),
        },
      };
      try {
        ws.send(JSON.stringify(payload));
        lastToolResultSentAtMs = Date.now();
        const parsedOutput = parseToolOutputObject(output);
        const shouldFinalizeBookingLink =
          toolName === SEND_BOOKING_LINK_TOOL_NAME &&
          parsedOutput?.success === true &&
          parsedOutput.error === undefined &&
          parsedOutput.fallback === undefined;
        if (shouldFinalizeBookingLink) {
          pendingAutoEndAfterFinalAudio = true;
          const sent = sendShopResponseCreate({
            instructions: BOOKING_LINK_FINAL_RESPONSE_INSTRUCTION,
            state: 'waiting_audio',
            mode: 'caller_response',
            timeoutMs: 8_000,
            token: toolTurnToken,
            forceAppointmentTimeValidation: false,
          });
          if (!sent) {
            pendingAutoEndAfterFinalAudio = false;
            releaseTurnState({ processQueue: false, clearQueue: true });
          }
          logTiming(
            'tool_result_sent',
            {
              tool: toolName,
              elapsedSinceToolCallMs: elapsedSince(lastToolCallReceivedAtMs, lastToolResultSentAtMs),
            },
            lastToolResultSentAtMs,
          );
          return;
        }

        ws.send(JSON.stringify({ type: 'response.create' }));
        lastResponseCreateSentAtMs = lastToolResultSentAtMs;
        waitingForAudioResponseStart = true;
        if (toolTurnToken === activeTurnToken) {
          sidebandTurnState = 'waiting_audio';
          sidebandTurnMode = 'caller_response';
          startTurnStateTimeout(8_000, toolTurnToken);
        }
        logTiming(
          'tool_result_sent',
          {
            tool: toolName,
            elapsedSinceToolCallMs: elapsedSince(lastToolCallReceivedAtMs, lastToolResultSentAtMs),
          },
          lastToolResultSentAtMs,
        );
      } catch (err) {
        logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_shop_tool_reply_failed');
      }
    })();
  });

  ws.on('error', (err) => {
    logger.warn({ err, callId: params.callId }, 'openai_sip_sideband_ws_error');
  });

  ws.on('close', (closeCode: number) => {
    if (softLimitTimer) { clearTimeout(softLimitTimer); softLimitTimer = null; }
    if (hardLimitTimer) { clearTimeout(hardLimitTimer); hardLimitTimer = null; }
    if (pendingHangupFallbackTimer) { clearTimeout(pendingHangupFallbackTimer); pendingHangupFallbackTimer = null; }
    clearAllTranscriptionTimeouts();
    pendingHangupAfterAudio = false;
    pendingAutoEndAfterFinalAudio = false;
    releaseTurnState({ processQueue: false, clearQueue: true });
    cancelInitialTimer();
    clearTimeout(t);
    logger.info({ callId: params.callId, closeCode }, 'openai_sip_sideband_ws_close');
    if (params.variant === 'demo') {
      params.onEnded?.();
    } else if (params.variant === 'shop' && wsOpened && closeCode !== 1000 && closeCode !== 1001) {
      params.onWsDropped?.(closeCode);
    }
  });
}
