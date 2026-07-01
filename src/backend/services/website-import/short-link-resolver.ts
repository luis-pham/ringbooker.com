import { getRedisClient } from '@/src/backend/cache/redis';
import { isGoogleMapsShortLinkHostname } from '@/lib/google-maps-url';
import { preflightUrl, type DnsLookup } from './security';
import type { WebsiteImportErrorCode } from './types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 5_000;
const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const REDIS_KEY_PREFIX = 'rb:import:shortlink:';
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type MemoryEntry = { resolvedUrl: string; expiresAt: number };
const memoryCache = new Map<string, MemoryEntry>();

function memoryCacheGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.resolvedUrl;
}

function memoryCacheSet(key: string, resolvedUrl: string): void {
  memoryCache.set(key, { resolvedUrl, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 });
}

/** getRedisClient() reads process env validation, which can throw in incomplete environments — this cache must stay best-effort regardless. */
function safeGetRedisClient(): ReturnType<typeof getRedisClient> {
  try {
    return getRedisClient();
  } catch {
    return null;
  }
}

async function getCachedResolution(key: string): Promise<string | null> {
  const fromMemory = memoryCacheGet(key);
  if (fromMemory) return fromMemory;
  const redis = safeGetRedisClient();
  if (!redis) return null;
  const fromRedis = await redis.get(REDIS_KEY_PREFIX + key).catch(() => null);
  if (fromRedis) memoryCacheSet(key, fromRedis);
  return fromRedis;
}

async function setCachedResolution(key: string, resolvedUrl: string): Promise<void> {
  memoryCacheSet(key, resolvedUrl);
  const redis = safeGetRedisClient();
  if (!redis) return;
  await redis.set(REDIS_KEY_PREFIX + key, resolvedUrl, 'EX', CACHE_TTL_SECONDS).catch(() => {
    // best-effort cache write
  });
}

/** Test/ops helper — drops all cached short-link resolutions. */
export function clearShortLinkResolutionCache(): void {
  memoryCache.clear();
}

async function requestOnce(url: string, method: 'HEAD' | 'GET', fetcher: Fetcher, signal: AbortSignal): Promise<Response> {
  return fetcher(url, { method, redirect: 'manual', signal });
}

/** Follows manual redirects hop-by-hop, re-running the SSRF-safe DNS preflight before every hop. */
async function followRedirects(startUrl: string, opts: { fetcher: Fetcher; lookup?: DnsLookup; signal: AbortSignal }): Promise<string | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const preflighted = await preflightUrl(current, { lookup: opts.lookup }).catch(() => null);
    if (!preflighted) return null;
    current = preflighted.toString();

    let response: Response;
    try {
      response = await requestOnce(current, 'HEAD', opts.fetcher, opts.signal);
      if (!REDIRECT_STATUSES.has(response.status) && !response.ok) {
        // Some redirectors reject/mishandle HEAD — retry with GET before giving up on this hop.
        response = await requestOnce(current, 'GET', opts.fetcher, opts.signal);
      }
    } catch {
      try {
        response = await requestOnce(current, 'GET', opts.fetcher, opts.signal);
      } catch {
        return null;
      }
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    if (response.ok) return current;
    return null;
  }
  return null; // exceeded MAX_REDIRECTS
}

export type ShortLinkResolution =
  | { ok: true; resolvedUrl: URL; wasShortLink: boolean }
  | { ok: false; errorCode: Extract<WebsiteImportErrorCode, 'SHORT_LINK_RESOLUTION_FAILED'> };

/**
 * If `url`'s hostname is an opaque Google Maps short link (maps.app.goo.gl, goo.gl, g.page),
 * follows redirects to the final destination so `detectImportSource` can classify the real
 * URL instead of the redirector. Any other hostname passes through unchanged (this must not
 * change behavior for non-Maps URLs, including non-Google shorteners like bit.ly, which this
 * module doesn't recognize as a short-link host and never touches).
 *
 * Resolutions are cached for 7 days (Redis if configured, else per-process memory) so retries
 * and repeated pastes of the same link don't re-issue redirect requests against Google.
 */
export async function resolveGoogleMapsShortLink(
  url: URL,
  opts: { fetcher?: Fetcher; lookup?: DnsLookup; timeoutMs?: number } = {},
): Promise<ShortLinkResolution> {
  if (!isGoogleMapsShortLinkHostname(url.hostname)) return { ok: true, resolvedUrl: url, wasShortLink: false };

  const cacheKey = url.toString();
  const cached = await getCachedResolution(cacheKey);
  if (cached) {
    try {
      return { ok: true, resolvedUrl: new URL(cached), wasShortLink: true };
    } catch {
      // Corrupt cache entry — fall through and re-resolve.
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const resolved = await followRedirects(url.toString(), { fetcher: opts.fetcher ?? fetch, lookup: opts.lookup, signal: controller.signal });
    if (!resolved) return { ok: false, errorCode: 'SHORT_LINK_RESOLUTION_FAILED' };
    await setCachedResolution(cacheKey, resolved);
    return { ok: true, resolvedUrl: new URL(resolved), wasShortLink: true };
  } catch {
    return { ok: false, errorCode: 'SHORT_LINK_RESOLUTION_FAILED' };
  } finally {
    clearTimeout(timeout);
  }
}
