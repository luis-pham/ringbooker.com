import { timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';

import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import { executeSingleJobsWorkerTickWithRuntime, scheduleTrialLifecycleJobsWithRuntime } from '@/src/backend/jobs/runner';
import { securityAudit } from '@/src/backend/security/audit-log';
import {
  consumeRateLimit,
  getClientIp,
  rateLimitUserMessage,
  RATE_LIMIT_POLICIES,
} from '@/src/backend/security/rate-limit';

/**
 * Lazy-init avoids calling getEnv()/getBackendRuntime() while Next.js imports this module
 * during `next build` (collect page data). Env is only validated on first API request.
 */
let honoApp: Hono | null = null;

function internalKeyDenied(providedKey: string | null | undefined): boolean {
  const internalKey = process.env.BACKEND_INTERNAL_API_KEY;
  if (!internalKey) return process.env.NODE_ENV === 'production';
  if (!providedKey) return true;
  const provided = Buffer.from(providedKey);
  const expected = Buffer.from(internalKey);
  return provided.length !== expected.length || !timingSafeEqual(provided, expected);
}

function getHonoApp(): Hono {
  if (honoApp) return honoApp;

  const backendRuntime = getBackendRuntime();
  const app = new Hono();

  app.route('/', backendRuntime.app);

  app.post('/api/backend/jobs/tick', async (c) => {
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    const rate = await consumeRateLimit(RATE_LIMIT_POLICIES.jobs_enqueue, `${ip}:jobs_tick`);
    c.header('X-RateLimit-Limit', String(rate.limit));
    c.header('X-RateLimit-Remaining', String(rate.remaining));
    c.header('Retry-After', String(rate.retryAfterSec));
    if (!rate.ok) {
      securityAudit({
        action: 'rate_limit_blocked',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { policy: RATE_LIMIT_POLICIES.jobs_enqueue.name },
      });
      return c.json(
        {
          ok: false,
          error: 'rate_limited',
          message: rateLimitUserMessage(rate.retryAfterSec),
          retryAfterSec: rate.retryAfterSec,
        },
        429,
      );
    }

    if (internalKeyDenied(c.req.header('x-backend-key'))) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const result = await executeSingleJobsWorkerTickWithRuntime(backendRuntime);
    return c.json({
      ok: true,
      processed: result.processed,
      executedAt: new Date().toISOString(),
    });
  });

  app.post('/api/backend/jobs/trial-lifecycle', async (c) => {
    const ip = getClientIp({ get: (name: string) => c.req.header(name) ?? null });
    if (internalKeyDenied(c.req.header('x-backend-key'))) {
      securityAudit({
        action: 'authz_denied',
        actorType: 'public',
        ip,
        path: c.req.path,
        details: { reason: 'internal_key_required' },
      });
      return c.json({ ok: false, error: 'unauthorized' }, 401);
    }

    const result = await scheduleTrialLifecycleJobsWithRuntime(backendRuntime);
    return c.json({
      ok: true,
      ...result,
      executedAt: new Date().toISOString(),
    });
  });

  honoApp = app;
  return honoApp;
}

function honoFetch(req: Request): Response | Promise<Response> {
  const headers = new Headers(req.headers);
  // This internal header is consumed by the backend rate limiter. Never pass
  // through a client-supplied value; deployment must opt into a platform header
  // that the edge/proxy controls (for example x-vercel-forwarded-for or x-real-ip).
  headers.delete('x-rb-remote-addr');
  const platformIpHeader = process.env.RB_PLATFORM_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (platformIpHeader) {
    const platformIp = req.headers.get(platformIpHeader)?.split(',')[0]?.trim();
    if (platformIp) headers.set('x-rb-remote-addr', platformIp);
  }
  return getHonoApp().fetch(new Request(req, { headers }));
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = honoFetch;
export const POST = honoFetch;
export const PUT = honoFetch;
export const PATCH = honoFetch;
export const DELETE = honoFetch;
