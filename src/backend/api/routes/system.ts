import type { Hono } from 'hono';
import {
  ensureInternalAccess,
  securityAudit,
  getClientIp,
  resolveEmailProviderMode,
  getMetricsSnapshot,
} from '../app-shared';

type SystemDeps = {
  runtimeInfo?: {
    mode: 'memory' | 'supabase';
    commProvider: 'noop' | 'telnyx';
    agentRuntimeMode?: 'mock' | 'livekit_realtime';
    agentTransportMode?: 'mock' | 'livekit';
    agentVoiceProviderMode?: 'none' | 'gemini_live' | 'openai_realtime';
  };
};

export function registerSystemRoutes(app: Hono, path: (route: string) => string, deps: SystemDeps): void {
  app.get(path('/runtime'), (c) => {
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
    return c.json({
      ok: true,
      mode: deps.runtimeInfo?.mode ?? 'memory',
      commProvider: deps.runtimeInfo?.commProvider ?? 'noop',
      agentRuntimeMode: deps.runtimeInfo?.agentRuntimeMode ?? 'mock',
      agentTransportMode: deps.runtimeInfo?.agentTransportMode ?? 'mock',
      agentVoiceProviderMode: deps.runtimeInfo?.agentVoiceProviderMode ?? 'none',
      agentVoiceModel: process.env.AGENT_VOICE_MODEL ?? process.env.AGENT_GEMINI_MODEL ?? null,
      emailProvider: resolveEmailProviderMode(),
    });
  });

  app.get(path('/metrics'), (c) => {
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
    return c.json({
      ok: true,
      ...getMetricsSnapshot(),
    });
  });

}
