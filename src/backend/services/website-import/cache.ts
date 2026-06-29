import { normalizeImportUrl } from './security';
import type { WebsiteImportResult } from './types';

type CacheEntry = { result: WebsiteImportResult; expiresAt: number; qualityBudgetMs: number };

/**
 * Successful imports are cached for one hour so the demo → onboarding handoff
 * (and accidental double-submits) reuse work instead of re-crawling. Failures are
 * never cached — a transiently down site must stay retryable.
 *
 * `qualityBudgetMs` records the crawl budget that produced the entry. A caller only
 * reuses a cached entry produced with **at least** its own budget, so a fast/thin
 * demo crawl (15–25s) never satisfies a higher-budget onboarding import (28s) — the
 * onboarding caller re-crawls instead of inheriting the demo's thinner result.
 *
 * The cache is per-process: in a serverless/multi-instance deployment each warm
 * instance keeps its own copy. The in-flight map below additionally collapses
 * concurrent identical imports within one instance into a single crawl.
 */
const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 200;

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, { promise: Promise<WebsiteImportResult>; qualityBudgetMs: number }>();

function cacheKey(url: string): string {
  try {
    return normalizeImportUrl(url).toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

function shouldCacheResult(result: WebsiteImportResult): boolean {
  if (!result.ok) return false;
  const usedHeadlessRender = result.diagnostics.fallbackUsed.includes('headless_render');
  const jsRenderedIncomplete = !usedHeadlessRender
    && result.diagnostics.warnings.some((warning) => /javascript(?:-rendered|\s+spa)|headless-render|WEBSITE_IMPORT_RENDER_URL/i.test(warning));
  const enrichmentOrSourceProblem = result.diagnostics.warnings.some((warning) =>
    /AI enrichment failed|timed out|server error pages|looked like assets/i.test(warning),
  );
  const suspiciousStaff = result.suggestions.staffSuggestions.some((staff) =>
    /previousnext|internal server error|server encountered an internal error/i.test(`${staff.name} ${staff.bio ?? ''}`),
  );
  return !jsRenderedIncomplete && !enrichmentOrSourceProblem && !suspiciousStaff;
}

/** Test/ops helper — drops all cached and in-flight imports. */
export function clearWebsiteImportCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * Wraps a website import with caching + in-flight deduplication.
 * `importFn` is only invoked on a cache miss with no identical import in progress.
 *
 * `qualityBudgetMs` is the crawl budget this caller will use; a cached or in-flight
 * entry is reused only when it was produced with at least that much budget.
 */
export async function importWebsiteWithCache(
  input: { url: string; qualityBudgetMs?: number },
  importFn: () => Promise<WebsiteImportResult>,
): Promise<WebsiteImportResult> {
  const key = cacheKey(input.url);
  const now = Date.now();
  const requestedBudgetMs = input.qualityBudgetMs ?? 0;

  const cached = cache.get(key);
  if (cached) {
    if (cached.expiresAt <= now) {
      cache.delete(key);
    } else if (cached.qualityBudgetMs >= requestedBudgetMs) {
      return cached.result;
    }
    // Fresh but produced with a thinner budget than this caller needs — fall through and re-crawl.
  }

  const pending = inFlight.get(key);
  if (pending && pending.qualityBudgetMs >= requestedBudgetMs) return pending.promise;

  const promise = (async () => {
    try {
      const result = await importFn();
      if (shouldCacheResult(result)) {
        const existing = cache.get(key);
        // Don't let a thinner crawl overwrite a still-fresh richer one.
        const keepExisting = existing && existing.expiresAt > Date.now() && existing.qualityBudgetMs > requestedBudgetMs;
        if (!keepExisting) {
          if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
          cache.set(key, { result, expiresAt: Date.now() + TTL_MS, qualityBudgetMs: requestedBudgetMs });
        }
      }
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, { promise, qualityBudgetMs: requestedBudgetMs });
  return promise;
}
