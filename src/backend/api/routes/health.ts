import type { Hono } from 'hono';
import {
  ensureInternalAccess,
  securityAudit,
  getClientIp,
} from '../app-shared';

type RuntimeInfo = {
  mode: 'memory' | 'supabase';
  commProvider: 'noop' | 'telnyx';
  agentRuntimeMode?: 'mock' | 'livekit_realtime';
  agentTransportMode?: 'mock' | 'livekit';
  agentVoiceProviderMode?: 'none' | 'gemini_live' | 'openai_realtime';
};

export type RegisterHealthRoutesDeps = {
  runtimeInfo?: RuntimeInfo;
};

export function registerHealthRoutes(app: Hono, path: (route: string) => string, deps: RegisterHealthRoutesDeps): void {
  app.get(path('/health'), (c) => c.json({ ok: true }));
  app.get(path('/readiness'), (c) => {
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

    const isProduction = process.env.NODE_ENV === 'production';
    const mode = deps.runtimeInfo?.mode ?? 'memory';
    const commProvider = deps.runtimeInfo?.commProvider ?? 'noop';
    const agentRuntimeMode = deps.runtimeInfo?.agentRuntimeMode ?? 'mock';
    const agentTransportMode = deps.runtimeInfo?.agentTransportMode ?? (agentRuntimeMode === 'livekit_realtime' ? 'livekit' : 'mock');
    const agentVoiceProviderMode =
      deps.runtimeInfo?.agentVoiceProviderMode ?? (agentRuntimeMode === 'livekit_realtime' ? 'gemini_live' : 'none');
    const checks = [
      {
        key: 'app_signing_secret',
        ok: typeof process.env.APP_SIGNING_SECRET === 'string' && process.env.APP_SIGNING_SECRET.length >= 32,
      },
      {
        key: 'app_encryption_key',
        ok: typeof process.env.APP_ENCRYPTION_KEY === 'string' && process.env.APP_ENCRYPTION_KEY.length >= 32,
      },
      ...(isProduction
        ? [
            {
              key: 'turnstile_secret_key',
              ok: typeof process.env.TURNSTILE_SECRET_KEY === 'string' && process.env.TURNSTILE_SECRET_KEY.length > 0,
            },
            {
              key: 'backend_internal_api_key',
              ok: typeof process.env.BACKEND_INTERNAL_API_KEY === 'string' && process.env.BACKEND_INTERNAL_API_KEY.length >= 16,
            },
            {
              key: 'production_repository_mode_supabase',
              ok: mode === 'supabase',
            },
            {
              key: 'production_comm_provider_telnyx',
              ok: commProvider === 'telnyx',
            },
            {
              key: 'production_agent_runtime_livekit_realtime',
              ok: agentRuntimeMode === 'livekit_realtime',
            },
          ]
        : []),
      ...(mode === 'supabase'
        ? [
            {
              key: 'supabase_url',
              ok: typeof process.env.SUPABASE_URL === 'string' && process.env.SUPABASE_URL.length > 0,
            },
            {
              key: 'supabase_service_key',
              ok: typeof process.env.SUPABASE_SERVICE_KEY === 'string' && process.env.SUPABASE_SERVICE_KEY.length > 0,
            },
          ]
        : []),
      ...(commProvider === 'telnyx'
        ? [
            {
              key: 'telnyx_api_key',
              ok: typeof process.env.TELNYX_API_KEY === 'string' && process.env.TELNYX_API_KEY.length > 0,
            },
            {
              key: 'telnyx_app_id',
              ok: typeof process.env.TELNYX_APP_ID === 'string' && process.env.TELNYX_APP_ID.length > 0,
            },
            {
              key: 'telnyx_messaging_profile',
              ok: typeof process.env.TELNYX_MESSAGING_PROFILE === 'string' && process.env.TELNYX_MESSAGING_PROFILE.length > 0,
            },
            {
              key: 'telnyx_webhook_public_key',
              ok:
                typeof process.env.TELNYX_WEBHOOK_PUBLIC_KEY === 'string' &&
                process.env.TELNYX_WEBHOOK_PUBLIC_KEY.length > 0,
            },
          ]
        : []),
      ...(agentTransportMode === 'livekit'
        ? [
            {
              key: 'livekit_url',
              ok: typeof process.env.LIVEKIT_URL === 'string' && process.env.LIVEKIT_URL.length > 0,
            },
            {
              key: 'livekit_api_key',
              ok: typeof process.env.LIVEKIT_API_KEY === 'string' && process.env.LIVEKIT_API_KEY.length > 0,
            },
            {
              key: 'livekit_api_secret',
              ok: typeof process.env.LIVEKIT_API_SECRET === 'string' && process.env.LIVEKIT_API_SECRET.length > 0,
            },
          ]
        : []),
      ...(agentVoiceProviderMode === 'gemini_live'
        ? [
            {
              key: 'google_ai_api_key',
              ok: typeof process.env.GOOGLE_AI_API_KEY === 'string' && process.env.GOOGLE_AI_API_KEY.length > 0,
            },
          ]
        : []),
      ...(agentVoiceProviderMode === 'openai_realtime'
        ? [
            {
              key: 'openai_api_key',
              ok: typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0,
            },
          ]
        : []),
      ...(process.env.EMAIL_PROVIDER === 'resend'
        ? [
            {
              key: 'email_from_address',
              ok: typeof process.env.EMAIL_FROM_ADDRESS === 'string' && process.env.EMAIL_FROM_ADDRESS.length > 0,
            },
            {
              key: 'resend_api_key',
              ok: typeof process.env.RESEND_API_KEY === 'string' && process.env.RESEND_API_KEY.length > 0,
            },
          ]
        : []),
    ];
    const ok = checks.every((check) => check.ok);
    return c.json(
      {
        ok,
        mode,
        commProvider,
        agentRuntimeMode,
        checks,
      },
      ok ? 200 : 503,
    );
  });
}
