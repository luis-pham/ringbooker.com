export const CF_CRAWL_POLL_INTERVAL_MS = 2000;
export const CF_CRAWL_TIMEOUT_MS = 55_000;

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
  }, 10_000);
  const jobId = parseJobId(startBody);
  if (!jobId) throw new Error('cloudflare_crawl_missing_job_id');

  let lastPages: CfCrawlPage[] = [];
  while (Date.now() < deadline) {
    let pollBody: unknown;
    try {
      pollBody = await fetchJson(fetcher, `${baseUrl}/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${opts.apiKey}` },
      }, Math.min(10_000, Math.max(1, deadline - Date.now())));
    } catch (error) {
      if (lastPages.length) return { pages: lastPages, logoUrl: resolveLogoUrl(lastPages, websiteUrl) };
      throw error;
    }
    const { status, total, records } = parseRecords(pollBody);
    if (status === 'failed' || status === 'canceled') throw new Error(`cloudflare_crawl_${status}`);
    const pages = normalizePages(records);
    if (pages.length) lastPages = pages;
    if (status === 'completed' || (typeof total === 'number' && total > 0 && pages.length >= total) || (!status && pages.length > 0)) {
      return { pages, logoUrl: resolveLogoUrl(pages, websiteUrl) };
    }
    await sleep(Math.min(CF_CRAWL_POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
  }

  if (lastPages.length) return { pages: lastPages, logoUrl: resolveLogoUrl(lastPages, websiteUrl) };
  throw new Error('cloudflare_crawl_timeout');
}
