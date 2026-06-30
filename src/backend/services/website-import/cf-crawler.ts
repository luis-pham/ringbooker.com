export const CF_CRAWL_POLL_INTERVAL_MS = 2000;
export const CF_CRAWL_TIMEOUT_MS = 55_000;
/**
 * Consecutive polls with no new completed page after which we treat the crawl as effectively
 * done and return early. Cloudflare /crawl frequently keeps `status: 'running'` with `total: null`
 * long after every page has been rendered, so waiting for a clean `completed` status burns the
 * whole deadline even when the data is already in hand. ~3 polls (≈6s) of zero progress is a safe
 * signal the queue has drained without prematurely abandoning a crawl that is still rendering.
 */
export const CF_CRAWL_STALL_POLLS = 3;

export interface CfCrawlPage {
  url: string;
  markdown: string;
  html?: string;
  metadata: {
    title?: string;
    'og:image'?: string;
    'og:description'?: string;
  };
}

export interface CfCrawlResult {
  pages: CfCrawlPage[];
  logoUrl: string | null;
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const CF_ACCOUNTS_BASE = 'https://api.cloudflare.com/client/v4/accounts';
const EXCLUDE_PATTERNS = [
  '**/cart/**',
  '**/checkout/**',
  '**/account/**',
  '**/login/**',
  '**/blog/**',
  '**/blogs/**',
  '**/stories/**',
  '**/s/stories/**',
  '**/news/**',
  // WordPress (the dominant salon CMS) buries the service/pricing pages under a flood of
  // dated blog permalinks (/2026/05/04/...) and taxonomy archives. Left in, the crawl spends
  // its page budget on blog posts and never reaches the menu. Cloudflare globs support `*` but
  // not `[0-9]` character classes, so match any /19xx/ or /20xx/ date segment with `*`.
  '**/19*/**',
  '**/20*/**',
  '**/category/**',
  '**/tag/**',
  '**/author/**',
  '**/feed/**',
  '**/privacy/**',
  '**/terms/**',
  '**/shipping/**',
  '**/returns/**',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, ms));
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
  };
}

async function fetchJson(fetcher: Fetcher, url: string, init: RequestInit, timeoutMs: number): Promise<unknown> {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: timeout.signal });
    if (!response.ok) throw new Error(`cloudflare_crawl_http_${response.status}`);
    return await response.json().catch(() => null);
  } finally {
    timeout.cancel();
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseJobId(body: unknown): string | null {
  const root = objectValue(body);
  const result = root?.result;
  if (typeof result === 'string' && result.trim()) return result.trim();
  const resultObject = objectValue(result);
  const id = resultObject?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function parseMetadata(value: unknown): CfCrawlPage['metadata'] {
  const source = objectValue(value);
  if (!source) return {};
  const metadata: CfCrawlPage['metadata'] = {};
  for (const key of ['title', 'og:image', 'og:description'] as const) {
    const raw = source[key];
    if (typeof raw === 'string' && raw.trim()) metadata[key] = raw.trim();
  }
  return metadata;
}

function parseRecords(body: unknown): { status: string | null; total: number | null; records: unknown[] } {
  const root = objectValue(body);
  const result = root?.result;
  const resultObject = objectValue(result);
  const status = typeof resultObject?.status === 'string' ? resultObject.status : null;
  const total = typeof resultObject?.total === 'number' ? resultObject.total : null;
  if (Array.isArray(resultObject?.records)) return { status, total, records: resultObject.records };
  if (Array.isArray(result)) return { status: null, total: null, records: result };
  return { status, total, records: [] };
}

function normalizePages(records: unknown[]): CfCrawlPage[] {
  return records.flatMap((record) => {
    const item = objectValue(record);
    if (!item) return [];
    if (item.status !== undefined && item.status !== 'completed') return [];
    if (typeof item.url !== 'string') return [];
    const markdown = typeof item.markdown === 'string' ? item.markdown : '';
    const html = typeof item.html === 'string' ? item.html : '';
    if (!markdown.trim() && !html.trim()) return [];
    return [{
      url: item.url,
      markdown,
      html: html.trim() ? html : undefined,
      metadata: parseMetadata(item.metadata),
    }];
  });
}

function normalizeUrlKey(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return value;
  }
}

function resolveLogoUrl(pages: CfCrawlPage[], websiteUrl: string): string | null {
  const requestedKey = normalizeUrlKey(websiteUrl);
  const homepage = pages.find((page) => normalizeUrlKey(page.url) === requestedKey) ?? pages[0];
  const raw = homepage?.metadata['og:image'] ?? pages[0]?.metadata['og:image'] ?? null;
  if (!raw) return null;
  try {
    const resolved = new URL(raw, homepage?.url ?? websiteUrl);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : null;
  } catch {
    return null;
  }
}

export async function crawlWithCloudflare(
  websiteUrl: string,
  opts: {
    accountId: string;
    apiKey: string;
    limit?: number;
    depth?: number;
    fetcher?: Fetcher;
    timeoutMs?: number;
  },
): Promise<CfCrawlResult> {
  const fetcher = opts.fetcher ?? fetch;
  const baseUrl = `${CF_ACCOUNTS_BASE}/${opts.accountId}/browser-rendering/crawl`;
  const deadline = Date.now() + (opts.timeoutMs ?? CF_CRAWL_TIMEOUT_MS);
  const startBody = await fetchJson(fetcher, baseUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      url: websiteUrl,
      formats: ['markdown', 'html'],
      depth: opts.depth ?? 2,
      limit: opts.limit ?? 10,
      options: { excludePatterns: EXCLUDE_PATTERNS },
    }),
  }, 15_000);
  const jobId = parseJobId(startBody);
  if (!jobId) throw new Error('cloudflare_crawl_missing_job_id');

  const limit = opts.limit ?? 10;
  let lastPages: CfCrawlPage[] = [];
  let stalePolls = 0;
  while (Date.now() < deadline) {
    let pollBody: unknown;
    try {
      pollBody = await fetchJson(fetcher, `${baseUrl}/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${opts.apiKey}` },
      }, Math.min(10_000, Math.max(1, deadline - Date.now())));
    } catch {
      // A single slow/aborted poll must not abandon the whole crawl — CF /crawl latency is highly
      // variable. Keep polling until the deadline; we return whatever pages we accumulated (or
      // throw the timeout below only if we never got any).
      await sleep(Math.min(CF_CRAWL_POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
      continue;
    }
    const { status, total, records } = parseRecords(pollBody);
    if (status === 'failed' || status === 'canceled') throw new Error(`cloudflare_crawl_${status}`);
    const pages = normalizePages(records);
    // Track stall: consecutive polls that produced no new completed page. CF often never reports a
    // clean `completed`, so this is what lets a finished crawl return early instead of waiting out
    // the deadline.
    if (pages.length > lastPages.length) stalePolls = 0;
    else if (pages.length > 0) stalePolls += 1;
    if (pages.length) lastPages = pages;
    const reachedLimit = pages.length >= limit;
    const stalled = pages.length > 0 && stalePolls >= CF_CRAWL_STALL_POLLS;
    if (
      status === 'completed'
      || (typeof total === 'number' && total > 0 && pages.length >= total)
      || (!status && pages.length > 0)
      || reachedLimit
      || stalled
    ) {
      return { pages, logoUrl: resolveLogoUrl(pages, websiteUrl) };
    }
    await sleep(Math.min(CF_CRAWL_POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
  }

  if (lastPages.length) return { pages: lastPages, logoUrl: resolveLogoUrl(lastPages, websiteUrl) };
  throw new Error('cloudflare_crawl_timeout');
}
