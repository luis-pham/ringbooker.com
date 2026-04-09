import Redis from 'ioredis';

type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
};

type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

type MemoryState = {
  count: number;
  resetAt: number;
  blockedUntil?: number;
};

const memoryStore = new Map<string, MemoryState>();
let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return redisClient;
  }
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  client.on('error', () => {
    // best effort limiter backend
  });
  redisClient = client;
  return redisClient;
}

function toKey(policy: RateLimitPolicy, identity: string): string {
  return `rb:rl:${policy.name}:${identity}`;
}

function secondsFromMs(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

async function consumeWithRedis(policy: RateLimitPolicy, identity: string): Promise<RateLimitResult | null> {
  const client = getRedisClient();
  if (!client) return null;
  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    const now = Date.now();
    const key = toKey(policy, identity);
    const blockKey = `${key}:block`;

    const blockTtl = await client.pttl(blockKey);
    if (blockTtl > 0) {
      return {
        ok: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterSec: secondsFromMs(blockTtl),
      };
    }

    const count = await client.incr(key);
    if (count === 1) {
      await client.pexpire(key, policy.windowMs);
    }
    const ttl = await client.pttl(key);
    const remaining = Math.max(0, policy.limit - count);
    if (count > policy.limit) {
      if (policy.blockMs && policy.blockMs > 0) {
        await client.set(blockKey, '1', 'PX', policy.blockMs);
      }
      return {
        ok: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterSec: secondsFromMs(policy.blockMs && policy.blockMs > 0 ? policy.blockMs : ttl),
      };
    }
    return {
      ok: true,
      limit: policy.limit,
      remaining,
      retryAfterSec: secondsFromMs(ttl > 0 ? ttl : policy.windowMs),
    };
  } catch {
    return null;
  }
}

function consumeWithMemory(policy: RateLimitPolicy, identity: string): RateLimitResult {
  const now = Date.now();
  const key = toKey(policy, identity);
  const existing = memoryStore.get(key);

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      ok: false,
      limit: policy.limit,
      remaining: 0,
      retryAfterSec: secondsFromMs(existing.blockedUntil - now),
    };
  }

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + policy.windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return {
      ok: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - 1),
      retryAfterSec: secondsFromMs(policy.windowMs),
    };
  }

  existing.count += 1;
  if (existing.count > policy.limit) {
    if (policy.blockMs && policy.blockMs > 0) {
      existing.blockedUntil = now + policy.blockMs;
    }
    return {
      ok: false,
      limit: policy.limit,
      remaining: 0,
      retryAfterSec: secondsFromMs(
        policy.blockMs && policy.blockMs > 0 ? policy.blockMs : existing.resetAt - now,
      ),
    };
  }

  return {
    ok: true,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - existing.count),
    retryAfterSec: secondsFromMs(existing.resetAt - now),
  };
}

export async function consumeRateLimit(policy: RateLimitPolicy, identity: string): Promise<RateLimitResult> {
  const redisResult = await consumeWithRedis(policy, identity);
  if (redisResult) return redisResult;
  return consumeWithMemory(policy, identity);
}

export function getClientIp(headers: {
  get: (name: string) => string | null | undefined;
}): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf;
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export const RATE_LIMIT_POLICIES = {
  auth_signup_phone_search: {
    name: 'auth_signup_phone_search',
    limit: 30,
    windowMs: 10 * 60_000,
    blockMs: 10 * 60_000,
  },
  auth_signup_user: { name: 'auth_signup_user', limit: 8, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  auth_google_user: { name: 'auth_google_user', limit: 20, windowMs: 10 * 60_000, blockMs: 10 * 60_000 },
  auth_login_user: { name: 'auth_login_user', limit: 5, windowMs: 10 * 60_000, blockMs: 15 * 60_000 },
  auth_login_admin: { name: 'auth_login_admin', limit: 5, windowMs: 10 * 60_000, blockMs: 15 * 60_000 },
  auth_forgot_user: { name: 'auth_forgot_user', limit: 5, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  auth_forgot_admin: { name: 'auth_forgot_admin', limit: 5, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  auth_reset_password: { name: 'auth_reset_password', limit: 8, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  auth_session_read: { name: 'auth_session_read', limit: 120, windowMs: 60_000 },
  user_api: { name: 'user_api', limit: 180, windowMs: 60_000 },
  admin_api: { name: 'admin_api', limit: 180, windowMs: 60_000 },
  admin_mutation: { name: 'admin_mutation', limit: 60, windowMs: 60_000, blockMs: 5 * 60_000 },
  jobs_enqueue: { name: 'jobs_enqueue', limit: 40, windowMs: 60_000, blockMs: 5 * 60_000 },
  agent_simulate_inbound: { name: 'agent_simulate_inbound', limit: 20, windowMs: 60_000, blockMs: 5 * 60_000 },
  agent_start_inbound: { name: 'agent_start_inbound', limit: 20, windowMs: 60_000, blockMs: 5 * 60_000 },
  agent_simulate_inbound_phone: {
    name: 'agent_simulate_inbound_phone',
    limit: 6,
    windowMs: 60_000,
    blockMs: 10 * 60_000,
  },
  agent_start_inbound_phone: {
    name: 'agent_start_inbound_phone',
    limit: 10,
    windowMs: 60_000,
    blockMs: 10 * 60_000,
  },
  public_demo_request: { name: 'public_demo_request', limit: 5, windowMs: 15 * 60_000, blockMs: 60 * 60_000 },
  public_demo_request_session: {
    name: 'public_demo_request_session',
    limit: 3,
    windowMs: 30 * 60_000,
    blockMs: 60 * 60_000,
  },
  public_demo_request_phone_short: {
    name: 'public_demo_request_phone_short',
    limit: 1,
    windowMs: 10 * 60_000,
    blockMs: 30 * 60_000,
  },
  public_demo_request_phone_daily: {
    name: 'public_demo_request_phone_daily',
    limit: 2,
    windowMs: 24 * 60 * 60_000,
    blockMs: 24 * 60 * 60_000,
  },
  public_demo_request_ip_phone: {
    name: 'public_demo_request_ip_phone',
    limit: 3,
    windowMs: 60 * 60_000,
    blockMs: 6 * 60 * 60_000,
  },
  public_contact_request: { name: 'public_contact_request', limit: 8, windowMs: 15 * 60_000, blockMs: 60 * 60_000 },
  public_contact_request_session: {
    name: 'public_contact_request_session',
    limit: 4,
    windowMs: 30 * 60_000,
    blockMs: 60 * 60_000,
  },
  public_contact_request_email_daily: {
    name: 'public_contact_request_email_daily',
    limit: 3,
    windowMs: 24 * 60 * 60_000,
    blockMs: 24 * 60 * 60_000,
  },
  public_contact_request_ip_email: {
    name: 'public_contact_request_ip_email',
    limit: 3,
    windowMs: 60 * 60_000,
    blockMs: 6 * 60 * 60_000,
  },
  public_demo_status: { name: 'public_demo_status', limit: 120, windowMs: 60_000, blockMs: 5 * 60_000 },
  agent_dispatch: { name: 'agent_dispatch', limit: 120, windowMs: 60_000 },
  webhook_telnyx: { name: 'webhook_telnyx', limit: 300, windowMs: 60_000 },
  webhook_paddle: { name: 'webhook_paddle', limit: 120, windowMs: 60_000 },
} as const;
