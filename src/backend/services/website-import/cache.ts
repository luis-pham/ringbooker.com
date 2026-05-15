import { normalizeImportUrl } from './security';
import type { WebsiteImportResult } from './types';

type CacheEntry = { result: WebsiteImportResult; expiresAt: number };

/**
 * Successful imports are cached for one hour so the demo → onboarding handoff
 * (and accidental double-submits) reuse work instead of re-crawling. Failures are
 * never cached — a transiently down site must stay retryable.
 *
 * The cache is per-process: in a serverless/multi-instance deployment each warm
 * instance keeps its own copy. The in-flight map below additionally collapses
 * concurrent identical imports within one instance into a single crawl.
 */
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<WebsiteImportResult>>();

function cacheKey(url: string): string {
  try {
    return normalizeImportUrl(url).toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Test/ops helper — drops all cached and in-flight imports. */
export function clearWebsiteImportCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * Wraps a website import with caching + in-flight deduplication.
 * `importFn` is only invoked on a cache miss with no identical import in progress.
 */
export async function importWebsiteWithCache(
  input: { url: string },
  importFn: () => Promise<WebsiteImportResult>,
): Promise<WebsiteImportResult> {
  const key = cacheKey(input.url);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached) {
    if (cached.expiresAt > now) return cached.result;
    cache.delete(key);
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const result = await importFn();
      if (result.ok) {
        if (cache.size >= MAX_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(key, { result, expiresAt: Date.now() + TTL_MS });
      }
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}
