import type { WebsiteImportResult } from './types';

const IMPORTER_VERSION = 'website-import-p2-v2';
type CacheEntry = { expiresAt: number; result: WebsiteImportResult };
const memoryCache = new Map<string, CacheEntry>();
export const DEFAULT_WEBSITE_IMPORT_CACHE_MAX_ENTRIES = 500;

function cloneResult(result: WebsiteImportResult): WebsiteImportResult {
  return JSON.parse(JSON.stringify(result)) as WebsiteImportResult;
}

export function websiteImportCacheKey(input: {
  normalizedUrl: string;
  llmEnabled?: boolean;
  llmModel?: string | null;
  llmMaxTokens?: number | null;
  googlePlacesEnabled?: boolean;
  importerVersion?: string;
  configVersion?: string;
}) {
  return [
    input.importerVersion ?? IMPORTER_VERSION,
    input.configVersion ?? 'default',
    input.normalizedUrl,
    input.llmEnabled ? 'llm' : 'no-llm',
    input.llmEnabled ? input.llmModel?.trim() || 'default-model' : 'no-model',
    input.llmEnabled ? String(input.llmMaxTokens ?? 'default-tokens') : 'no-tokens',
    input.googlePlacesEnabled ? 'places' : 'no-places',
  ].join('|');
}

export function getWebsiteImportCache(key: string, now = Date.now()): WebsiteImportResult | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    memoryCache.delete(key);
    return null;
  }
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return cloneResult(entry.result);
}

export function setWebsiteImportCache(key: string, result: WebsiteImportResult, ttlSeconds: number, now = Date.now(), maxEntries = DEFAULT_WEBSITE_IMPORT_CACHE_MAX_ENTRIES): void {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return;
  const safeMaxEntries = Math.max(1, Math.floor(maxEntries));
  if (memoryCache.has(key)) memoryCache.delete(key);
  memoryCache.set(key, { expiresAt: now + ttlSeconds * 1000, result: cloneResult(result) });
  while (memoryCache.size > safeMaxEntries) {
    const oldestKey = memoryCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    memoryCache.delete(oldestKey);
  }
}

export function clearWebsiteImportCache(): void {
  memoryCache.clear();
}
