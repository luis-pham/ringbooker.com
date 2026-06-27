import type { Hono } from 'hono';
import {
  ensureInternalAccess,
  ensureRealtimeDispatchAccess,
  securityAudit,
  getClientIp,
  RATE_LIMIT_POLICIES,
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  requireLivekitRealtimeInProduction,
  createInboundAgentSession,
  handleRealtimeDispatch,
  parseRealtimeDispatchInput,
  enqueueJobSchema,
  simulateInboundSchema,
  startInboundSchema,
  dispatchStatusSchema,
  mapDispatchStatusToDemoCallStatus,
} from '../app-shared';
import { logger } from '@/src/backend/observability/logger';
import { randomUUID } from 'node:crypto';
import type { JobType } from '@/src/backend/domain/types';
import type {
  JobsRepository,
  BookingsRepository,
  CallbacksRepository,
  ShopsRepository,
  ShopRoutingRulesRepository,
  CallLogsRepository,
} from '@/src/backend/ports/repositories';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import type { RealtimeAgentRuntime } from '@/src/agent/realtime/types';
import type { DemoSessionsRepository } from '@/src/backend/ports/repositories';

type AgentJobsDeps = {
  jobsRepository?: JobsRepository;
  bookingsRepository?: BookingsRepository;
  callbacksRepository?: CallbacksRepository;
  shopsRepository?: ShopsRepository;
  telephonyService?: TelephonyService;
  shopRoutingRulesRepository?: ShopRoutingRulesRepository;
  realtimeAgentRuntime?: RealtimeAgentRuntime;
  callLogsRepository?: CallLogsRepository;
  demoSessionsRepository?: DemoSessionsRepository;
};

export function registerAgentJobsRoutes(app: Hono, path: (route: string) => string, deps: AgentJobsDeps): void {
  app.post(path('/jobs/enqueue'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.jobs_enqueue, 'jobs_enqueue');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (!deps.jobsRepository) {
      return c.json({ ok: false, error: 'jobs_repository_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = enqueueJobSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    const job = parsed.data;
    const runAt = job.runAtIso ? new Date(job.runAtIso) : new Date();
    const idempotencyKey = job.idempotencyKey ?? `manual:${job.type}:${job.shopId}:${randomUUID()}`;

    await deps.jobsRepository.enqueue({
      shopId: job.shopId,
      type: job.type as JobType,
      payload: job.payload,
      runAt,
      idempotencyKey,
    });

    return c.json({
      ok: true,
      queued: true,
      idempotencyKey,
      runAtIso: runAt.toISOString(),
    });
  });

  app.post(path('/agent/simulate-inbound'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_simulate_inbound, 'agent_simulate_inbound');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (
      !deps.jobsRepository ||
      !deps.bookingsRepository ||
      !deps.callbacksRepository ||
      !deps.shopsRepository ||
      !deps.telephonyService
    ) {
      return c.json({ ok: false, error: 'agent_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = simulateInboundSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const phoneScopedLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.agent_simulate_inbound_phone,
      `agent_simulate_inbound:${parsed.data.destinationPhone}:${parsed.data.callerPhone}`,
    );
    if (phoneScopedLimited) return phoneScopedLimited;

    const session = await createInboundAgentSession(
      {
        shopsRepository: deps.shopsRepository,
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
        shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
        realtimeAgentRuntime: deps.realtimeAgentRuntime ?? {
          startInboundSession: async (params) => ({
            mode: 'mock',
            sessionId: params.requestId,
            roomName: params.roomName,
            status: 'simulated',
          }),
        },
      },
      {
        destinationPhone: parsed.data.destinationPhone,
        callerPhone: parsed.data.callerPhone,
        requestId: parsed.data.requestId,
        roomName: parsed.data.roomName,
      },
    );

    if (!session) {
      return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }

    const result = await session.runTool(parsed.data.tool, parsed.data.params);
    return c.json({
      ok: true,
      requestId: session.requestId,
      roomName: session.roomName,
      shopId: session.shop.id,
      prompt: session.systemPrompt,
      tool: parsed.data.tool,
      result,
    });
  });

  app.post(path('/agent/start-inbound'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_start_inbound, 'agent_start_inbound');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (
      !deps.jobsRepository ||
      !deps.bookingsRepository ||
      !deps.callbacksRepository ||
      !deps.shopsRepository ||
      !deps.telephonyService ||
      !deps.realtimeAgentRuntime
    ) {
      return c.json({ ok: false, error: 'agent_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = startInboundSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    const phoneScopedLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.agent_start_inbound_phone,
      `agent_start_inbound:${parsed.data.destinationPhone}:${parsed.data.callerPhone}`,
    );
    if (phoneScopedLimited) return phoneScopedLimited;

    const session = await createInboundAgentSession(
      {
        shopsRepository: deps.shopsRepository,
        jobsRepository: deps.jobsRepository,
        bookingsRepository: deps.bookingsRepository,
        callbacksRepository: deps.callbacksRepository,
        telephonyService: deps.telephonyService,
        shopRoutingRulesRepository: deps.shopRoutingRulesRepository,
        realtimeAgentRuntime: deps.realtimeAgentRuntime,
      },
      {
        destinationPhone: parsed.data.destinationPhone,
        callerPhone: parsed.data.callerPhone,
        requestId: parsed.data.requestId,
        roomName: parsed.data.roomName,
      },
    );

    if (!session) {
      return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }

    const realtime = await session.startRealtimeSession();
    if (requireLivekitRealtimeInProduction() && realtime.mode !== 'livekit_realtime') {
      logger.error(
        {
          requestId: session.requestId,
          roomName: session.roomName,
          mode: realtime.mode,
        },
        'agent_start_inbound_realtime_mode_not_allowed_in_production',
      );
      return c.json({ ok: false, error: 'agent_runtime_not_configured' }, 503);
    }

    await deps.jobsRepository.enqueue({
      shopId: session.shop.id,
      type: 'realtime_session_dispatch',
      payload: {
        requestId: session.requestId,
        roomName: session.roomName,
        destinationPhone: session.shop.phone_number,
        callerPhone: session.callerPhone,
        systemPrompt: session.systemPrompt,
        realtime,
      },
      runAt: new Date(),
      idempotencyKey: `realtime_dispatch:${session.requestId}`,
    });

    return c.json({
      ok: true,
      requestId: session.requestId,
      roomName: session.roomName,
      shopId: session.shop.id,
      prompt: session.systemPrompt,
      realtime,
    });
  });

  app.post(path('/agent/dispatch'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_dispatch, 'agent_dispatch');
    if (limited) return limited;
    if (!ensureRealtimeDispatchAccess(c.req.header('authorization') ?? null, c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'dispatch_auth_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = parseRealtimeDispatchInput(body);
    if (!parsed) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }
    if (requireLivekitRealtimeInProduction() && parsed.realtime.mode !== 'livekit_realtime') {
      return c.json({ ok: false, error: 'realtime_mode_not_allowed' }, 422);
    }

    const dispatchPayload = (parsed.realtime.metadata as { dispatchPayload?: { demo?: { isolated?: boolean } } } | undefined)
      ?.dispatchPayload;
    const isDemoDispatch = dispatchPayload?.demo?.isolated === true || parsed.requestId.startsWith('demo-');
    await handleRealtimeDispatch(parsed, { callLogsRepository: isDemoDispatch ? undefined : deps.callLogsRepository });
    return c.json({
      ok: true,
      accepted: true,
      requestId: parsed.requestId,
      roomName: parsed.roomName,
      mode: parsed.realtime.mode,
    });
  });

  app.post(path('/agent/dispatch/status'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.agent_dispatch, 'agent_dispatch_status');
    if (limited) return limited;
    if (!ensureRealtimeDispatchAccess(c.req.header('authorization') ?? null, c.req.header('x-backend-key') ?? null)) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'dispatch_auth_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = dispatchStatusSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.isDemo && deps.demoSessionsRepository) {
      await deps.demoSessionsRepository.markCallRunStatusByRequestId({
        requestId: parsed.data.requestId,
        status: mapDispatchStatusToDemoCallStatus(parsed.data.status),
        connectedAt: parsed.data.status === 'agent_joined' ? new Date(parsed.data.occurredAt ?? Date.now()) : undefined,
        endedAt:
          parsed.data.status === 'completed' || parsed.data.status === 'failed'
            ? new Date(parsed.data.occurredAt ?? Date.now())
            : undefined,
        outcome: parsed.data.status === 'failed' ? 'error' : parsed.data.status === 'completed' ? 'completed' : undefined,
      });
      await deps.demoSessionsRepository.addStatusEvent({
        requestId: parsed.data.requestId,
        eventType: `agent_dispatch_${parsed.data.status}`,
        payload: {
          roomName: parsed.data.roomName,
          sessionId: parsed.data.sessionId,
          error: parsed.data.error ?? null,
          demoVertical: parsed.data.demoVertical ?? null,
          demoMode: parsed.data.demoMode ?? null,
        },
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
      });
      return c.json({
        ok: true,
        accepted: true,
        requestId: parsed.data.requestId,
        status: parsed.data.status,
      });
    }

    if (deps.callLogsRepository && parsed.data.shopId && parsed.data.status === 'agent_joined') {
      await deps.callLogsRepository.markAgentJoined({
        shopId: parsed.data.shopId,
        requestId: parsed.data.requestId,
        roomName: parsed.data.roomName,
      });
    }

    if (
      deps.callLogsRepository &&
      parsed.data.shopId &&
      (parsed.data.status === 'completed' || parsed.data.status === 'failed')
    ) {
      await deps.callLogsRepository.updateTranscriptStatusByRequestId({
        shopId: parsed.data.shopId,
        requestId: parsed.data.requestId,
        status: parsed.data.status === 'completed' ? 'completed' : 'failed',
      });

      if (deps.jobsRepository) {
        await deps.jobsRepository.enqueue({
          shopId: parsed.data.shopId,
          type: 'post_call_summary',
          payload: {
            requestId: parsed.data.requestId,
            status: parsed.data.status,
            error: parsed.data.error ?? null,
            occurredAt: parsed.data.occurredAt ?? null,
          },
          runAt: new Date(),
          idempotencyKey: `post_call_summary:${parsed.data.requestId}:${parsed.data.status}`,
        });
      }
    }

    return c.json({
      ok: true,
      accepted: true,
      requestId: parsed.data.requestId,
      status: parsed.data.status,
    });
  });

}
