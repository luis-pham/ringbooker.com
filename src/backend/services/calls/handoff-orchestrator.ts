import { getEnv } from '@/src/backend/config/env';
import { HANDOFF_TERMINAL_STATUSES, type HandoffSessionStatus } from '@/src/backend/domain/handoff';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';
import { withLogContext } from '@/src/backend/observability/logger';
import { maskPhone } from '@/src/backend/security/pii';
import type {
  CallLogsRepository,
  HandoffSessionsRepository,
  JobsRepository,
  ShopsRepository,
  VoiceCallLegsRepository,
} from '@/src/backend/ports/repositories';
import {
  callControlBridgeCalls,
  callControlGatherUsingSpeak,
  callControlHangup,
  type CallControlClientDeps,
} from '@/src/backend/services/calls/call-control-client';
import { buildOwnerScreeningPrompt } from '@/src/backend/services/calls/handoff-call-control';
import {
  decodeCallControlClientState,
  firstStringFromPayload,
} from '@/src/backend/webhooks/telnyx-call-control';

export type HandoffOrchestratorDeps = {
  handoffSessionsRepository: HandoffSessionsRepository;
  shopsRepository: ShopsRepository;
  jobsRepository?: JobsRepository;
  callLogsRepository?: CallLogsRepository;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  testingTelnyxFetch?: typeof fetch;
  apiKey: string;
};

function fetchDeps(deps: HandoffOrchestratorDeps): CallControlClientDeps {
  return { fetchImpl: deps.testingTelnyxFetch, apiKey: deps.apiKey };
}

function gatherClientState(handoffId: string, rbCallId: string, shopId: string, phase: 'gather_v1' | 'gather_retry'): string {
  return Buffer.from(JSON.stringify({ purpose: 'handoff_gather', handoffId, rbCallId, shopId, phase }), 'utf8').toString(
    'base64',
  );
}

async function enqueueOwnerFallbackSms(
  handoffSessionsRepository: HandoffSessionsRepository,
  jobsRepository: JobsRepository | undefined,
  session: {
    id: string;
    shopId: string;
    rbCallId: string;
    summary: string;
    reason: string;
    urgency: string;
    callerPhone: string | null;
  },
  failureCode: string,
  log: ReturnType<typeof withLogContext>,
): Promise<void> {
  if (!jobsRepository) return;
  const fresh = await handoffSessionsRepository.findById(session.id);
  if (fresh?.fallbackSmsSent) return;

  const idempotencyKey = `handoff_failed_owner_summary:${session.rbCallId}:${session.id}`;
  try {
    await jobsRepository.enqueue({
      shopId: session.shopId,
      type: 'handoff_failed_owner_sms',
      payload: {
        rbCallId: session.rbCallId,
        handoffId: session.id,
        summary: session.summary,
        reason: session.reason,
        urgency: session.urgency,
        callerPhone: session.callerPhone ?? undefined,
        failureCode,
      },
      runAt: new Date(),
      idempotencyKey,
    });
    await handoffSessionsRepository.update(session.id, { fallbackSmsSent: true });
    incrementMetric('handoff_failed_total', { reason: failureCode });
  } catch (err) {
    log.warn({ err, shopId: session.shopId, rbCallId: session.rbCallId }, 'handoff_fallback_sms_enqueue_failed');
  }
}

async function terminalComplete(sessionId: string, status: HandoffSessionStatus, deps: HandoffOrchestratorDeps): Promise<void> {
  await deps.handoffSessionsRepository.update(sessionId, {
    status,
    completedAt: new Date(),
  });
}

/**
 * Outbound owner leg: `call.initiated` with `purpose=owner_handoff_leg` in client_state.
 */
export async function handoffOnOwnerOutboundInitiated(
  payload: unknown,
  deps: HandoffOrchestratorDeps,
  log: ReturnType<typeof withLogContext>,
): Promise<void> {
  const raw = firstStringFromPayload(payload, ['client_state']);
  const decoded = decodeCallControlClientState(raw);
  if (decoded?.purpose !== 'owner_handoff_leg' || !decoded.handoffId) return;

  const ownerCc = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
  const sessionIdField = firstStringFromPayload(payload, ['call_session_id']);
  if (!ownerCc) return;

  const session = await deps.handoffSessionsRepository.findById(decoded.handoffId);
  if (!session) {
    log.warn(
      { handoffId: decoded.handoffId, ownerCallControlId: ownerCc, eventType: 'call.initiated' },
      'handoff_session_missing_for_owner_leg',
    );
    return;
  }
  if (HANDOFF_TERMINAL_STATUSES.has(session.status)) return;

  await deps.handoffSessionsRepository.update(session.id, {
    ownerCallControlId: ownerCc,
    parentCallSessionId: session.parentCallSessionId ?? sessionIdField ?? null,
    status: 'owner_ringing',
  });
  log.info(
    {
      ...handoffLogFields(session, 'call.initiated', ownerCc),
      ownerCallControlId: ownerCc,
    },
    'handoff_owner_leg_initiated',
  );
}

function handoffLogFields(
  s: { rbCallId: string; id: string; shopId: string; parentCallControlId: string; status: string },
  eventType: string,
  ownerCallControlId?: string | null,
) {
  return {
    rbCallId: s.rbCallId,
    handoffId: s.id,
    shopId: s.shopId,
    parentCallControlId: s.parentCallControlId,
    ownerCallControlId: ownerCallControlId ?? undefined,
    eventType,
    status: s.status,
  };
}

/**
 * Owner picked up: play screening + gather DTMF (1 accept, 2 decline).
 */
export async function handoffOnOwnerCallAnswered(
  payload: unknown,
  deps: HandoffOrchestratorDeps,
  log: ReturnType<typeof withLogContext>,
): Promise<void> {
  const raw = firstStringFromPayload(payload, ['client_state']);
  const decoded = decodeCallControlClientState(raw);
  if (decoded?.purpose !== 'owner_handoff_leg' || !decoded.handoffId) return;

  const ownerCc = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
  if (!ownerCc) return;

  const session = await deps.handoffSessionsRepository.findById(decoded.handoffId);
  if (!session) {
    log.warn({ handoffId: decoded.handoffId }, 'handoff_on_owner_answered_missing_session');
    return;
  }
  if (HANDOFF_TERMINAL_STATUSES.has(session.status)) return;
  if (session.status === 'owner_screening_playing' || session.status === 'owner_dtmf_waiting') {
    log.info(handoffLogFields(session, 'call.answered', ownerCc), 'handoff_owner_answered_duplicate_ignored');
    return;
  }

  const shop = await deps.shopsRepository.findById(session.shopId);
  if (!shop) return;

  const callerLabel =
    session.callerName?.trim() ||
    (session.callerPhone ? maskPhone(session.callerPhone) : '') ||
    'Unknown caller';
  const prompt = buildOwnerScreeningPrompt({
    shopName: shop.name,
    callerLabel,
    summary: session.summary,
  });

  const env = getEnv();
  const voice = process.env.TELNYX_HANDOFF_TTS_VOICE?.trim() || 'Polly.Joanna';

  await deps.handoffSessionsRepository.update(session.id, {
    ownerCallControlId: ownerCc,
    status: 'owner_answered',
  });
  incrementMetric('handoff_owner_answered_total', { shopId: session.shopId });
  observeDurationMs('owner_answer_latency_ms', Date.now() - session.createdAt.getTime(), { shopId: session.shopId });

  const gr = await callControlGatherUsingSpeak(
    ownerCc,
    {
      payload: prompt,
      voice,
      language: 'en-US',
      minimum_digits: 1,
      maximum_digits: 1,
      valid_digits: '12',
      timeout_millis: 10_000,
      inter_digit_timeout_millis: 5000,
      maximum_tries: 2,
      invalid_payload: 'That was not a valid choice. Press 1 to accept, or 2 for a text summary.',
      client_state: gatherClientState(session.id, session.rbCallId, session.shopId, 'gather_v1'),
    },
    fetchDeps(deps),
  );

  if (!gr.ok) {
    log.warn(
      { httpStatus: gr.status, body: gr.text, ...handoffLogFields(session, 'gather_using_speak', ownerCc) },
      'handoff_gather_speak_failed',
    );
    await deps.handoffSessionsRepository.update(session.id, {
      status: 'handoff_failed_bridge_error',
      failedReason: 'gather_speak_http',
      errorMessage: `${gr.status}`,
      completedAt: new Date(),
    });
    await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, session, 'gather_speak_http', log);
    return;
  }

  await deps.handoffSessionsRepository.update(session.id, { status: 'owner_screening_playing' });
  log.info(handoffLogFields({ ...session, status: 'owner_screening_playing' }, 'call.answered', ownerCc), 'handoff_screening_started');
}

/**
 * `call.gather.ended` on owner leg.
 */
export async function handoffOnGatherEnded(payload: unknown, deps: HandoffOrchestratorDeps, log: ReturnType<typeof withLogContext>): Promise<void> {
  const ownerCc = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
  if (!ownerCc) return;

  const session =
    (await deps.handoffSessionsRepository.findByOwnerCallControlId(ownerCc)) ??
    (await (async () => {
      const raw = firstStringFromPayload(payload, ['client_state']);
      const decoded = decodeCallControlClientState(raw);
      return decoded?.handoffId ? deps.handoffSessionsRepository.findById(decoded.handoffId) : null;
    })());

  if (!session || HANDOFF_TERMINAL_STATUSES.has(session.status)) return;

  const statusRaw = (firstStringFromPayload(payload, ['status']) ?? '').toLowerCase();
  const digitsRaw = firstStringFromPayload(payload, ['digits', 'digit']) ?? '';
  const digit = digitsRaw.replace(/\D/g, '').slice(0, 1);

  const logCtx = (extra: Record<string, unknown>) =>
    log.info({ ...handoffLogFields(session, 'call.gather.ended', ownerCc), ...extra }, 'handoff_gather_ended');

  if (statusRaw === 'timeout' || statusRaw === 'timed_out' || (!digit && statusRaw !== 'valid')) {
    await terminalComplete(session.id, 'handoff_failed_dtmf_timeout', deps);
    await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, session, 'dtmf_timeout', log);
    logCtx({ digit: '', gatherStatus: statusRaw });
    return;
  }

  if (digit === '2') {
    await terminalComplete(session.id, 'handoff_failed_owner_rejected', deps);
    await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, session, 'owner_pressed_2', log);
    logCtx({ digit: '2' });
    return;
  }

  if (digit === '1') {
    const t0 = Date.now();
    await deps.handoffSessionsRepository.update(session.id, { status: 'owner_accepted' });
    incrementMetric('handoff_owner_accepted_total', { shopId: session.shopId });
    log.info({ ...handoffLogFields(session, 'call.gather.ended', ownerCc), digit: '1' }, 'owner_dtmf_received');

    let openaiCc = session.openaiCallId?.trim() || null;
    if (!openaiCc && deps.voiceCallLegsRepository) {
      openaiCc =
        (await deps.voiceCallLegsRepository.findActiveOpenAiLegCallControlIdByRbCallId(session.shopId, session.rbCallId)) ??
        (await deps.voiceCallLegsRepository.findActiveOpenAiLegCallControlIdByParent(session.parentCallControlId));
    }

    if (openaiCc) {
      const hr = await callControlHangup(openaiCc, {}, fetchDeps(deps));
      if (!hr.ok) {
        log.warn(
          {
            httpStatus: hr.status,
            body: hr.text,
            ...handoffLogFields(session, 'hangup_openai_leg', openaiCc),
          },
          'telnyx_call_control_hangup_openai_leg_before_owner_bridge_failed',
        );
      } else {
        log.info(
          {
            ...handoffLogFields(session, 'hangup_openai_leg', openaiCc),
            openaiLegCallControlId: openaiCc,
          },
          'telnyx_call_control_hangup_openai_leg_before_owner_bridge',
        );
        if (deps.voiceCallLegsRepository) {
          try {
            await deps.voiceCallLegsRepository.markCallLegEnded(openaiCc, 'openai_sip_leg');
          } catch (err) {
            log.warn({ err, openaiLegCallControlId: openaiCc }, 'voice_call_leg_mark_openai_ended_failed');
          }
        }
      }
    } else {
      log.warn(
        {
          ...handoffLogFields(session, 'hangup_openai_leg', ownerCc),
          severity: 'high',
        },
        'handoff_openai_hangup_skipped_no_id',
      );
      incrementMetric('handoff_openai_hangup_skipped_total', { shopId: session.shopId });
    }

    await deps.handoffSessionsRepository.update(session.id, { status: 'bridge_requested' });
    log.info(
      {
        ...handoffLogFields(session, 'bridge_owner_started', ownerCc),
        bridgePurpose: 'owner_handoff',
      },
      'telnyx_call_control_bridge_owner_started',
    );
    const br = await callControlBridgeCalls(session.parentCallControlId, ownerCc, fetchDeps(deps));
    if (!br.ok) {
      log.warn(
        {
          httpStatus: br.status,
          body: br.text,
          bridgePurpose: 'owner_handoff',
          ...handoffLogFields(session, 'bridge', ownerCc),
        },
        'telnyx_call_control_bridge_owner_failed',
      );
      await deps.handoffSessionsRepository.update(session.id, {
        status: 'handoff_failed_bridge_error',
        failedReason: 'bridge_http',
        errorMessage: `${br.status}`,
        completedAt: new Date(),
      });
      await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, session, 'bridge_http', log);
      incrementMetric('handoff_failed_total', { reason: 'bridge_error' });
      return;
    }

    await deps.handoffSessionsRepository.update(session.id, { status: 'bridged' });
    observeDurationMs('bridge_latency_ms', Date.now() - t0, { shopId: session.shopId });
    incrementMetric('handoff_bridged_total', { shopId: session.shopId });

    if (deps.callLogsRepository) {
      try {
        await deps.callLogsRepository.setOutcomeByProviderCallId({
          provider: 'telnyx_call_control',
          providerCallId: session.parentCallControlId,
          outcome: 'transferred_to_owner',
        });
      } catch (err) {
        log.warn({ err, ...handoffLogFields(session, 'call_logs_outcome', ownerCc) }, 'handoff_call_log_outcome_failed');
      }
    }

    await deps.handoffSessionsRepository.update(session.id, {
      status: 'handoff_completed',
      completedAt: new Date(),
    });
    log.info(
      {
        ...handoffLogFields(session, 'bridge_owner_succeeded', ownerCc),
        bridgePurpose: 'owner_handoff',
      },
      'telnyx_call_control_bridge_owner_succeeded',
    );
    logCtx({ digit: '1', bridged: true });
    return;
  }

  /* Invalid digit — one retry via gather record */
  if (session.dtmfRetryCount < 1) {
    await deps.handoffSessionsRepository.update(session.id, {
      dtmfRetryCount: session.dtmfRetryCount + 1,
      status: 'owner_screening_playing',
    });
    const shop = await deps.shopsRepository.findById(session.shopId);
    const callerLabel = session.callerName?.trim() || maskPhone(session.callerPhone ?? '') || 'Unknown caller';
    const prompt = buildOwnerScreeningPrompt({
      shopName: shop?.name ?? 'Your shop',
      callerLabel,
      summary: session.summary,
    });
    const voice = process.env.TELNYX_HANDOFF_TTS_VOICE?.trim() || 'Polly.Joanna';
    await callControlGatherUsingSpeak(
      ownerCc,
      {
        payload: prompt,
        voice,
        language: 'en-US',
        minimum_digits: 1,
        maximum_digits: 1,
        valid_digits: '12',
        timeout_millis: 10_000,
        inter_digit_timeout_millis: 5000,
        maximum_tries: 1,
        invalid_payload: 'Press 1 to accept, or 2 to decline.',
        client_state: gatherClientState(session.id, session.rbCallId, session.shopId, 'gather_retry'),
      },
      fetchDeps(deps),
    );
    logCtx({ digit: digit || 'invalid', retry: true });
    return;
  }

  await terminalComplete(session.id, 'handoff_failed_dtmf_rejected', deps);
  await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, session, 'invalid_dtmf', log);
  incrementMetric('handoff_failed_total', { reason: 'dtmf_invalid' });
  logCtx({ digit: digit || 'invalid', terminal: true });
}

/**
 * Hangup on parent or owner leg during handoff.
 */
export async function handoffOnHangup(payload: unknown, deps: HandoffOrchestratorDeps, log: ReturnType<typeof withLogContext>): Promise<void> {
  const cc = firstStringFromPayload(payload, ['call_control_id', 'call_leg_id']);
  if (!cc) return;

  const byOwner = await deps.handoffSessionsRepository.findByOwnerCallControlId(cc);
  if (byOwner) {
    if (HANDOFF_TERMINAL_STATUSES.has(byOwner.status)) {
      return;
    }
    if (byOwner.status === 'bridged') {
      await deps.handoffSessionsRepository.update(byOwner.id, { status: 'handoff_completed', completedAt: new Date() });
      return;
    }
  }

  if (byOwner) {
    let nextStatus: HandoffSessionStatus = 'handoff_failed_owner_no_answer';
    if (['owner_ringing', 'owner_dialing'].includes(byOwner.status)) {
      nextStatus = 'handoff_failed_owner_no_answer';
    } else if (byOwner.status === 'bridge_requested') {
      nextStatus = 'handoff_failed_bridge_error';
    } else if (
      [
        'owner_answered',
        'owner_screening_playing',
        'owner_dtmf_waiting',
        'owner_accepted',
      ].includes(byOwner.status)
    ) {
      nextStatus = 'handoff_failed_owner_rejected';
    }
    await deps.handoffSessionsRepository.update(byOwner.id, {
      status: nextStatus,
      completedAt: new Date(),
      failedReason: 'owner_hangup',
    });
    await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, byOwner, 'owner_hangup', log);
    log.info(handoffLogFields(byOwner, 'call.hangup', cc), 'handoff_owner_leg_hangup');
    return;
  }

  const active = await deps.handoffSessionsRepository.findActiveByParentCallControlId(cc);
  if (!active) return;

  if (active.ownerCallControlId && !HANDOFF_TERMINAL_STATUSES.has(active.status)) {
    const hr = await callControlHangup(active.ownerCallControlId, {}, fetchDeps(deps));
    if (!hr.ok) {
      log.warn(
        { httpStatus: hr.status, body: hr.text, ...handoffLogFields(active, 'cancel_owner', active.ownerCallControlId) },
        'handoff_cancel_owner_hangup_failed',
      );
    }
  }

  if (!['bridged', 'handoff_completed'].includes(active.status)) {
    await deps.handoffSessionsRepository.update(active.id, {
      status: 'handoff_failed_caller_hung_up',
      completedAt: new Date(),
      failedReason: 'parent_hangup',
    });
    await enqueueOwnerFallbackSms(deps.handoffSessionsRepository, deps.jobsRepository, active, 'caller_hangup', log);
    log.info(handoffLogFields(active, 'call.hangup', active.ownerCallControlId), 'handoff_parent_hangup_before_bridge');
  }
}
