import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { AccessToken } from 'livekit-server-sdk';

import { dispatchRealtimeSession } from '@/src/agent/realtime/dispatch-session';
import type { RealtimeAgentRuntime } from '@/src/agent/realtime/types';
import { openAiRealtimeVoiceForDemoVerticalSlug } from '@/src/agent/prompts';
import { shopLocalToUtcIso, isRequestedAppointmentInsideBusinessHours } from '@/src/agent/tools/types';
import { buildValidationMessageForAi } from '@/src/agent/tools/validate-appointment-time';
import { buildPublicDemoScriptedWelcomeLine, buildPublicDemoSystemPrompt, getDemoVerticalShopContext } from '@/src/backend/demo/public-demo-system-prompt';
import { resolveDemoClientCountryForPersistence } from '@/src/backend/lib/demo-client-country';
import { parseDemoUserAgentHints } from '@/src/backend/lib/demo-user-agent-hints';
import { logger } from '@/src/backend/observability/logger';
import type { DemoSessionsRepository, ShopsRepository } from '@/src/backend/ports/repositories';
import type { WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { SalesPreparedDemoConfig, SalesPreparedDemosRepository } from '@/src/backend/ports/sales-prepared-demos';
import { signDemoPreviewToken, verifyDemoPreviewToken } from '@/src/backend/security/demo-preview';
import { toLiveKitBrowserWsUrl } from '@/src/backend/lib/livekit-browser-url';
import { importWebsiteWithCache } from '@/src/backend/services/website-import/cache';
import { importWebsiteForOnboarding } from '@/src/backend/services/website-import/importer';
import { notifySalesDemoEvent } from '@/src/backend/services/sales-integration/sales-webhook';
import {
  clearDirectDemoActiveSlot,
  consumePublicDemoRealtimeLimits,
  directDemoActiveTtlMs,
  enforcePublicDemoRealtimeOrigin,
  jsonPublicDemoRealtimeBlocked,
  releaseDirectDemoActiveSlot,
  runDirectDemoSerialized,
  tryOccupyDirectDemoActiveSlot,
  verifyDirectDemoActiveSlot,
} from '@/src/backend/demo/public-demo-realtime-guard';
import {
  acquireWebsiteImportLlmBudget,
  createOpenAiRealtimeClientSecret,
  directOpenAiRealtimeModel,
  directWebDemoTurnDetectionProfileForSource,
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  ensureInternalAccess,
  getAppBaseUrl,
  getClientIp,
  getEnv,
  importWebsiteSchema,
  mapDemoCallRunStatusToStage,
  normalizeCfIpCountry,
  normalizePhone,
  PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
  publicDemoRequestSchema,
  publicDemoWebSessionSchema,
  RATE_LIMIT_POLICIES,
  requireLivekitRealtimeInProduction,
  salesDemoContextSchema,
  securityAudit,
  slugifyDemo,
  verifyTurnstileToken,
  WEBSITE_IMPORT_BUDGET_MS,
} from '../app-shared';

type RuntimeInfo = {
  mode: 'memory' | 'supabase';
  commProvider: 'noop' | 'telnyx';
  agentRuntimeMode?: 'mock' | 'livekit_realtime';
  agentTransportMode?: 'mock' | 'livekit';
  agentVoiceProviderMode?: 'none' | 'gemini_live' | 'openai_realtime';
};

type DemoDeps = {
  demoSessionsRepository?: DemoSessionsRepository;
  webDemoSessionsRepository?: WebDemoSessionsRepository;
  salesPreparedDemosRepository?: SalesPreparedDemosRepository;
  shopsRepository?: ShopsRepository;
  realtimeAgentRuntime?: RealtimeAgentRuntime;
  runtimeInfo?: RuntimeInfo;
};

export function registerDemoRoutes(app: Hono, path: (route: string) => string, deps: DemoDeps): void {
  app.post(path('/public/demo/request'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_request, 'public_demo_outbound_disabled');
    if (limited) return limited;

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    securityAudit({
      action: 'public_demo_outbound_disabled',
      actorType: 'public',
      ip,
      path: c.req.path,
      details: { reason: 'outbound_visitor_demo_removed' },
    });

    return c.json(
      {
        ok: false,
        error: 'outbound_demo_disabled',
        message: 'Outbound demo calls are no longer supported. Please use the browser web demo.',
      },
      410,
    );
  });

  app.post(path('/public/demo/realtime-session'), async (c) => {
    const body = await c.req.json().catch(() => null);
    const normalizedBody =
      body && typeof body === 'object' && !Array.isArray(body)
        ? {
            ...body,
            shopName:
              typeof (body as { shopName?: unknown }).shopName === 'string'
                ? (body as { shopName: string }).shopName
                : (body as { businessName?: unknown }).businessName,
          }
        : body;
    const parsed = publicDemoWebSessionSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          code: 'invalid_demo_payload',
          message: 'Please check your demo details and try again.',
          retryAfterSeconds: 0,
        },
        400,
      );
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_demo_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json(
        {
          ok: false,
          code: 'invalid_demo_payload',
          message: 'Please check your demo details and try again.',
          retryAfterSeconds: 0,
        },
        400,
      );
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_demo_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json(
        {
          ok: false,
          code: 'captcha_failed',
          error: 'captcha_failed',
          message: 'Captcha verification failed. Please try again.',
          retryAfterSeconds: 0,
        },
        403,
      );
    }

    const demoVertical = parsed.data.demoVertical ?? parsed.data.businessType.toLowerCase().replace(/\s+/g, '-');

    return runDirectDemoSerialized(ip, async () => {
      const persistCountry = resolveDemoClientCountryForPersistence(
        normalizeCfIpCountry(c.req.header('CF-IPCountry')),
        PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
      );
      const uaHints = parseDemoUserAgentHints(c.req.header('user-agent'));

      const limits = await consumePublicDemoRealtimeLimits(ip, parsed.data.sessionId);
      if (!limits.ok) {
        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.insertRateLimited({
              publicSessionId: parsed.data.sessionId,
              verticalSlug: demoVertical,
              businessName: parsed.data.shopName,
              ipAddress: ip,
              country: persistCountry,
              userAgent: c.req.header('user-agent') ?? null,
              browser: uaHints.browser,
              deviceType: uaHints.deviceType,
              errorCode: limits.code,
            });
          } catch (error) {
            logger.warn({ err: error }, 'web_demo_session_rate_limit_persist_failed');
          }
        }
        return jsonPublicDemoRealtimeBlocked(c, limits.code, { vertical: demoVertical });
      }

      const requestId = `demo-direct-${randomUUID()}`;
      const ttlMs = directDemoActiveTtlMs();
      if (!await tryOccupyDirectDemoActiveSlot(ip, requestId, ttlMs)) {
        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.insertRateLimited({
              publicSessionId: parsed.data.sessionId,
              verticalSlug: demoVertical,
              businessName: parsed.data.shopName,
              ipAddress: ip,
              country: persistCountry,
              userAgent: c.req.header('user-agent') ?? null,
              browser: uaHints.browser,
              deviceType: uaHints.deviceType,
              errorCode: 'demo_concurrent_session_limit',
            });
          } catch (error) {
            logger.warn({ err: error }, 'web_demo_session_concurrent_limit_persist_failed');
          }
        }
        return jsonPublicDemoRealtimeBlocked(c, 'demo_concurrent_session_limit', {
          requestId,
          vertical: demoVertical,
        });
      }

      // Validate the prepared-demo slug server-side so a forged slug in the payload
      // can't push a sales lead's stage forward via a spoofed web-session.
      const verifiedPreparedSlug =
        parsed.data.preparedDemoSlug && deps.salesPreparedDemosRepository
          ? (await deps.salesPreparedDemosRepository.findBySlug(parsed.data.preparedDemoSlug))
            ? parsed.data.preparedDemoSlug
            : null
          : null;

      if (deps.webDemoSessionsRepository) {
        try {
          await deps.webDemoSessionsRepository.insertStarted({
            publicSessionId: parsed.data.sessionId,
            requestId,
            verticalSlug: demoVertical,
            businessName: parsed.data.shopName,
            ipAddress: ip,
            country: persistCountry,
            userAgent: c.req.header('user-agent') ?? null,
            browser: uaHints.browser,
            deviceType: uaHints.deviceType,
            importedSiteUrl: parsed.data.importedSiteUrl ?? null,
            preparedDemoSlug: verifiedPreparedSlug,
          });
        } catch (error) {
          logger.warn({ err: error, requestId }, 'web_demo_session_started_persist_failed');
        }
      }

      // Sales prepared demo (/try/<slug>): report the play so sales advances sent -> viewed.
      if (verifiedPreparedSlug) {
        void notifySalesDemoEvent({ slug: verifiedPreparedSlug, event: 'play', pct: 0 });
      }

      const demoMode = parsed.data.demoMode ?? 'quick';
      const demoSource = parsed.data.demoSource ?? 'vertical_demo_direct_openai';
      const turnDetectionProfile = directWebDemoTurnDetectionProfileForSource(demoSource);
      const model = directOpenAiRealtimeModel();
      const voice = openAiRealtimeVoiceForDemoVerticalSlug(parsed.data.demoVertical ?? demoVertical);
      const systemPrompt = buildPublicDemoSystemPrompt({
        shopName: parsed.data.shopName,
        businessType: parsed.data.businessType,
        demoVertical: parsed.data.demoVertical,
        staffName: parsed.data.staffName,
        notes: parsed.data.notes,
        demoConfig: parsed.data.demoConfig,
      });
      const scriptedWelcomeLine = buildPublicDemoScriptedWelcomeLine({
        shopName: parsed.data.shopName,
        businessType: parsed.data.businessType,
        demoVertical: parsed.data.demoVertical,
      });

      const services =
        parsed.data.demoConfig?.services?.map((s) => ({
          category: s.category,
          name: s.name,
          price: s.price ?? null,
          duration: s.duration ?? null,
          enabled: s.enabled ?? true,
        })) ?? [];
      const staff =
        parsed.data.demoConfig?.staffNames?.length
          ? parsed.data.demoConfig.staffNames
          : parsed.data.staffName
            ? [parsed.data.staffName]
            : [];

      if (deps.demoSessionsRepository) {
        try {
          const demoSession = await deps.demoSessionsRepository.createSession({
            publicSessionId: parsed.data.sessionId,
            verticalSlug: demoVertical,
            mode: demoMode,
            source: demoSource,
            callbackPhone: PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
            businessName: parsed.data.shopName,
            city: parsed.data.demoConfig?.city ?? null,
            businessHours: {
              primaryHours: parsed.data.demoConfig?.primaryHours,
              secondaryHours: parsed.data.demoConfig?.secondaryHours,
            },
            staff,
            notes: parsed.data.notes ?? null,
            systemPrompt,
            services,
            clientIp: ip,
            clientCountry: resolveDemoClientCountryForPersistence(
              normalizeCfIpCountry(c.req.header('CF-IPCountry')),
              PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164,
            ),
          });
          await deps.demoSessionsRepository.addStatusEvent({
            demoSessionId: demoSession.id,
            requestId,
            eventType: 'demo_realtime_session_requested',
            payload: {
              demoVertical,
              demoMode,
              demoSource,
              turnDetectionProfile,
              model,
              voice,
            },
          });
        } catch (error) {
          logger.warn({ err: error, requestId }, 'public_demo_realtime_session_persist_failed');
        }
      }

      securityAudit({
        action: 'public_demo_realtime_session_requested',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: {
          requestId,
          businessType: parsed.data.businessType,
          demoVertical,
          demoMode,
          demoSource,
          model,
          voice,
        },
      });

      try {
        const clientSecret = await createOpenAiRealtimeClientSecret({
          model,
          voice,
          instructions: systemPrompt,
          turnDetectionProfile,
        });

        securityAudit({
          action: 'public_demo_realtime_token_created',
          actorType: 'public',
          ip,
          path: c.req.path,
          details: {
            requestId,
            demoVertical,
            model,
            voice,
            expiresAt: clientSecret.expiresAt ?? null,
          },
        });

        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.markConnectedByRequestId(requestId);
            const preparedSlug = await deps.webDemoSessionsRepository.getPreparedDemoSlugByRequestId(requestId);
            if (preparedSlug) void notifySalesDemoEvent({ slug: preparedSlug, event: 'progress', pct: 50 });
          } catch (error) {
            logger.warn({ err: error, requestId }, 'web_demo_session_mark_connected_failed');
          }
        }

        return c.json({
          ok: true,
          requestId,
          clientSecret: clientSecret.value,
          expiresAt: clientSecret.expiresAt,
          model,
          voice,
          scriptedWelcomeLine,
          ...(clientSecret.turnDetectionAfterWelcome
            ? { turnDetectionAfterWelcome: clientSecret.turnDetectionAfterWelcome }
            : {}),
        });
      } catch (error) {
        clearDirectDemoActiveSlot(ip, requestId);
        const code = error instanceof Error && error.message === 'openai_config_missing' ? 'openai_config_missing' : 'realtime_session_failed';
        if (deps.webDemoSessionsRepository) {
          try {
            await deps.webDemoSessionsRepository.markFailedByRequestId(requestId, {
              errorCode: code,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          } catch (persistErr) {
            logger.warn({ err: persistErr, requestId }, 'web_demo_session_mark_failed_persist_failed');
          }
        }
        logger.error(
          {
            err: error,
            requestId,
            demoVertical,
            model,
            voice,
          },
          'public_demo_realtime_session_failed',
        );
        const status = code === 'openai_config_missing' ? 503 : 502;
        const message =
          code === 'openai_config_missing'
            ? 'The voice demo is temporarily unavailable. Please try again later.'
            : "We couldn't connect to the voice demo. Please try again in a moment.";
        return c.json(
          {
            ok: false,
            code,
            message,
            retryAfterSeconds: 60,
          },
          status,
        );
      }
    });
  });

  app.post(path('/public/demo/realtime-session/release'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_realtime_release, 'demo_realtime_release');
    if (limited) return limited;

    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;

    const body = await c.req.json().catch(() => null);
    const releaseParsed = z
      .object({
        requestId: z.string().min(1).max(200),
        endReason: z.enum(['completed', 'timeout']).optional(),
      })
      .safeParse(body);
    if (!releaseParsed.success) {
      return c.json(
        {
          ok: false,
          code: 'invalid_demo_payload',
          message: 'Please check your demo details and try again.',
          retryAfterSeconds: 0,
        },
        400,
      );
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const released = await releaseDirectDemoActiveSlot(ip, releaseParsed.data.requestId);
    if (!released) {
      return c.json(
        {
          ok: false,
          code: 'demo_session_expired',
          message:
            'This demo session has ended. You can start a new demo when you are ready.',
          retryAfterSeconds: 60,
        },
        404,
      );
    }

    const rid = releaseParsed.data.requestId;
    if (deps.webDemoSessionsRepository && rid.startsWith('demo-direct-')) {
      try {
        const preparedSlug = await deps.webDemoSessionsRepository.getPreparedDemoSlugByRequestId(rid);
        await deps.webDemoSessionsRepository.finalizeByRequestId(rid, {
          endReason: releaseParsed.data.endReason === 'timeout' ? 'timeout' : 'completed',
        });
        if (preparedSlug && releaseParsed.data.endReason !== 'timeout') {
          void notifySalesDemoEvent({ slug: preparedSlug, event: 'complete', pct: 100 });
        }
      } catch (error) {
        logger.warn({ err: error, requestId: rid }, 'web_demo_session_finalize_failed');
      }
    }

    return c.json({ ok: true });
  });

  // Persists the browser-captured demo transcript onto the web_demo_sessions row so it is
  // viewable in Admin → Demos. Separate from /release because the slot may already be freed.
  app.post(path('/public/demo/realtime-session/transcript'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_realtime_release, 'demo_realtime_transcript');
    if (limited) return limited;

    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;

    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        requestId: z.string().min(1).max(200),
        transcript: z
          .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }))
          .max(120),
      })
      .safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, code: 'invalid_demo_payload' }, 400);
    }
    if (!parsed.data.requestId.startsWith('demo-direct-')) {
      return c.json({ ok: false, code: 'invalid_request_id' }, 400);
    }
    if (parsed.data.transcript.length === 0) {
      return c.json({ ok: true });
    }
    if (deps.webDemoSessionsRepository) {
      try {
        await deps.webDemoSessionsRepository.saveTranscriptByRequestId(parsed.data.requestId, parsed.data.transcript);
      } catch (error) {
        logger.warn({ err: error, requestId: parsed.data.requestId }, 'web_demo_session_save_transcript_failed');
      }
    }
    return c.json({ ok: true });
  });

  // Validates a requested appointment date/time against the demo vertical's business hours.
  // Called by the browser's client-side tool dispatcher when OpenAI emits
  // `response.function_call_arguments.done` for the `validate_appointment_time` tool.
  app.post(path('/public/demo/realtime-session/validate-appointment-time'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_realtime_validate, 'demo_realtime_validate');
    if (limited) return limited;

    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;

    const body = await c.req.json().catch(() => null);
    const parsed = z
      .object({
        requestId: z.string().min(1).max(200),
        demoVertical: z.string().min(1).max(60),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      })
      .safeParse(body);

    if (!parsed.success) {
      return c.json({ ok: false, code: 'invalid_demo_payload' }, 400);
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });

    // Verify the requestId belongs to an active slot for this IP so the endpoint
    // cannot be used as a free business-hours oracle by unrelated clients.
    const isActive = await verifyDirectDemoActiveSlot(ip, parsed.data.requestId);
    if (!isActive) {
      return c.json(
        {
          ok: false,
          code: 'demo_session_expired',
          message: 'This demo session has ended. You can start a new demo when you are ready.',
        },
        404,
      );
    }

    const shopCtx = getDemoVerticalShopContext(parsed.data.demoVertical);

    // Unknown vertical — treat as unconfigured hours so the AI doesn't block the booking.
    if (!shopCtx) {
      const reason = 'business_hours_not_configured' as const;
      return c.json({
        ok: true,
        valid: true,
        reason,
        normalizedDatetimeUtc: null,
        messageForAi: buildValidationMessageForAi(reason),
      });
    }

    const normalizedDatetimeUtc = shopLocalToUtcIso({
      date: parsed.data.date,
      time: parsed.data.time,
      timezone: shopCtx.timezone,
    });

    if (!normalizedDatetimeUtc) {
      return c.json({ ok: false, code: 'invalid_datetime' }, 400);
    }

    const requestedDatetime = DateTime.fromISO(normalizedDatetimeUtc, { zone: 'utc' });
    const isPastDatetime = requestedDatetime < DateTime.utc();
    const insideHours = isPastDatetime
      ? null
      : isRequestedAppointmentInsideBusinessHours(shopCtx, parsed.data);

    const reason =
      isPastDatetime
        ? ('past_datetime' as const)
        : insideHours === false
          ? ('outside_business_hours' as const)
          : insideHours === true
            ? ('within_business_hours' as const)
            : ('business_hours_not_configured' as const);

    const valid = reason === 'within_business_hours' || reason === 'business_hours_not_configured';

    logger.info(
      {
        requestId: parsed.data.requestId,
        demoVertical: parsed.data.demoVertical,
        date: parsed.data.date,
        time: parsed.data.time,
        reason,
        valid,
      },
      'demo_validate_appointment_time',
    );

    return c.json({
      ok: true,
      valid,
      reason,
      normalizedDatetimeUtc,
      messageForAi: buildValidationMessageForAi(reason),
    });
  });

  app.post(path('/public/demo/web-session'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_web_session, 'public_demo_web_session');
    if (limited) return limited;

    const body = await c.req.json().catch(() => null);
    const parsed = publicDemoWebSessionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_demo_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_request' }, 400);
    }

    const sessionIp = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const sessionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_demo_request_session,
      `public_demo_web_session:${sessionIp}:${parsed.data.sessionId}`,
    );
    if (sessionLimited) return sessionLimited;

    const normalizedPhone = PUBLIC_DEMO_WEB_SESSION_CALLBACK_PHONE_E164;
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_demo_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json({ ok: false, error: 'captcha_failed' }, 403);
    }

    if (!deps.shopsRepository || !deps.realtimeAgentRuntime || !deps.demoSessionsRepository) {
      return c.json({ ok: false, error: 'demo_dependencies_unavailable' }, 503);
    }

    const env = getEnv();
    const demoShop = await deps.shopsRepository.findById(env.PUBLIC_DEMO_SHOP_ID);
    if (!demoShop || !demoShop.active) {
      return c.json({ ok: false, error: 'demo_shop_unavailable' }, 503);
    }

    const liveDemoConfigured =
      deps.runtimeInfo?.commProvider === 'telnyx' &&
      deps.runtimeInfo?.agentTransportMode === 'livekit' &&
      (deps.runtimeInfo?.agentVoiceProviderMode === 'gemini_live' ||
        deps.runtimeInfo?.agentVoiceProviderMode === 'openai_realtime');
    if (!liveDemoConfigured && process.env.NODE_ENV === 'production') {
      return c.json({ ok: false, error: 'demo_runtime_not_configured' }, 503);
    }

    const requestId = `demo-${randomUUID()}`;
    const roomName = `rb-demo-${requestId.slice(-12)}`;
    const demoVertical = parsed.data.demoVertical ?? parsed.data.businessType.toLowerCase().replace(/\s+/g, '-');
    const demoMode = parsed.data.demoMode ?? 'free-form';
    const demoSource = parsed.data.demoSource ?? 'vertical_demo_web';
    const systemPrompt = buildPublicDemoSystemPrompt({
      shopName: parsed.data.shopName,
      businessType: parsed.data.businessType,
      demoVertical: parsed.data.demoVertical,
      staffName: parsed.data.staffName,
      notes: parsed.data.notes,
      demoConfig: parsed.data.demoConfig,
    });

    const services =
      parsed.data.demoConfig?.services?.map((s) => ({
        category: s.category,
        name: s.name,
        price: s.price ?? null,
        duration: s.duration ?? null,
        enabled: s.enabled ?? true,
      })) ?? [];

    const staff =
      parsed.data.demoConfig?.staffNames?.length
        ? parsed.data.demoConfig.staffNames
        : parsed.data.staffName
          ? [parsed.data.staffName]
          : [];

    try {
      const demoSession = await deps.demoSessionsRepository.createSession({
        publicSessionId: parsed.data.sessionId,
        verticalSlug: demoVertical,
        mode: demoMode,
        source: demoSource,
        callbackPhone: normalizedPhone,
        businessName: parsed.data.shopName,
        city: parsed.data.demoConfig?.city ?? null,
        businessHours: {
          primaryHours: parsed.data.demoConfig?.primaryHours,
          secondaryHours: parsed.data.demoConfig?.secondaryHours,
        },
        staff,
        notes: parsed.data.notes ?? null,
        systemPrompt,
        services,
        clientIp: ip,
        clientCountry: resolveDemoClientCountryForPersistence(normalizeCfIpCountry(c.req.header('CF-IPCountry')), normalizedPhone),
      });
      await deps.demoSessionsRepository.createCallRun({
        demoSessionId: demoSession.id,
        requestId,
        provider: 'marketing_demo_web',
        roomName,
        status: 'dialing',
        startedAt: new Date(),
      });
      await deps.demoSessionsRepository.addStatusEvent({
        demoSessionId: demoSession.id,
        requestId,
        eventType: 'demo_web_session_requested',
        payload: {
          demoVertical,
          demoMode,
          demoSource,
        },
      });

      const realtime = await deps.realtimeAgentRuntime.startInboundSession({
        requestId,
        roomName,
        shopId: demoShop.id,
        destinationPhone: demoShop.phone_number,
        callerPhone: normalizedPhone,
        systemPrompt,
        shopPlan: demoShop.plan,
        shopLanguages: demoShop.languages,
      });

      if (requireLivekitRealtimeInProduction() && realtime.mode !== 'livekit_realtime') {
        logger.error(
          {
            requestId,
            mode: realtime.mode,
          },
          'public_demo_web_session_realtime_mode_not_allowed_in_production',
        );
        return c.json({ ok: false, error: 'demo_runtime_not_configured' }, 503);
      }

      if (realtime.metadata?.dispatchPayload) {
        realtime.metadata.dispatchPayload.toolPolicy = {
          allowedTools: [],
          blockMessage: 'This live demo explains the flow but does not perform real booking actions.',
        };
        realtime.metadata.dispatchPayload.demo = {
          isolated: true,
          source: demoSource,
          vertical: demoVertical,
          mode: demoMode,
        };
      }

      await dispatchRealtimeSession({
        requestId,
        roomName,
        destinationPhone: demoShop.phone_number,
        callerPhone: normalizedPhone,
        systemPrompt,
        realtime,
      });

      await deps.demoSessionsRepository.addStatusEvent({
        demoSessionId: demoSession.id,
        requestId,
        eventType: 'demo_web_realtime_dispatched',
        payload: {
          demoVertical,
          mode: realtime.mode,
        },
      });

      const previewToken = await signDemoPreviewToken({
        requestId,
        shopId: demoShop.id,
        callerPhone: normalizedPhone,
      });

      const liveKitBrowserUrl = toLiveKitBrowserWsUrl(env.LIVEKIT_URL);
      const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity: `web-demo-${requestId.slice(-18)}`,
        name: 'Web demo',
        ttl: '45m',
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });
      const liveKitToken = await at.toJwt();

      securityAudit({
        action: 'public_demo_web_session_requested',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: {
          requestId,
          shopId: demoShop.id,
          businessType: parsed.data.businessType,
          demoVertical,
          demoMode,
          demoSource,
        },
      });

      return c.json({
        ok: true,
        requestId,
        previewToken,
        roomName,
        liveKitUrl: liveKitBrowserUrl,
        liveKitToken,
        mode: realtime.mode,
      });
    } catch (error) {
      await deps.demoSessionsRepository.markCallRunStatusByRequestId({
        requestId,
        status: 'failed',
        endedAt: new Date(),
        outcome: 'error',
      });
      await deps.demoSessionsRepository.addStatusEvent({
        requestId,
        eventType: 'demo_web_session_failed',
        payload: { error: error instanceof Error ? error.message : 'unknown_error' },
      });
      logger.error(
        {
          err: error,
          requestId,
        },
        'public_demo_web_session_failed',
      );
      return c.json({ ok: false, error: 'demo_web_session_failed' }, 502);
    }
  });

  /**
   * Persist marketing demo form context for OpenAI SIP inbound pilot (no outbound call).
   * Pair with `OPENAI_SIP_*` + Telnyx → OpenAI SIP; caller phone should match `callbackPhone`.
   */
  app.post(path('/public/demo/sip-prep'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_sip_prep, 'public_demo_sip_prep');
    if (limited) return limited;

    const body = await c.req.json().catch(() => null);
    const parsed = publicDemoRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.website && parsed.data.website.trim().length > 0) {
      securityAudit({
        action: 'public_demo_honeypot_triggered',
        actorType: 'public',
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
      });
      return c.json({ ok: false, error: 'invalid_request' }, 400);
    }

    const sessionIp = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const sessionLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_demo_request_session,
      `public_demo_sip_prep_session:${sessionIp}:${parsed.data.sessionId}`,
    );
    if (sessionLimited) return sessionLimited;

    const normalizedPhone = normalizePhone(parsed.data.phoneNumber);
    if (!normalizedPhone) {
      return c.json({ ok: false, error: 'invalid_phone' }, 400);
    }

    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const phoneShortLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.public_demo_request_phone_short,
      `public_demo_sip_prep_phone_short:${normalizedPhone}`,
    );
    if (phoneShortLimited) return phoneShortLimited;

    const captcha = await verifyTurnstileToken({
      token: parsed.data.captchaToken,
      ip,
    });
    if (!captcha.ok) {
      securityAudit({
        action: 'public_demo_captcha_failed',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: captcha.reason },
      });
      return c.json({ ok: false, error: 'captcha_failed' }, 403);
    }

    if (!deps.demoSessionsRepository) {
      return c.json({ ok: false, error: 'demo_dependencies_unavailable' }, 503);
    }

    const demoVertical = parsed.data.demoVertical ?? parsed.data.businessType.toLowerCase().replace(/\s+/g, '-');
    const demoMode = parsed.data.demoMode ?? 'free-form';
    const demoSource = `${parsed.data.demoSource ?? 'public_demo'}:sip_prep`;

    const systemPrompt = buildPublicDemoSystemPrompt({
      shopName: parsed.data.shopName,
      businessType: parsed.data.businessType,
      demoVertical: parsed.data.demoVertical,
      staffName: parsed.data.staffName,
      notes: parsed.data.notes,
      demoConfig: parsed.data.demoConfig,
    });

    const services =
      parsed.data.demoConfig?.services?.map((s) => ({
        category: s.category,
        name: s.name,
        price: s.price ?? null,
        duration: s.duration ?? null,
        enabled: s.enabled ?? true,
      })) ?? [];

    try {
      const demoSession = await deps.demoSessionsRepository.createSession({
        publicSessionId: parsed.data.sessionId,
        verticalSlug: demoVertical,
        mode: demoMode,
        source: demoSource,
        callbackPhone: normalizedPhone,
        businessName: parsed.data.shopName,
        city: parsed.data.demoConfig?.city ?? null,
        businessHours: {
          primaryHours: parsed.data.demoConfig?.primaryHours,
          secondaryHours: parsed.data.demoConfig?.secondaryHours,
        },
        staff: parsed.data.demoConfig?.staffNames?.length
          ? parsed.data.demoConfig.staffNames
          : parsed.data.staffName
            ? [parsed.data.staffName]
            : [],
        notes: parsed.data.notes ?? null,
        systemPrompt,
        services,
        clientIp: ip,
        clientCountry: resolveDemoClientCountryForPersistence(normalizeCfIpCountry(c.req.header('CF-IPCountry')), normalizedPhone),
      });
      await deps.demoSessionsRepository.addStatusEvent({
        demoSessionId: demoSession.id,
        eventType: 'sip_demo_context_saved',
        payload: { demoVertical, demoMode },
      });
      securityAudit({
        action: 'public_demo_sip_prep_saved',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { demoVertical },
      });
      return c.json({ ok: true, publicSessionId: parsed.data.sessionId });
    } catch (error) {
      logger.error({ err: error }, 'public_demo_sip_prep_failed');
      return c.json({ ok: false, error: 'sip_prep_failed' }, 502);
    }
  });

  app.get(path('/public/demo/status/:requestId'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_status, 'public_demo_status');
    if (limited) return limited;

    const requestId = c.req.param('requestId');
    const token = c.req.query('token') ?? '';
    if (!requestId || !token) {
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const verified = await verifyDemoPreviewToken(token);
    if (!verified || verified.requestId !== requestId) {
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    if (!deps.demoSessionsRepository) {
      return c.json({ ok: false, error: 'demo_dependencies_unavailable' }, 503);
    }

    const call = await deps.demoSessionsRepository.findCallRunByRequestId(requestId);
    const stage = call ? mapDemoCallRunStatusToStage(call.status) : 'queued';

    return c.json({
      ok: true,
      stage,
      call: call
        ? {
            callerPhone: call.callbackPhone ?? null,
            startedAt: call.startedAt ?? null,
            endedAt: call.endedAt ?? null,
            outcome: call.outcome ?? null,
            transcriptStatus: call.status === 'completed' ? 'completed' : call.status === 'failed' ? 'failed' : 'pending',
            transcriptText: null,
            demoLiveState: call.status === 'live' ? 'ai_agent_speaking' : call.status,
            roomName: call.roomName ?? null,
            requestId: call.requestId ?? null,
            agentJoined: call.status === 'live' || call.status === 'completed',
            humanAnswered: call.status === 'live' || call.status === 'completed',
          }
        : null,
    });
  });

  app.post(path('/public/demo/import-website'), async (c) => {
    // Same-origin guard like the other public demo endpoints: this one fans out outbound
    // fetches and optionally calls OpenAI, so it must not be drivable cross-site.
    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_import_website, 'public_demo_import_website');
    if (limited) return limited;

    if (!getEnv().WEBSITE_IMPORT_ENABLED) {
      return c.json({ ok: false, error: 'website_import_disabled' }, 503);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = importWebsiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    try {
      const env = getEnv();
      // Identical budget + options to the onboarding import so the demo never diverges.
      const result = await importWebsiteWithCache({ url: parsed.data.url, qualityBudgetMs: WEBSITE_IMPORT_BUDGET_MS }, () =>
        importWebsiteForOnboarding({ url: parsed.data.url }, {
          googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY,
          llmEnabled: env.WEBSITE_IMPORT_LLM_ENABLED,
          openAiApiKey: env.OPENAI_API_KEY,
          llmModel: env.WEBSITE_IMPORT_LLM_MODEL,
          llmMaxTokens: env.WEBSITE_IMPORT_LLM_MAX_TOKENS,
          maxBytes: env.WEBSITE_IMPORT_MAX_BYTES,
          renderEndpoint: env.WEBSITE_IMPORT_RENDER_URL,
          renderApiKey: env.WEBSITE_IMPORT_RENDER_API_KEY,
          acquireLlmBudget: acquireWebsiteImportLlmBudget,
          deadlineMs: WEBSITE_IMPORT_BUDGET_MS,
        }),
      );
      return c.json({ ok: result.ok, suggestions: result.suggestions });
    } catch (err) {
      logger.warn({ err }, 'public_demo_import_website_failed');
      return c.json({ ok: false, error: 'import_failed', message: 'Could not read that website. You can fill in the details manually.' }, 200);
    }
  });

  // Internal: sales.ringbooker.com creates a prepared, shareable per-salon demo
  // served at /try/<slug>. Enriches content from the salon website (primary) and
  // returns { demoUrl, requestId, sessionId, expiresAt }. Idempotent per lead.
  app.post(path('/internal/sales/demo-context'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.internal_sales_demo_context, 'internal_sales_demo_context');
    if (limited) return limited;
    if (!ensureInternalAccess(c.req.header('x-internal-api-key') ?? null)) {
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }
    const repo = deps.salesPreparedDemosRepository;
    if (!repo) return c.json({ ok: false, error: 'sales_prepared_demos_unavailable' }, 503);

    const body = await c.req.json().catch(() => null);
    const parsed = salesDemoContextSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const p = parsed.data;

    // Enrich demo content from the salon website (primary source). The thin sales
    // payload is only fallback. Best-effort — a failed import still yields a demo.
    let importedServices: NonNullable<SalesPreparedDemoConfig['services']> = [];
    let importedStaff: string[] = [];
    if (p.websiteUrl && getEnv().WEBSITE_IMPORT_ENABLED) {
      try {
        const env = getEnv();
        const result = await importWebsiteWithCache({ url: p.websiteUrl, qualityBudgetMs: WEBSITE_IMPORT_BUDGET_MS }, () =>
          importWebsiteForOnboarding({ url: p.websiteUrl! }, {
            googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY,
            llmEnabled: env.WEBSITE_IMPORT_LLM_ENABLED,
            openAiApiKey: env.OPENAI_API_KEY,
            llmModel: env.WEBSITE_IMPORT_LLM_MODEL,
            llmMaxTokens: env.WEBSITE_IMPORT_LLM_MAX_TOKENS,
            maxBytes: env.WEBSITE_IMPORT_MAX_BYTES,
            renderEndpoint: env.WEBSITE_IMPORT_RENDER_URL,
            renderApiKey: env.WEBSITE_IMPORT_RENDER_API_KEY,
            acquireLlmBudget: acquireWebsiteImportLlmBudget,
            deadlineMs: WEBSITE_IMPORT_BUDGET_MS,
          }),
        );
        importedServices = (result.suggestions.serviceCatalog.services ?? []).slice(0, 40).map((s) => ({
          category: s.categoryName,
          name: s.name,
          price: s.priceAmount ?? null,
          duration: s.durationText ?? null,
        }));
        importedStaff = (result.suggestions.staffSuggestions ?? []).slice(0, 8).map((s) => s.name).filter(Boolean);
      } catch (err) {
        logger.warn({ err }, 'sales_demo_context_import_failed');
      }
    }

    const verticalLabel = p.demoVertical.replace(/-/g, ' ');
    const services: NonNullable<SalesPreparedDemoConfig['services']> =
      importedServices.length > 0 ? importedServices : p.services.map((name) => ({ category: verticalLabel, name }));
    const staffNames = importedStaff.length > 0 ? importedStaff : p.staffNames;

    const demoConfig: SalesPreparedDemoConfig = {
      services,
      primaryHours: p.primaryHours ?? null,
      secondaryHours: null,
      staffNames,
    };

    const systemPrompt = buildPublicDemoSystemPrompt({
      shopName: p.salonName,
      businessType: verticalLabel,
      demoVertical: p.demoVertical,
      notes: p.notes ?? undefined,
      demoConfig: {
        city: p.city || undefined,
        primaryHours: p.primaryHours ?? undefined,
        staffNames,
        services,
      },
    });

    // Reuse the lead's existing slug if it already has a demo; else mint a readable one.
    const existing = await repo.findByLead(p.salesLeadId);
    let slug = existing?.slug;
    if (!slug) {
      const base = slugifyDemo(`${p.salonName} ${p.city}`) || 'demo';
      slug = (await repo.slugExists(base)) ? `${base}-${randomUUID().slice(0, 4)}` : base;
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const prepared = await repo.upsertByLead({
      salesLeadId: p.salesLeadId,
      slug,
      vertical: p.demoVertical,
      businessName: p.salonName,
      city: p.city || null,
      state: p.state || null,
      websiteUrl: p.websiteUrl ?? null,
      instagramUrl: p.instagramUrl ?? null,
      demoConfig,
      systemPrompt,
      expiresAt,
    });

    return c.json({
      demoUrl: `${getAppBaseUrl(c.req)}/try/${prepared.slug}`,
      requestId: prepared.id,
      sessionId: prepared.id,
      expiresAt: prepared.expiresAt,
    });
  });

  // Public: the /try/<slug> page loads a prepared demo by slug. Deliberately does
  // NOT expose sales_lead_id — attribution resolves slug -> lead server-side at signup.
  app.get(path('/public/demo/prepared/:slug'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_prepared, 'public_demo_prepared');
    if (limited) return limited;
    const repo = deps.salesPreparedDemosRepository;
    if (!repo) return c.json({ ok: false, error: 'unavailable' }, 503);
    const slug = c.req.param('slug');
    if (!slug) return c.json({ ok: false, error: 'not_found' }, 404);
    const demo = await repo.findBySlug(slug);
    if (!demo) return c.json({ ok: false, error: 'not_found' }, 404);
    if (new Date(demo.expiresAt).getTime() < Date.now()) {
      return c.json({ ok: false, error: 'expired' }, 410);
    }
    return c.json({
      ok: true,
      demo: {
        slug: demo.slug,
        vertical: demo.vertical,
        businessName: demo.businessName,
        city: demo.city,
        services: (demo.demoConfig.services ?? []).map((s) => s.name).filter(Boolean),
      },
    });
  });

  // Cost estimate: ~$0.001 per call (gpt-4o-mini, ~150 output tokens)
  // At 1,000 demo sessions/month = ~$1/month; at 10,000 = ~$10/month
  app.post(path('/public/demo/suggested-questions'), async (c) => {
    const ip = getClientIp({ get: (n: string) => c.req.header(n) ?? null });
    // Same-origin guard like the other public demo endpoints — this one proxies to OpenAI.
    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;
    const ipLimited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_suggested_questions_ip, ip);
    if (ipLimited) {
      return c.json({ ok: true, questions: null, source: 'default' });
    }

    const body = await c.req.json().catch(() => null);
    const parsed = z.object({
      businessName: z.string().max(120),
      vertical: z.string().max(60),
      services: z.array(z.string().max(80)).max(40),
      hours: z.string().max(200).optional(),
      city: z.string().max(100).optional(),
      sessionId: z.string().max(80).optional(),
    }).safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    if (parsed.data.sessionId) {
      const sessLimited = await enforceRateLimit(
        c,
        RATE_LIMIT_POLICIES.public_demo_suggested_questions_session,
        `sugq:${parsed.data.sessionId}`,
      );
      if (sessLimited) return c.json({ ok: true, questions: null, source: 'default' });
    }

    if (!parsed.data.services.length) {
      return c.json({ ok: true, questions: null, source: 'default' });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      logger.warn('demo_suggested_questions_no_openai_key');
      return c.json({ ok: true, questions: null, source: 'default' });
    }

    const t0 = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are generating realistic sample caller questions for a voice AI demo for a beauty salon. ' +
                'Generate exactly 4 questions a real caller might ask this specific salon over the phone. ' +
                'Rules: use the actual service names provided — do not invent services; ' +
                'questions must be natural spoken language, not formal; ' +
                'mix question types: pricing, availability, booking, info; ' +
                'keep each question under 12 words; ' +
                'do not repeat the same question type twice. ' +
                'Return JSON only: { "questions": ["q1", "q2", "q3", "q4"] }',
            },
            {
              role: 'user',
              content: [
                `Salon: ${parsed.data.businessName}`,
                parsed.data.city ? `Location: ${parsed.data.city}` : '',
                `Vertical: ${parsed.data.vertical}`,
                `Services offered: ${parsed.data.services.slice(0, 20).join(', ')}`,
                parsed.data.hours ? `Hours: ${parsed.data.hours}` : '',
                '',
                'Generate 4 realistic caller questions for this salon.',
              ].filter(Boolean).join('\n'),
            },
          ],
        }),
      });

      const elapsed = Date.now() - t0;
      const data = res.ok ? ((await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null) : null;
      const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
      let questions: string[] | null = null;
      try {
        const parsed2 = JSON.parse(content) as { questions?: unknown };
        if (Array.isArray(parsed2.questions) && parsed2.questions.length > 0) {
          questions = (parsed2.questions as unknown[])
            .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
            .slice(0, 5);
        }
      } catch { /* fall through to default */ }

      logger.info({
        vertical: parsed.data.vertical,
        servicesCount: parsed.data.services.length,
        elapsedMs: elapsed,
        fallback: questions === null,
      }, 'demo_suggested_questions_generated');

      if (!questions?.length) return c.json({ ok: true, questions: null, source: 'default' });
      return c.json({ ok: true, questions: questions.map((text, i) => ({ id: `q${i}`, text })), source: 'ai' });
    } catch (err) {
      logger.warn({ err, elapsedMs: Date.now() - t0 }, 'demo_suggested_questions_failed');
      return c.json({ ok: true, questions: null, source: 'default' });
    }
  });

  // Cost estimate: ~$0.001 per call (gpt-4o-mini, ~100 output tokens)
  // At 1,000 demo sessions/month = ~$1/month; at 10,000 = ~$10/month
  app.post(path('/public/demo/extract-call-summary'), async (c) => {
    const ip = getClientIp({ get: (n: string) => c.req.header(n) ?? null });
    // Same-origin guard like the other public demo endpoints — this one proxies to OpenAI.
    const originDenied = enforcePublicDemoRealtimeOrigin(c);
    if (originDenied) return originDenied;
    const ipLimited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.public_demo_extract_call_ip, ip);
    if (ipLimited) return c.json({ ok: true, hasRealData: false });

    const body = await c.req.json().catch(() => null);
    const parsed = z.object({
      transcript: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(1000) })).max(80),
      vertical: z.string().max(60),
      businessName: z.string().max(120),
      sessionId: z.string().max(80).optional(),
    }).safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    if (parsed.data.sessionId) {
      const sessLimited = await enforceRateLimit(
        c,
        RATE_LIMIT_POLICIES.public_demo_extract_call_session,
        `extract:${parsed.data.sessionId}`,
      );
      if (sessLimited) return c.json({ ok: true, hasRealData: false });
    }

    const turns = parsed.data.transcript;
    if (turns.length < 2) return c.json({ ok: true, hasRealData: false });

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return c.json({ ok: true, hasRealData: false });

    const transcriptText = turns
      .map((t) => `${t.role === 'user' ? 'Caller' : 'AI'}: ${t.text}`)
      .join('\n')
      .slice(0, 3000);

    const t0 = Date.now();
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 200,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are extracting structured data from a demo call transcript for a beauty salon AI receptionist.\n' +
                'Only extract information that was explicitly stated by the caller. Do not infer, guess, or assume any information.\n' +
                'If the caller did not mention their name, return null for callerName.\n' +
                'If the caller did not mention a specific service, return null for serviceRequested.\n' +
                'If the caller did not mention a specific date or time, return null for requestedTime.\n' +
                'Return JSON only: { "callerIntent": "booking|pricing|info|reschedule|null", ' +
                '"serviceRequested": "exact service name spoken by the caller, or null if not explicitly stated", ' +
                '"requestedTime": "exact date or time spoken by the caller, or null if not explicitly stated", ' +
                '"callerName": "exact name spoken by the caller, or null if not explicitly stated", ' +
                '"additionalNotes": "any other detail explicitly stated by the caller, or null" }',
            },
            {
              role: 'user',
              content: `Vertical: ${parsed.data.vertical}\nBusiness: ${parsed.data.businessName}\n\nTranscript:\n${transcriptText}`,
            },
          ],
        }),
      });

      const elapsed = Date.now() - t0;
      const data = res.ok ? ((await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null) : null;
      const content = data?.choices?.[0]?.message?.content?.trim() ?? '';

      let extracted: { callerIntent: string | null; serviceRequested: string | null; requestedTime: string | null; callerName: string | null; additionalNotes: string | null } | null = null;
      try {
        const p = JSON.parse(content) as Record<string, unknown>;
        extracted = {
          callerIntent: typeof p.callerIntent === 'string' ? p.callerIntent : null,
          serviceRequested: typeof p.serviceRequested === 'string' ? p.serviceRequested : null,
          requestedTime: typeof p.requestedTime === 'string' ? p.requestedTime : null,
          callerName: typeof p.callerName === 'string' ? p.callerName : null,
          additionalNotes: typeof p.additionalNotes === 'string' ? p.additionalNotes : null,
        };
      } catch { /* fall through */ }

      const hasRealData = extracted !== null &&
        (extracted.serviceRequested !== null || extracted.requestedTime !== null || extracted.callerName !== null);

      logger.info({
        vertical: parsed.data.vertical,
        turnCount: turns.length,
        elapsedMs: elapsed,
        hasRealData,
      }, 'demo_extract_call_summary_done');

      return c.json({ ok: true, extracted: extracted ?? null, confidence: hasRealData ? 'high' : 'low', hasRealData });
    } catch (err) {
      logger.warn({ err, elapsedMs: Date.now() - t0 }, 'demo_extract_call_summary_failed');
      return c.json({ ok: true, hasRealData: false });
    }
  });
}
