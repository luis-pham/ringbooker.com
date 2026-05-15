import { createHash } from 'node:crypto';

import type { Context } from 'hono';

/**
 * Direct OpenAI Realtime marketing demo guards (browser → `POST /public/demo/realtime-session`).
 *
 * Active slot ledger is backed by Redis (SET NX EX) for multi-node correctness.
 * Falls back to an in-process Map when Redis is unavailable — single-node only in that case.
 * Serialized per-IP handler (`runDirectDemoSerialized`) queues same-IP requests to prevent races
 * on in-process rate-limit checks; different IPs run in parallel.
 * Clients should `POST /public/demo/realtime-session/release` when a demo ends so another tab can
 * start sooner than the TTL; otherwise the slot expires naturally via Redis TTL or in-memory prune.
 */
import { getEnv } from '@/src/backend/config/env';
import { getRedisClient } from '@/src/backend/cache/redis';
import { logger } from '@/src/backend/observability/logger';
import { securityAudit } from '@/src/backend/security/audit-log';
import { consumeRateLimit, getClientIp, type RateLimitPolicy } from '@/src/backend/security/rate-limit';

export type PublicDemoRealtimeBlockCode =
  | 'demo_rate_limited_burst'
  | 'demo_rate_limited_ip'
  | 'demo_rate_limited_session'
  | 'demo_rate_limited_global'
  | 'demo_concurrent_session_limit'
  | 'demo_session_expired'
  | 'demo_duration_limit_reached';

/** Fixed user-facing copy + retry hints (not tied to sliding-window remainder). */
export const PUBLIC_DEMO_REALTIME_BLOCKED: Record<
  PublicDemoRealtimeBlockCode,
  { message: string; retryAfterSeconds: number }
> = {
  demo_rate_limited_burst: {
    message: 'You started several demos very quickly. Please wait about a minute and try again.',
    retryAfterSeconds: 60,
  },
  demo_rate_limited_ip: {
    message: "You've reached the demo limit for this network. Please try again in about 15 minutes.",
    retryAfterSeconds: 900,
  },
  demo_rate_limited_session: {
    message: "You've started a few demos from this browser. Please wait about 30 minutes before trying again.",
    retryAfterSeconds: 1800,
  },
  demo_rate_limited_global: {
    message: 'Our live demo is getting a lot of traffic right now. Please try again later.',
    retryAfterSeconds: 3600,
  },
  demo_concurrent_session_limit: {
    message:
      'A demo is already running from this network. Please end that demo or wait a few minutes before starting another.',
    retryAfterSeconds: 300,
  },
  demo_session_expired: {
    message: 'This demo session has ended. You can start a new demo when you are ready.',
    retryAfterSeconds: 60,
  },
  demo_duration_limit_reached: {
    message: 'This demo session has reached the 5-minute limit. You can start a new demo in a moment.',
    retryAfterSeconds: 60,
  },
};

type ActiveSlot = { requestId: string; expiresAt: number };

/** In-process fallback when Redis is unavailable. */
const activeByIp = new Map<string, ActiveSlot>();
const serializedTails = new Map<string, Promise<unknown>>();

const DEMO_SLOT_REDIS_PREFIX = 'demo:active:ip:';

function demoSlotRedisKey(ip: string): string {
  return `${DEMO_SLOT_REDIS_PREFIX}${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
}

/** Lua: delete key only if its value matches requestId. Returns 1 on delete, 0 if mismatch/missing. */
const LUA_COMPARE_AND_DELETE = `if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`;

async function tryOccupySlotRedis(ip: string, requestId: string, ttlMs: number): Promise<boolean | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    if (redis.status === 'wait') await redis.connect();
    const result = await redis.set(demoSlotRedisKey(ip), requestId, 'PX', ttlMs, 'NX');
    return result === 'OK';
  } catch {
    return null;
  }
}

async function releaseSlotRedis(ip: string, requestId: string): Promise<boolean | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    if (redis.status === 'wait') await redis.connect();
    const result = await redis.eval(LUA_COMPARE_AND_DELETE, 1, demoSlotRedisKey(ip), requestId);
    return result === 1;
  } catch {
    return null;
  }
}

async function clearSlotRedis(ip: string, requestId?: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    if (redis.status === 'wait') await redis.connect();
    if (requestId) {
      await redis.eval(LUA_COMPARE_AND_DELETE, 1, demoSlotRedisKey(ip), requestId);
    } else {
      await redis.del(demoSlotRedisKey(ip));
    }
  } catch {
    // best-effort
  }
}

function buildPoliciesFromEnv(): {
  burst: RateLimitPolicy;
  ipBaseline: RateLimitPolicy;
  session: RateLimitPolicy;
  global: RateLimitPolicy;
} {
  const e = getEnv();
  return {
    burst: {
      name: 'public_demo_realtime_burst',
      limit: e.PUBLIC_DEMO_REALTIME_BURST_LIMIT,
      windowMs: e.PUBLIC_DEMO_REALTIME_BURST_WINDOW_SECONDS * 1000,
    },
    ipBaseline: {
      name: 'public_demo_realtime_ip_baseline',
      limit: e.PUBLIC_DEMO_REALTIME_IP_LIMIT,
      windowMs: e.PUBLIC_DEMO_REALTIME_IP_WINDOW_SECONDS * 1000,
    },
    session: {
      name: 'public_demo_realtime_session',
      limit: e.PUBLIC_DEMO_REALTIME_SESSION_LIMIT,
      windowMs: e.PUBLIC_DEMO_REALTIME_SESSION_WINDOW_SECONDS * 1000,
    },
    global: {
      name: 'public_demo_realtime_global',
      limit: e.PUBLIC_DEMO_REALTIME_GLOBAL_LIMIT,
      windowMs: e.PUBLIC_DEMO_REALTIME_GLOBAL_WINDOW_SECONDS * 1000,
    },
  };
}

export function directDemoActiveTtlMs(): number {
  return getEnv().PUBLIC_DEMO_REALTIME_MAX_DURATION_SECONDS * 1000;
}

export function hashIpForDemoLog(ip: string): string {
  if (ip === 'unknown') return 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export function pruneExpiredDirectDemoActives(now = Date.now()): void {
  for (const [ip, slot] of activeByIp) {
    if (slot.expiresAt <= now) activeByIp.delete(ip);
  }
}

/**
 * One active direct-demo reservation per IP.
 * Redis-backed (SET NX EX) for multi-node correctness; falls back to in-process Map with a warning
 * when Redis is unavailable (single-node enforcement only in that case).
 */
export async function tryOccupyDirectDemoActiveSlot(ip: string, requestId: string, ttlMs: number, now = Date.now()): Promise<boolean> {
  const redisResult = await tryOccupySlotRedis(ip, requestId, ttlMs);
  if (redisResult !== null) return redisResult;
  logger.warn({ ipHash: hashIpForDemoLog(ip) }, 'demo_slot_redis_unavailable_fallback_to_memory');
  pruneExpiredDirectDemoActives(now);
  const cur = activeByIp.get(ip);
  if (cur && cur.expiresAt > now) return false;
  activeByIp.set(ip, { requestId, expiresAt: now + ttlMs });
  return true;
}

export function clearDirectDemoActiveSlot(ip: string, requestId?: string): void {
  void clearSlotRedis(ip, requestId);
  // also clear memory fallback
  const cur = activeByIp.get(ip);
  if (!cur) return;
  if (!requestId || cur.requestId === requestId) activeByIp.delete(ip);
}

/** Removes the active slot only when `requestId` matches (used by client release beacon). */
export async function releaseDirectDemoActiveSlot(ip: string, requestId: string): Promise<boolean> {
  const redisResult = await releaseSlotRedis(ip, requestId);
  if (redisResult !== null) {
    // also clear memory fallback if present
    const cur = activeByIp.get(ip);
    if (cur?.requestId === requestId) activeByIp.delete(ip);
    return redisResult;
  }
  // fallback: memory only
  const cur = activeByIp.get(ip);
  if (!cur || cur.requestId !== requestId) return false;
  activeByIp.delete(ip);
  return true;
}

// ─── Global cap monitoring ────────────────────────────────────────────────────

const GLOBAL_CAP_ALERT_THRESHOLD_PCT = 0.20; // alert when ≤ 20% remaining
const GLOBAL_CAP_ALERT_COOLDOWN_MS = 60 * 60_000; // max 1 capacity alert per hour

let lastGlobalCapAlertAt: number | undefined;

function trackDemoGlobalCapAlert(limit: number, remaining: number): void {
  const now = Date.now();
  const pct = remaining / limit;

  if (remaining <= 0) {
    // CRITICAL: cap fully reached
    if (!lastGlobalCapAlertAt || now - lastGlobalCapAlertAt >= GLOBAL_CAP_ALERT_COOLDOWN_MS) {
      lastGlobalCapAlertAt = now;
      logger.error(
        {
          alert: true,
          severity: 'critical',
          key: 'demo_global_cap_reached',
          globalLimit: limit,
          remaining: 0,
        },
        'Demo global daily cap REACHED — all new demo sessions are being rejected',
      );
    }
    return;
  }

  if (pct <= GLOBAL_CAP_ALERT_THRESHOLD_PCT) {
    if (!lastGlobalCapAlertAt || now - lastGlobalCapAlertAt >= GLOBAL_CAP_ALERT_COOLDOWN_MS) {
      lastGlobalCapAlertAt = now;
      const usedPct = Math.round((1 - pct) * 100);
      logger.warn(
        {
          alert: true,
          severity: 'warning',
          key: 'demo_global_cap_threshold',
          globalLimit: limit,
          remaining,
          usedPercent: usedPct,
        },
        `Demo global daily cap at ${usedPct}% — ${remaining} sessions remaining`,
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Serialize direct-demo work per client IP to avoid races on in-memory limits + active slot. */
export function runDirectDemoSerialized<T>(ip: string, task: () => Promise<T>): Promise<T> {
  const prev = serializedTails.get(ip) ?? Promise.resolve();
  const result = prev.catch(() => undefined).then(() => task());
  serializedTails.set(ip, result);
  void result.finally(() => {
    if (serializedTails.get(ip) === result) serializedTails.delete(ip);
  });
  return result;
}

export async function consumePublicDemoRealtimeLimits(
  ip: string,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; code: PublicDemoRealtimeBlockCode }> {
  const p = buildPoliciesFromEnv();
  const steps: Array<[RateLimitPolicy, string, PublicDemoRealtimeBlockCode]> = [
    [p.burst, ip, 'demo_rate_limited_burst'],
    [p.ipBaseline, ip, 'demo_rate_limited_ip'],
    [p.session, `${ip}:${sessionId}`, 'demo_rate_limited_session'],
    [p.global, 'global:public_demo_realtime', 'demo_rate_limited_global'],
  ];
  for (const [policy, identity, code] of steps) {
    const r = await consumeRateLimit(policy, identity);
    if (!r.ok) {
      if (code === 'demo_rate_limited_global') {
        trackDemoGlobalCapAlert(p.global.limit, 0);
      }
      return { ok: false, code };
    }
    if (code === 'demo_rate_limited_global') {
      trackDemoGlobalCapAlert(p.global.limit, r.remaining);
    }
  }
  return { ok: true };
}

export function jsonPublicDemoRealtimeBlocked(
  c: Context,
  code: PublicDemoRealtimeBlockCode,
  meta?: { requestId?: string; vertical?: string | null },
): Response {
  const spec = PUBLIC_DEMO_REALTIME_BLOCKED[code];
  const ip = getClientIp({ get: (n: string) => c.req.header(n) ?? null });
  securityAudit({
    action: 'public_demo_realtime_limit_blocked',
    actorType: 'public',
    ip,
    path: c.req.path,
    details: {
      code,
      requestId: meta?.requestId ?? null,
      vertical: meta?.vertical ?? null,
      ipHash: hashIpForDemoLog(ip),
      retryAfterSeconds: spec.retryAfterSeconds,
    },
  });
  c.header('Retry-After', String(spec.retryAfterSeconds));
  c.header('X-RateLimit-Limit', '0');
  c.header('X-RateLimit-Remaining', '0');
  return c.json(
    {
      ok: false,
      code,
      message: spec.message,
      retryAfterSeconds: spec.retryAfterSeconds,
    },
    429,
  );
}

/**
 * Same-origin guard for browser-initiated public demo POSTs (Host must match Origin/Referer host).
 * Returns a JSON 403 when blocked.
 */
export function enforcePublicDemoRealtimeOrigin(c: Context): Response | null {
  const origin = c.req.header('origin') ?? null;
  const referer = c.req.header('referer') ?? null;
  if (!origin && !referer) {
    securityAudit({
      action: 'csrf_blocked',
      actorType: 'public',
      ip: getClientIp({ get: (n: string) => c.req.header(n) ?? null }),
      path: c.req.path,
      details: { reason: 'missing_origin_or_referer', surface: 'public_demo_realtime' },
    });
    return c.json(
      {
        ok: false,
        code: 'forbidden_origin',
        message: 'This demo can only be started from the RingBooker website.',
        retryAfterSeconds: 0,
      },
      403,
    );
  }
  let requestHost: string;
  try {
    requestHost = new URL(origin || referer || '').host;
  } catch {
    return c.json(
      {
        ok: false,
        code: 'forbidden_origin',
        message: 'This demo can only be started from the RingBooker website.',
        retryAfterSeconds: 0,
      },
      403,
    );
  }
  const host = c.req.header('host') ?? requestHost;
  if (requestHost !== host) {
    securityAudit({
      action: 'csrf_blocked',
      actorType: 'public',
      ip: getClientIp({ get: (n: string) => c.req.header(n) ?? null }),
      path: c.req.path,
      details: { origin, referer, host, surface: 'public_demo_realtime' },
    });
    return c.json(
      {
        ok: false,
        code: 'forbidden_origin',
        message: 'This demo can only be started from the RingBooker website.',
        retryAfterSeconds: 0,
      },
      403,
    );
  }
  return null;
}

export function __resetPublicDemoRealtimeGuardForTests(): void {
  activeByIp.clear();
  serializedTails.clear();
}

/** Test-only: clear active direct-demo slot for an IP (real clients release via `/realtime-session/release`). */
export function __clearDirectDemoActiveForTests(ip: string): void {
  activeByIp.delete(ip);
}

/** Test-only: force the active slot for `ip` to appear expired on next prune. */
export function __expireDirectDemoActiveForTests(ip: string): void {
  const cur = activeByIp.get(ip);
  if (cur) activeByIp.set(ip, { ...cur, expiresAt: Date.now() - 1000 });
}
