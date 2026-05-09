import Redis from 'ioredis';

export type RateLimitPolicy = {
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

/** Clears in-memory counters (used by integration tests; no-op for Redis-backed limits). */
export function __resetRateLimitMemoryStoreForTests(): void {
  memoryStore.clear();
}
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

/**
 * Human-readable text for JSON 429 responses. Aligns with `Retry-After` / `retryAfterSec`.
 */
export function rateLimitUserMessage(retryAfterSec: number): string {
  const sec = Math.max(1, Math.floor(retryAfterSec));
  if (sec <= 90) {
    return 'Too many requests. Please wait about a minute and try again.';
  }
  if (sec < 3600) {
    const mins = Math.max(1, Math.ceil(sec / 60));
    return mins <= 1
      ? 'Too many requests. Please wait about a minute and try again.'
      : `Too many requests. Please wait about ${mins} minutes and try again.`;
  }
  const hours = Math.max(1, Math.round(sec / 3600));
  return hours === 1
    ? 'Too many requests. Please wait about an hour and try again.'
    : `Too many requests. Please wait about ${hours} hours and try again.`;
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
  user_provision_forwarding_number: {
    name: 'user_provision_forwarding_number',
    limit: 3,
    windowMs: 60 * 60_000,
    blockMs: 60 * 60_000,
  },
  user_test_calls_call_me: {
    name: 'user_test_calls_call_me',
    limit: 3,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  },
  user_start_forwarding_test: {
    name: 'user_start_forwarding_test',
    limit: 5,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  },
  user_confirm_forwarding_setup: {
    name: 'user_confirm_forwarding_setup',
    limit: 5,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  },
  user_go_live_enable: {
    name: 'user_go_live_enable',
    limit: 10,
    windowMs: 60 * 60_000,
    blockMs: 60 * 60_000,
  },
  admin_api: { name: 'admin_api', limit: 180, windowMs: 60_000 },
  /** Expensive time-series aggregation; tighter than generic admin_api to reduce DB abuse */
  admin_chart_query: { name: 'admin_chart_query', limit: 72, windowMs: 60_000, blockMs: 5 * 60_000 },
  /** Demo call transcript body can be large; limit bulk scraping */
  admin_demo_transcript_read: { name: 'admin_demo_transcript_read', limit: 48, windowMs: 60_000, blockMs: 5 * 60_000 },
  /** Per-admin cap on invites (insider / mistaken bulk) — keyed by actor email, not IP */
  admin_user_invite_by_actor: {
    name: 'admin_user_invite_by_actor',
    limit: 12,
    windowMs: 60 * 60_000,
    blockMs: 30 * 60_000,
  },
  /** Per-admin cap on password resets set via admin UI */
  admin_user_password_set_by_actor: {
    name: 'admin_user_password_set_by_actor',
    limit: 10,
    windowMs: 60 * 60_000,
    blockMs: 30 * 60_000,
  },
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
  /** Browser LiveKit web demo (no outbound call to visitor phone). */
  public_demo_web_session: { name: 'public_demo_web_session', limit: 5, windowMs: 15 * 60_000, blockMs: 60 * 60_000 },
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
  user_billing_checkout: { name: 'user_billing_checkout', limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  user_billing_reactivate: { name: 'user_billing_reactivate', limit: 5, windowMs: 60 * 60_000, blockMs: 60 * 60_000 },
  agent_dispatch: { name: 'agent_dispatch', limit: 120, windowMs: 60_000 },
  webhook_telnyx: { name: 'webhook_telnyx', limit: 300, windowMs: 60_000 },
  webhook_paddle: { name: 'webhook_paddle', limit: 120, windowMs: 60_000 },
  /** OpenAI Standard Webhooks (Realtime SIP + other project events) */
  webhook_openai: { name: 'webhook_openai', limit: 240, windowMs: 60_000 },
  /** Telnyx TeXML Voice URL → OpenAI SIP dial (isolated from JSON `webhooks/telnyx`). */
  texml_telnyx_openai_inbound: { name: 'texml_telnyx_openai_inbound', limit: 180, windowMs: 60_000 },
  /** Save demo form context for inbound SIP pilot (no telephony). */
  public_demo_sip_prep: { name: 'public_demo_sip_prep', limit: 8, windowMs: 15 * 60_000, blockMs: 60 * 60_000 },
  /** Burst control per OpenAI `call_id` on SIP webhook path */
  openai_sip_per_call_id: { name: 'openai_sip_per_call_id', limit: 6, windowMs: 60_000 },
  /** Anti-abuse per PSTN CLI on SIP pilot */
  openai_sip_per_caller: { name: 'openai_sip_per_caller', limit: 12, windowMs: 60 * 60_000 },
  /** Per pilot DID */
  openai_sip_per_did: { name: 'openai_sip_per_did', limit: 60, windowMs: 60_000 },
  /** Client beacon to release concurrent direct-demo slot (per IP). */
  public_demo_realtime_release: { name: 'public_demo_realtime_release', limit: 60, windowMs: 60_000 },
} as const;
