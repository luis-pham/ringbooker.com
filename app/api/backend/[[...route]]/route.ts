import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';
import { executeSingleJobsWorkerTickWithRuntime } from '@/src/backend/jobs/runner';
import { securityAudit } from '@/src/backend/security/audit-log';
import { consumeRateLimit, getClientIp, RATE_LIMIT_POLICIES } from '@/src/backend/security/rate-limit';

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
    return c.json({ ok: false, error: 'rate_limited' }, 429);
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

export const runtime = 'nodejs';

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
