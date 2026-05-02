import { Hono } from 'hono';

import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import { executeSingleJobsWorkerTickWithRuntime } from '@/src/backend/jobs/runner';
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

    const internalKey = process.env.BACKEND_INTERNAL_API_KEY;
    const providedKey = c.req.header('x-backend-key');
    if ((internalKey && providedKey !== internalKey) || (!internalKey && process.env.NODE_ENV === 'production')) {
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

  honoApp = app;
  return honoApp;
}

function honoFetch(req: Request): Response | Promise<Response> {
  return getHonoApp().fetch(req);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = honoFetch;
export const POST = honoFetch;
export const PUT = honoFetch;
export const PATCH = honoFetch;
export const DELETE = honoFetch;
