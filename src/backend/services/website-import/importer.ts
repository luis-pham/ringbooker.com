import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';

import { preflightUrl, resolveSafeUrl, type DnsLookup } from './security';
import { detectImportSource, shouldDeepCrawlSource } from './source-routing';
import { extractLinks, previewHtml } from './html';
import { commonSitemapUrls, parseRobotsSitemaps, parseSitemapXml, prioritizeChildSitemaps, sitemapUrlsToCandidates } from './sitemap';
import { buildSuggestions } from './extract';
import { lookupGooglePlaces } from './google-places';
import { extractWebsiteImportWithLlm, LLM_TOP_PAGE_MARKDOWN_BUDGET } from './llm';
import { classifyCandidate, selectPages, toDiagnostic } from './scoring';
import { renderHtml, type RenderConfig } from './render';
import { crawlWithCloudflare, CF_CRAWL_TIMEOUT_MS, type CfCrawlPage } from './cf-crawler';
import type { CandidateBucket, CandidateUrl, PagePreview, SelectedPageDiagnostic, WebsiteImportResult } from './types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

type SiteBuilder = 'nextjs' | 'nuxtjs' | 'react_spa' | 'square_weebly' | 'webflow' | 'wix' | 'squarespace' | 'shopify' | null;

function detectSiteBuilder(html: string): SiteBuilder {
  if (/<div[^>]+id=["']__next["']/i.test(html)) return 'nextjs';
  if (/<div[^>]+id=["']__nuxt["']/i.test(html)) return 'nuxtjs';
  if (/__BOOTSTRAP_STATE__|cdn\d*\.editmysite\.com|editmysite\.com|weebly\.com|square-online|ecom\.square/i.test(html)) return 'square_weebly';
  if (/data-wf-site|cdn\.prod\.website-files\.com|webflow\.io/i.test(html)) return 'webflow';
  if (/wixsite\.com|cdn\d*\.wix\.com|X-Wix-Published-Version/i.test(html)) return 'wix';
  if (/static\d+\.squarespace\.com|squarespace\.com\/s\//i.test(html)) return 'squarespace';
  if (/cdn\.shopify\.com/i.test(html)) return 'shopify';
  if (/<div[^>]+id=["'](?:root|app)["'][^>]*>\s*<\/div>/i.test(html)) return 'react_spa';
  return null;
}

function hasThinContent(html: string): boolean {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  const text = withoutScripts.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length < 1000;
}

function isJsRenderedSiteBuilder(builder: SiteBuilder): boolean {
  return builder === 'react_spa' || builder === 'square_weebly' || builder === 'wix';
}

function isWeakPreview(preview: PagePreview | undefined): boolean {
  if (!preview) return true;
  const serviceBlockCount = preview.serviceBlocks?.length ?? 0;
  return preview.firstTextChars.trim().length < 300
    && serviceBlockCount === 0
    && preview.priceCount === 0
    && preview.durationCount === 0;
}

function hasUsefulPreviewContent(preview: PagePreview | undefined): boolean {
  if (!preview) return false;
  return preview.firstTextChars.trim().length >= 800
    || (preview.serviceBlocks?.length ?? 0) > 0
    || preview.priceCount > 0
    || preview.durationCount > 0
    || preview.serviceKeywordCount >= 4
    || preview.internalServiceLikeLinkCount >= 2;
}

function shouldKeepRenderedPreview(rendered: PagePreview, existing: PagePreview | undefined): boolean {
  if (!existing) return !isWeakPreview(rendered);
  const renderedServiceBlocks = rendered.serviceBlocks?.length ?? 0;
  const existingServiceBlocks = existing.serviceBlocks?.length ?? 0;
  return rendered.firstTextChars.length > existing.firstTextChars.length
    || rendered.contentScore > existing.contentScore
    || renderedServiceBlocks > existingServiceBlocks
    || rendered.priceCount > existing.priceCount
    || rendered.durationCount > existing.durationCount;
}

type ImportOptions = {
  fetcher?: Fetcher;
  lookup?: DnsLookup;
  maxPages?: number;
  maxChildServicePages?: number;
  timeoutMs?: number;
  maxBytes?: number;
  googlePlacesApiKey?: string | null;
  llmEnabled?: boolean;
  openAiApiKey?: string | null;
  llmModel?: string | null;
  llmMaxTokens?: number | null;
  /**
   * Optional global budget gate, consumed once right before the (single) LLM call.
   * Return `false` to skip LLM enrichment when a cross-instance daily cap is reached;
   * the import still completes with static + Google Places extraction. Injected by the
   * app layer so this service stays decoupled from the rate-limit module.
   */
  acquireLlmBudget?: () => Promise<boolean>;
  /** Overall wall-clock budget for the whole import (crawl + Google Places + LLM). */
  deadlineMs?: number;
  /** Maximum number of parallel page fetches. */
  fetchConcurrency?: number;
  /** Optional headless-render service endpoint for JS-rendered sites (Wix, SPAs, booking platforms). */
  renderEndpoint?: string | null;
  /** Optional bearer token for the headless-render service. */
  renderApiKey?: string | null;
  /** Internal: absolute timestamp (ms) at which the import budget expires. */
  deadline?: number;
};

export const DEFAULT_WEBSITE_IMPORT_MAX_BYTES = 1_500_000;
/** Default total import budget. The caller (demo vs onboarding) overrides this. */
const DEFAULT_DEADLINE_MS = 120_000;
const DEFAULT_FETCH_CONCURRENCY = 6;
/** LLM needs at least this much remaining budget to be worth calling. */
const MIN_LLM_BUDGET_MS = 4_000;
/**
 * Budget held back from the crawl so the LLM enrichment pass has room to finish. The full-site
 * markdown payload is large (~10k input tokens) and the JSON catalog can run to several thousand
 * output tokens, so a short window makes the OpenAI call abort and the import silently falls back
 * to noisy static markdown extraction. Reserve a generous slice for it.
 */
const LLM_ENRICHMENT_RESERVE_MS = 30_000;
/** Hard cap for a single LLM enrichment call (bounded again by the remaining budget). */
const LLM_CALL_TIMEOUT_MS = 45_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `fn` over `items` with at most `concurrency` in flight; preserves index order in the result. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function readResponseTextWithLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    throw new Error('response_body_unavailable');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error('response_too_large');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const FETCH_HEADERS = {
  'user-agent': 'RingBookerBot/1.0 (+https://ringbooker.com/bot)',
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'cache-control': 'no-cache',
} as const;

function looksLikeEmptyOrNotFoundPage(text: string): boolean {
  const compact = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return !compact || /^(?:404|not found|page not found|not found \|)/i.test(compact);
}

async function safeFetchPinned(url: string, opts: ImportOptions & { signal: AbortSignal }): Promise<Response> {
  const resolved = await resolveSafeUrl(url, { lookup: opts.lookup });
  const current = resolved.url;
  const requestImpl = current.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise<Response>((resolve, reject) => {
    const req = requestImpl(
      {
        protocol: current.protocol,
        hostname: resolved.address,
        port: current.port || undefined,
        path: `${current.pathname}${current.search}`,
        method: 'GET',
        headers: {
          ...FETCH_HEADERS,
          host: current.host,
        },
        servername: current.hostname,
        lookup: (_hostname, _lookupOpts, callback) => {
          callback(null, resolved.address, resolved.family);
        },
      },
      (res) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) headers.set(key, value.join(', '));
          else if (value !== undefined) headers.set(key, String(value));
        }
        const body = Readable.toWeb(res) as ReadableStream<Uint8Array>;
        const response = new Response(body, {
          status: res.statusCode ?? 0,
          statusText: res.statusMessage,
          headers,
        }) as Response & { url: string };
        Object.defineProperty(response, 'url', { value: current.toString() });
        resolve(response);
      },
    );
    req.on('error', reject);
    if (opts.signal.aborted) req.destroy(new Error('aborted'));
    opts.signal.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    req.end();
  });
}

async function fetchText(url: string, opts: ImportOptions): Promise<{ url: string; text: string } | null> {
  try {
    let current = (await preflightUrl(url, { lookup: opts.lookup })).toString();
    let redirectsFollowed = 0;
    // One retry shared across the whole fetch (covers a transient network error
    // OR a single rate-limit / 5xx response — whichever happens first).
    let retriesLeft = 1;
    while (true) {
      if (opts.deadline !== undefined && Date.now() >= opts.deadline) return null;
      // Re-run DNS/scheme preflight immediately before every network attempt.
      // This closes the gap where an attacker can pass an earlier DNS check and
      // rebind the hostname to an internal address before fetch resolves it.
      current = (await preflightUrl(current, { lookup: opts.lookup })).toString();
      const budgetMs = opts.deadline !== undefined ? opts.deadline - Date.now() : Number.POSITIVE_INFINITY;
      const perFetchTimeout = Math.min(opts.timeoutMs ?? 5000, budgetMs);
      if (perFetchTimeout <= 0) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), perFetchTimeout);
      try {
        let response: Response;
        try {
          response = opts.fetcher
            ? await opts.fetcher(current, {
                redirect: 'manual',
                signal: controller.signal,
                headers: FETCH_HEADERS,
              })
            : await safeFetchPinned(current, { ...opts, signal: controller.signal });
        } catch {
          // Network error or timeout abort. Retry once if the budget allows.
          if (retriesLeft > 0 && (opts.deadline === undefined || Date.now() < opts.deadline)) {
            retriesLeft -= 1;
            await sleep(800);
            continue;
          }
          return null;
        }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) return null;
          if (redirectsFollowed >= 5) return null;
          redirectsFollowed += 1;
          const redirectTarget = new URL(location, current).toString();
          await preflightUrl(redirectTarget, { lookup: opts.lookup });
          current = redirectTarget;
          continue;
        }
        const finalUrl = response.url || current;
        await preflightUrl(finalUrl, { lookup: opts.lookup });
        if (!response.ok) {
          // Retry rate-limit / transient server errors by re-entering the loop, so the
          // retried request is preflighted and redirect-checked exactly like the first.
          if ((response.status === 429 || response.status >= 500)
            && retriesLeft > 0
            && (opts.deadline === undefined || Date.now() < opts.deadline)) {
            retriesLeft -= 1;
            await sleep(response.status === 429 ? 1200 : 600);
            continue;
          }
          return null;
        }
        const contentType = response.headers.get('content-type') ?? '';
        if (!/html|xml|text|markdown/i.test(contentType) && contentType) return null;
        let raw = await readResponseTextWithLimit(response, opts.maxBytes ?? DEFAULT_WEBSITE_IMPORT_MAX_BYTES);
        if (opts.fetcher && looksLikeEmptyOrNotFoundPage(raw)) {
          const parsedCurrent = new URL(current);
          const alt = parsedCurrent.pathname === '/' && !parsedCurrent.search && current.endsWith('/')
            ? current.slice(0, -1)
            : !current.endsWith('/') && !parsedCurrent.search
              ? `${current}/`
              : null;
          if (alt) {
            const altResponse = await opts.fetcher(alt, {
              redirect: 'manual',
              signal: controller.signal,
              headers: FETCH_HEADERS,
            });
            if (altResponse.ok) raw = await readResponseTextWithLimit(altResponse, opts.maxBytes ?? DEFAULT_WEBSITE_IMPORT_MAX_BYTES);
          }
        }
        return { url: finalUrl, text: raw };
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch {
    return null;
  }
}

function candidateFromUrl(url: string, source: CandidateUrl['source'], anchorText?: string, discoveredFrom?: string): CandidateUrl | null {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (/^utm_/.test(lower) || ['fbclid', 'gclid', 'itemid', 'variantid', 'productid', 'sku'].includes(lower)) parsed.searchParams.delete(key);
    }
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return { url: parsed.toString(), source, anchorText, pathTokens: parsed.pathname.split(/[\/\-_]+/).filter(Boolean), discoveredFrom };
  } catch {
    return null;
  }
}

function commonServicePageCandidates(origin: string, discoveredFrom: string): CandidateUrl[] {
  return [
    ['/pages/service-menu', 'Service Menu'],
    ['/pages/service-menu/', 'Service Menu'],
    ['/pages/services', 'Services'],
    ['/pages/services/', 'Services'],
    ['/service-menu/', 'Service Menu'],
    ['/service-menu', 'Service Menu'],
    ['/services/', 'Services'],
    ['/services', 'Services'],
    ['/menu/', 'Menu'],
    ['/salon-services/', 'Services'],
    ['/our-services/', 'Services'],
    ['/artists/', 'Artists'],
    ['/artists', 'Artists'],
    ['/staff/', 'Staff'],
    ['/team/', 'Team'],
    ['/stylists/', 'Stylists'],
  ]
    .map(([path, label]) => candidateFromUrl(`${origin}${path}`, 'nav', label, discoveredFrom))
    .filter((candidate): candidate is CandidateUrl => Boolean(candidate));
}

async function discoverSitemapCandidates(origin: string, opts: ImportOptions, concurrency: number) {
  const sitemapSourcesFound: string[] = [];
  const candidates: CandidateUrl[] = [];
  const robots = await fetchText(`${origin}/robots.txt`, opts);
  const sitemapUrls = new Set<string>(commonSitemapUrls(origin));
  if (robots?.text) parseRobotsSitemaps(robots.text).forEach((url) => sitemapUrls.add(url));
  const topLevel = await mapPool([...sitemapUrls].slice(0, 12), concurrency, async (sitemapUrl) => {
    const sitemap = await fetchText(sitemapUrl, opts);
    if (!sitemap?.text) return null;
    return { sitemapUrl, parsed: parseSitemapXml(sitemap.text) };
  });
  for (const entry of topLevel) {
    if (!entry) continue;
    sitemapSourcesFound.push(entry.sitemapUrl);
    const childResults = await mapPool(prioritizeChildSitemaps(entry.parsed.childSitemaps, 5), concurrency, async (child) => {
      const childText = await fetchText(child, opts);
      if (!childText?.text) return null;
      return { child, urls: parseSitemapXml(childText.text).urls };
    });
    for (const childResult of childResults) {
      if (!childResult) continue;
      sitemapSourcesFound.push(childResult.child);
      candidates.push(...sitemapUrlsToCandidates(childResult.urls, childResult.child, origin, 200));
    }
    candidates.push(...sitemapUrlsToCandidates(entry.parsed.urls, entry.sitemapUrl, origin, 200));
  }
  return { candidates, sitemapSourcesFound };
}

function emptyResult(sourceUrl: string, sourceType = detectImportSource(new URL(sourceUrl))): WebsiteImportResult {
  const suggestions = buildSuggestions({ sourceUrl, sourceType, previews: [] });
  return {
    ok: false,
    suggestions,
    diagnostics: { selectedPages: [], skippedPagesSummary: [], sitemapSourcesFound: [], serviceHubPagesFound: [], childServicePagesFound: [], confidenceSummary: {}, warnings: ['Import returned no readable website content.'], fallbackUsed: [] },
    logoUrl: null,
  };
}

function cloudflareAccountIdFromRenderEndpoint(renderEndpoint?: string | null): string | null {
  if (!renderEndpoint) return null;
  try {
    const parsed = new URL(renderEndpoint);
    const match = parsed.pathname.match(/\/accounts\/([^/]+)\/browser-rendering\/(?:content|crawl)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizedUrlKey(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (/^utm_/.test(lower) || ['fbclid', 'gclid', 'itemid', 'variantid', 'productid', 'sku'].includes(lower)) parsed.searchParams.delete(key);
    }
    if (parsed.pathname !== '/') parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString();
  } catch {
    return value;
  }
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function pathForScoring(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function classifyImportCandidate(candidate: CandidateUrl, preview?: PagePreview): { bucket: CandidateBucket; score: number; reason: string } {
  const base = classifyCandidate(candidate, preview);
  const path = pathForScoring(candidate.url);
  let { bucket, score } = base;
  const reasons = [base.reason];

  if (/\/(?:about\/)?(?:meet[-_]?the[-_]?team|our[-_]?team|team|staff|artists?|stylists?|providers?|technicians?)\/?$/i.test(path)) {
    bucket = 'staff_team';
    score += 150;
    reasons.push('Targeted staff/team sitemap path');
  }
  if (/\/(?:salon[-_]?polic(?:y|ies)|polic(?:y|ies)|privacy[-_]?policy|terms|cancellation|refund)(?:\/|$)/i.test(path)) {
    bucket = 'policies';
    score += 150;
    reasons.push('Targeted policy sitemap path');
  }
  if (/(?:^|\/)(?:hairmenu|wax[-_]?lash[-_]?brow[-_]?menu|advanced[-_]?facials?[-_]?menu)(?:\/|$)/i.test(path)) {
    bucket = 'service_child';
    score += 150;
    reasons.push('Targeted category menu path');
  }
  if (/\/(?:services?|spa)(?:\/|$)/i.test(path) && !/service[-_]?areas?/.test(path)) {
    bucket = /\/(?:services?|spa)\/?$/i.test(path) ? 'service_hub' : 'service_child';
    score += 130;
    reasons.push('Targeted service/spa sitemap path');
  }
  if (/\/(?:contact(?:-us)?|locations?|hours|visit-us)\/?$/i.test(path)) {
    bucket = 'contact_hours';
    score += 65;
    reasons.push('Targeted contact/location path');
  }
  if (/\/(?:faqs?|questions)\/?$/i.test(path)) {
    bucket = 'faq';
    score += 50;
    reasons.push('Targeted FAQ path');
  }

  if (/\/(?:careers?|jobs?|promotions?|specials?|reviews?|giving-back|covid|aveda(?:\/|$)|book-now)/i.test(path)) {
    score -= 120;
    reasons.push('Marketing/career/noise path deprioritized');
  }

  return { bucket, score, reason: reasons.filter(Boolean).join('; ') };
}

function dedupeCandidates(candidates: CandidateUrl[]): CandidateUrl[] {
  const seen = new Set<string>();
  const out: CandidateUrl[] = [];
  for (const candidate of candidates) {
    const key = normalizedUrlKey(candidate.url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

function candidatesFromPreviewLinks(previews: PagePreview[], origin: string): CandidateUrl[] {
  const candidates: CandidateUrl[] = [];
  for (const preview of previews) {
    const parentPath = pathForScoring(preview.url);
    const source: CandidateUrl['source'] = /\/(?:services?|service-menu|salon-services|menu|spa|hairmenu)(?:\/|$)/i.test(parentPath)
      ? 'service_hub_child'
      : 'nav';
    for (const link of preview.links) {
      if (!isSameOrigin(link.href, origin)) continue;
      const candidate = candidateFromUrl(link.href, source, link.text, preview.url);
      if (candidate) {
        candidate.parentUrl = preview.url;
        candidates.push(candidate);
      }
    }
  }
  return candidates;
}

function seedCandidates(startUrl: URL, previews: PagePreview[], sitemapCandidates: CandidateUrl[]): CandidateUrl[] {
  const origin = startUrl.origin;
  const root = candidateFromUrl(`${origin}/`, 'homepage', 'Home', startUrl.toString());
  const start = candidateFromUrl(startUrl.toString(), startUrl.pathname === '/' ? 'homepage' : 'nav', startUrl.pathname === '/' ? 'Home' : undefined, startUrl.toString());
  const commonCandidates = sitemapCandidates.length ? [] : commonServicePageCandidates(origin, startUrl.toString());
  return dedupeCandidates([
    ...(root ? [root] : []),
    ...(start ? [start] : []),
    ...candidatesFromPreviewLinks(previews, origin),
    ...sitemapCandidates,
    ...commonCandidates,
  ]);
}

function selectTargetCandidates(candidates: CandidateUrl[], existingPreviews: PagePreview[], maxTargets: number): CandidateUrl[] {
  if (maxTargets <= 0) return [];
  const existing = new Set(existingPreviews.map((preview) => normalizedUrlKey(preview.url)));
  const scored = dedupeCandidates(candidates)
    .filter((candidate) => !existing.has(normalizedUrlKey(candidate.url)))
    .map((candidate) => ({ candidate, ...classifyImportCandidate(candidate) }))
    .filter((item) => item.score >= 45 && item.bucket !== 'noise' && item.bucket !== 'ecommerce_product' && item.bucket !== 'promotions' && item.bucket !== 'booking')
    .sort((a, b) => b.score - a.score);

  const selected: typeof scored = [];
  const addBucket = (bucket: CandidateBucket, count: number) => {
    for (const item of scored.filter((entry) => entry.bucket === bucket)) {
      if (selected.length >= maxTargets) return;
      if (selected.some((entry) => normalizedUrlKey(entry.candidate.url) === normalizedUrlKey(item.candidate.url))) continue;
      if (selected.filter((entry) => entry.bucket === bucket).length >= count) continue;
      selected.push(item);
    }
  };

  addBucket('staff_team', 2);
  addBucket('policies', 2);
  addBucket('service_hub', 2);
  addBucket('service_child', Math.max(4, maxTargets));
  addBucket('contact_hours', 2);
  addBucket('faq', 1);
  for (const item of scored) {
    if (selected.length >= maxTargets) break;
    if (!selected.some((entry) => normalizedUrlKey(entry.candidate.url) === normalizedUrlKey(item.candidate.url))) selected.push(item);
  }
  return selected.map((item) => item.candidate);
}

async function previewCandidate(
  candidate: CandidateUrl,
  opts: ImportOptions,
  renderConfig: RenderConfig,
  remainingBudget: () => number,
  forceRender = false,
): Promise<{ preview: PagePreview; usedRender: boolean } | null> {
  let staticPreview: PagePreview | undefined;
  let staticHtml: string | undefined;
  const fetched = await fetchText(candidate.url, opts);
  if (fetched?.text) {
    staticHtml = fetched.text;
    staticPreview = previewHtml(fetched.text, fetched.url);
  }

  const builder = staticHtml ? detectSiteBuilder(staticHtml) : null;
  const shouldRender = Boolean(renderConfig.endpoint)
    && remainingBudget() > 2_000
    && (
      forceRender
      || !staticPreview
      || (staticHtml ? hasThinContent(staticHtml) : false)
      || isJsRenderedSiteBuilder(builder)
      || isWeakPreview(staticPreview)
    );

  if (shouldRender) {
    const renderedHtml = await renderHtml(candidate.url, renderConfig, {
      fetcher: opts.fetcher,
      timeoutMs: Math.min(18_000, Math.max(1_000, remainingBudget())),
    });
    if (renderedHtml?.trim()) {
      const renderedPreview = previewHtml(renderedHtml, candidate.url);
      if (forceRender || shouldKeepRenderedPreview(renderedPreview, staticPreview)) return { preview: renderedPreview, usedRender: true };
    }
  }

  if (!staticPreview) return null;
  if (looksLikeEmptyOrNotFoundPage(staticPreview.firstTextChars || staticPreview.h1 || staticPreview.title)) return null;
  const classified = classifyImportCandidate(candidate, staticPreview);
  const keepWeakStatic = candidate.source === 'homepage'
    || candidate.source === 'sitemap'
    || classified.bucket === 'staff_team'
    || classified.bucket === 'about_team'
    || classified.bucket === 'policies';
  if (!keepWeakStatic && isWeakPreview(staticPreview) && !hasUsefulPreviewContent(staticPreview)) return null;
  return { preview: staticPreview, usedRender: false };
}

async function augmentPreviewsFromCandidates(
  previews: PagePreview[],
  candidates: CandidateUrl[],
  opts: ImportOptions,
  renderConfig: RenderConfig,
  remainingBudget: () => number,
  options: { maxTargets: number; concurrency: number; forceRender?: boolean },
): Promise<{ previews: PagePreview[]; renderedCount: number }> {
  const targets = selectTargetCandidates(candidates, previews, options.maxTargets);
  if (!targets.length) return { previews, renderedCount: 0 };
  let renderedCount = 0;
  const fetched = await mapPool(targets, options.concurrency, async (candidate) => {
    if (remainingBudget() <= 1_000) return null;
    return previewCandidate(candidate, opts, renderConfig, remainingBudget, options.forceRender);
  });
  const byUrl = new Map(previews.map((preview) => [normalizedUrlKey(preview.url), preview]));
  for (const item of fetched) {
    if (!item?.preview) continue;
    if (item.usedRender) renderedCount += 1;
    const key = normalizedUrlKey(item.preview.url);
    const existing = byUrl.get(key);
    if (!existing || shouldKeepRenderedPreview(item.preview, existing)) byUrl.set(key, item.preview);
  }
  return { previews: [...byUrl.values()], renderedCount };
}

function selectFinalPreviews(
  previews: PagePreview[],
  startUrl: URL,
  candidates: CandidateUrl[],
  maxPages: number,
): { previews: PagePreview[]; selectedPages: SelectedPageDiagnostic[] } {
  const candidateByUrl = new Map(dedupeCandidates(candidates).map((candidate) => [normalizedUrlKey(candidate.url), candidate]));
  const rootKey = normalizedUrlKey(`${startUrl.origin}/`);
  const scored = previews.map((preview, index) => {
    const key = normalizedUrlKey(preview.url);
    const candidate = candidateByUrl.get(key)
      ?? candidateFromUrl(preview.url, key === rootKey ? 'homepage' : 'sitemap', undefined, startUrl.toString())
      ?? { url: preview.url, source: index === 0 ? 'homepage' : 'sitemap', pathTokens: [], discoveredFrom: startUrl.toString() } satisfies CandidateUrl;
    const classified = classifyImportCandidate(candidate, preview);
    return { candidate, preview, ...classified };
  });
  const eligible = scored.filter((item) => {
    if (item.bucket === 'homepage') return true;
    if (item.bucket === 'about_team' && item.score < 40) return false;
    if (['noise', 'ecommerce_product', 'promotions', 'booking'].includes(item.bucket) && item.score < 50) return false;
    return item.score >= 10;
  });
  const selected = selectPages(eligible, maxPages) as typeof scored;
  const selectedKeys = new Set(selected.map((item) => normalizedUrlKey(item.preview.url)));
  return {
    previews: previews.filter((preview) => selectedKeys.has(normalizedUrlKey(preview.url))),
    selectedPages: selected.map((item) => ({
      url: item.preview.url,
      bucket: item.bucket,
      score: item.score,
      source: item.candidate.source,
      reason: item.reason,
    })),
  };
}

function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[`*_>#|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownHeadings(markdown: string, level: 1 | 2): string[] {
  const hashes = '#'.repeat(level);
  return [...markdown.matchAll(new RegExp(`^${hashes}\\s+(.+)$`, 'gm'))]
    .map((match) => match[1]?.replace(/\s+/g, ' ').trim())
    .filter((heading): heading is string => Boolean(heading))
    .slice(0, level === 1 ? 1 : 12);
}

function markdownLinks(markdown: string, baseUrl: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  for (const match of markdown.matchAll(/\[([^\]]*)]\(([^)\s]+)[^)]*\)/g)) {
    const text = (match[1] ?? '').replace(/\s+/g, ' ').trim();
    const href = match[2] ?? '';
    if (!href || href.startsWith('#')) continue;
    try {
      links.push({ href: new URL(href, baseUrl).toString(), text });
    } catch {
      // Ignore malformed third-party links.
    }
  }
  return links.slice(0, 120);
}

/** Strip inline Markdown (bold/italic/code/links) so a heading like "**Best Salon**" or
 *  "[Home](/)" does not leak its syntax into business-name/heading fields. */
function stripInlineMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Recover JSON-LD blocks from the page HTML that Cloudflare returns alongside markdown. The
 *  markdown-only preview otherwise drops LocalBusiness/Organization structured data — the most
 *  reliable source for the business name, hours, address and phone. Regex-based to avoid a full
 *  cheerio parse of each (often >1MB) crawled HTML document. */
function jsonLdFromHtml(html?: string): unknown[] {
  if (!html) return [];
  const out: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // Ignore invalid site-provided JSON-LD.
    }
  }
  return out;
}

function pagePreviewFromCrawlPage(page: CfCrawlPage): PagePreview {
  if (!page.markdown.trim() && page.html?.trim()) return previewHtml(page.html, page.url);
  const htmlPreview = page.html?.trim() ? previewHtml(page.html, page.url) : undefined;
  const text = plainTextFromMarkdown(page.markdown);
  const h1 = stripInlineMarkdown(markdownHeadings(page.markdown, 1)[0] ?? page.metadata.title ?? '');
  const h2s = markdownHeadings(page.markdown, 2).map(stripInlineMarkdown).filter(Boolean);
  const priceCount = (text.match(/\$\s?\d{1,4}|\b\d{2,4}\s*(?:and\s+up|up|\+)\b/gi) ?? []).length;
  const durationCount = (text.match(/\b\d{1,3}\s*(?:min|mins|minute|minutes|hour|hours|hr|hrs)\+?\b/gi) ?? []).length;
  const serviceKeywordCount = (text.match(/\b(nail|manicure|pedicure|acrylic|gel|shellac|dip powder|nail art|hair|haircut|color|colour|lightening|tint|retouch|touch\s*-?\s*up|highlights|balayage|blowout|keratin|spa|massage|facial|waxing|wax|brow|eyebrow|lashes|lash|makeup|threading|microblading|botox|filler|injectable|laser|skin|hydrafacial|peel|treatment|consultation)\b/gi) ?? []).length;
  const links = markdownLinks(page.markdown, page.url);
  const internalServiceLikeLinkCount = links.filter((link) => {
    try {
      return new URL(link.href).origin === new URL(page.url).origin && /service|menu|treatment|pricing|team|staff|artist|stylist/i.test(`${link.text} ${link.href}`);
    } catch {
      return false;
    }
  }).length;
  return {
    url: page.url,
    title: page.metadata.title ?? (h1 || (htmlPreview?.title ?? '')),
    h1: h1 || (htmlPreview?.h1 ?? ''),
    h2s: h2s.length ? h2s : htmlPreview?.h2s ?? [],
    firstTextChars: text.slice(0, 12_000),
    markdown: page.markdown,
    serviceBlocks: htmlPreview?.serviceBlocks,
    policyBlocks: htmlPreview?.policyBlocks,
    priceCount: Math.max(priceCount, htmlPreview?.priceCount ?? 0),
    durationCount: Math.max(durationCount, htmlPreview?.durationCount ?? 0),
    serviceKeywordCount: Math.max(serviceKeywordCount, htmlPreview?.serviceKeywordCount ?? 0),
    internalServiceLikeLinkCount: Math.max(internalServiceLikeLinkCount, htmlPreview?.internalServiceLikeLinkCount ?? 0),
    links: links.length ? links : htmlPreview?.links ?? [],
    jsonLd: jsonLdFromHtml(page.html),
    contentScore: Math.max(
      htmlPreview?.contentScore ?? 0,
      Math.min(100, Math.floor(text.length / 120) + priceCount * 8 + durationCount * 4 + serviceKeywordCount * 2),
    ),
  };
}

function crawlPageBucket(url: string, index: number): CandidateBucket {
  if (index === 0) return 'homepage';
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/(?:team|staff|artist|artists|stylist|stylists|provider|providers|our-team|ourteam)/.test(path)) return 'staff_team';
    if (/(?:faq|questions|help)/.test(path)) return 'faq';
    if (/(?:policy|policies|cancellation|privacy|terms)/.test(path)) return 'policies';
    if (/(?:contact|hours|location|visit)/.test(path)) return 'contact_hours';
    if (/(?:book|booking|appointment|appointments|schedule)/.test(path)) return 'booking';
    if (/(?:service|services|menu|pricing|price|hair|hairmenu|cut|style|color|colour|texture|extension|extention|facial|facials|wax|lash|brow|treatment|treatments)/.test(path)) return 'service_child';
  } catch {
    // Keep the page usable even if a third-party URL is malformed.
  }
  return 'noise';
}

function diagnosticsFromCrawlPages(pages: CfCrawlPage[]): SelectedPageDiagnostic[] {
  return pages.map((page, index) => {
    const bucket = crawlPageBucket(page.url, index);
    return {
      url: page.url,
      bucket,
      score: Math.max(10, 100 - index * 4),
      source: index === 0 ? 'homepage' : 'sitemap',
      reason: 'Selected by Cloudflare Browser Rendering /crawl markdown output.',
    };
  });
}

async function importWebsiteForOnboardingWithCloudflare(input: { url: string }, opts: ImportOptions = {}): Promise<WebsiteImportResult> {
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const fetchOpts: ImportOptions = { ...opts, deadline };
  const remainingBudget = () => Math.max(0, deadline - Date.now());

  let startUrl: URL;
  try {
    startUrl = await preflightUrl(input.url, { lookup: opts.lookup });
  } catch (error) {
    const safe = (() => { try { return new URL(/^https?:/i.test(input.url) ? input.url : `https://${input.url}`).origin; } catch { return 'https://invalid.local'; } })();
    const result = emptyResult(safe);
    result.diagnostics.warnings.push(error instanceof Error ? error.message : 'url_preflight_failed');
    return result;
  }

  const sourceType = detectImportSource(startUrl);
  const warnings: string[] = [];
  const fallbackUsed: string[] = [];
  let finalPreviews: PagePreview[] = [];
  let selectedPages: SelectedPageDiagnostic[] = [];
  let logoUrl: string | null = null;
  const concurrency = Math.max(1, Math.min(opts.fetchConcurrency ?? DEFAULT_FETCH_CONCURRENCY, 8));
  const renderConfig: RenderConfig = { endpoint: opts.renderEndpoint, apiKey: opts.renderApiKey };
  let sitemapDiscovery: Promise<{ candidates: CandidateUrl[]; sitemapSourcesFound: string[] }> | null = null;
  const loadSitemapDiscovery = () => {
    if (!shouldDeepCrawlSource(sourceType)) return Promise.resolve({ candidates: [] as CandidateUrl[], sitemapSourcesFound: [] as string[] });
    sitemapDiscovery ??= discoverSitemapCandidates(startUrl.origin, fetchOpts, Math.min(concurrency, 4)).catch((error) => {
        warnings.push(error instanceof Error ? `sitemap_discovery_failed:${error.message}` : 'sitemap_discovery_failed');
        return { candidates: [] as CandidateUrl[], sitemapSourcesFound: [] as string[] };
      });
    return sitemapDiscovery;
  };
  let googlePlaces = sourceType === 'google_maps'
    ? await lookupGooglePlaces({ url: startUrl, sourceType, apiKey: opts.googlePlacesApiKey, fetcher: opts.fetcher, timeoutMs: Math.min(opts.timeoutMs ?? 5_000, remainingBudget()) })
    : null;

  const useStaticHomepageFallback = async (reason: string) => {
    const startCandidate = candidateFromUrl(
      startUrl.toString(),
      startUrl.pathname === '/' ? 'homepage' : 'nav',
      startUrl.pathname === '/' ? 'Home' : undefined,
      startUrl.toString(),
    );
    if (!startCandidate) return false;
    const homepage = await previewCandidate(startCandidate, fetchOpts, renderConfig, remainingBudget);
    if (!homepage) return false;
    const preview = homepage.preview;
    finalPreviews = [preview];
    selectedPages = [{ url: preview.url, bucket: startUrl.pathname === '/' ? 'homepage' : 'service_hub', score: 100, source: startCandidate.source, reason }];
    fallbackUsed.push('static_homepage');
    if (homepage.usedRender) fallbackUsed.push('headless_render');
    return true;
  };

  if (!shouldDeepCrawlSource(sourceType)) {
    await useStaticHomepageFallback('Platform/social URLs are not recursively crawled.');
    const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews, googlePlaces });
    if (!suggestions.bookingUrl.value) suggestions.bookingUrl = { value: startUrl.toString(), confidence: 0.75, source: 'Platform profile' };
    return {
      ok: suggestions.status !== 'failed',
      suggestions,
      diagnostics: {
        selectedPages,
        skippedPagesSummary: ['Platform/social URLs are not recursively crawled.'],
        sitemapSourcesFound: [],
        serviceHubPagesFound: [],
        childServicePagesFound: [],
        confidenceSummary: { services: suggestions.serviceCatalog.confidence },
        warnings: suggestions.warnings,
        fallbackUsed: fallbackUsed.length ? fallbackUsed : ['static_homepage'],
      },
      logoUrl: null,
    };
  }

  const accountId = cloudflareAccountIdFromRenderEndpoint(opts.renderEndpoint);
  if (accountId && opts.renderApiKey && remainingBudget() > 3_000) {
    try {
      const crawl = await crawlWithCloudflare(startUrl.toString(), {
        accountId,
        apiKey: opts.renderApiKey,
        // Crawl wide: salon menus are split across several service/spa pages (cut, color, add-ons,
        // waxing…). A low limit fills up on about/policy pages before reaching them. The LLM payload
        // builder still only forwards the top service-rich pages, so a high limit costs crawl time,
        // not LLM tokens.
        limit: opts.maxPages ?? 20,
        depth: 2,
        fetcher: opts.fetcher,
        // Leave room for the LLM enrichment pass — the crawl must not consume the whole budget.
        timeoutMs: Math.min(CF_CRAWL_TIMEOUT_MS, Math.max(8_000, remainingBudget() - LLM_ENRICHMENT_RESERVE_MS)),
      });
      finalPreviews = crawl.pages.map(pagePreviewFromCrawlPage);
      selectedPages = diagnosticsFromCrawlPages(crawl.pages);
      logoUrl = crawl.logoUrl;
      if (finalPreviews.length) fallbackUsed.push('cloudflare_crawl');
      else warnings.push('Cloudflare /crawl completed but returned no readable markdown pages.');
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'cloudflare_crawl_failed');
    }
  } else {
    warnings.push('Cloudflare /crawl was not configured; used static homepage fallback.');
  }

  if (!finalPreviews.length) {
    const recovered = await useStaticHomepageFallback('Used static homepage fallback because Cloudflare /crawl did not return readable markdown.');
    if (!recovered && !googlePlaces && opts.googlePlacesApiKey) {
      googlePlaces = await lookupGooglePlaces({
        url: startUrl,
        sourceType,
        hints: { website: startUrl.toString() },
        apiKey: opts.googlePlacesApiKey,
        fetcher: opts.fetcher,
        timeoutMs: Math.min(opts.timeoutMs ?? 5_000, remainingBudget()),
      }).catch(() => null);
    }
  }

  const sitemap = finalPreviews.length
    ? await loadSitemapDiscovery()
    : { candidates: [] as CandidateUrl[], sitemapSourcesFound: [] as string[] };
  const maxPages = opts.maxPages ?? 20;
  if (finalPreviews.length && remainingBudget() > 2_000) {
    const candidates = seedCandidates(startUrl, finalPreviews, sitemap.candidates);
    const firstAugment = await augmentPreviewsFromCandidates(finalPreviews, candidates, fetchOpts, renderConfig, remainingBudget, {
      maxTargets: fallbackUsed.includes('cloudflare_crawl') ? Math.min(8, maxPages) : Math.max(0, maxPages - finalPreviews.length),
      concurrency: Math.min(concurrency, 4),
      forceRender: fallbackUsed.includes('cloudflare_crawl'),
    });
    finalPreviews = firstAugment.previews;
    if (firstAugment.renderedCount > 0) fallbackUsed.push('headless_render');

    const childCandidates = seedCandidates(startUrl, finalPreviews, sitemap.candidates);
    const secondAugment = await augmentPreviewsFromCandidates(finalPreviews, childCandidates, fetchOpts, renderConfig, remainingBudget, {
      maxTargets: Math.min(opts.maxChildServicePages ?? 6, Math.max(0, maxPages + 6 - finalPreviews.length)),
      concurrency: Math.min(concurrency, 4),
      forceRender: fallbackUsed.includes('cloudflare_crawl'),
    });
    finalPreviews = secondAugment.previews;
    if (secondAugment.renderedCount > 0) fallbackUsed.push('headless_render');

    const finalSelection = selectFinalPreviews(finalPreviews, startUrl, seedCandidates(startUrl, finalPreviews, sitemap.candidates), maxPages);
    finalPreviews = finalSelection.previews;
    selectedPages = finalSelection.selectedPages;
  }

  if (!finalPreviews.length) {
    if (googlePlaces) {
      const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: [], googlePlaces });
      return {
        ok: suggestions.status !== 'failed',
        suggestions,
        diagnostics: {
          selectedPages: [],
          skippedPagesSummary: [],
          sitemapSourcesFound: [],
          serviceHubPagesFound: [],
          childServicePagesFound: [],
          confidenceSummary: { hours: suggestions.hours.confidence, contact: suggestions.businessProfile.phone.confidence },
          warnings: [...suggestions.warnings, ...warnings, 'The website could not be read. Details came from the Google Places business listing — please review them.'],
          fallbackUsed: ['google_places'],
        },
        logoUrl: null,
      };
    }
    const result = emptyResult(startUrl.toString(), sourceType);
    result.diagnostics.warnings.push(...warnings);
    return result;
  }

  const budgetForEnrichment = remainingBudget();
  const staticHints = (!googlePlaces && sourceType === 'normal_website' && opts.googlePlacesApiKey)
    ? buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews })
    : null;
  const llmWantsToRun = Boolean(opts.llmEnabled) && budgetForEnrichment >= MIN_LLM_BUDGET_MS;
  let llmGloballyCapped = false;
  let runLlm = llmWantsToRun;
  if (llmWantsToRun && opts.acquireLlmBudget) {
    runLlm = await opts.acquireLlmBudget().catch(() => false);
    llmGloballyCapped = !runLlm;
  }
  const [googlePlacesResult, llmResult] = await Promise.allSettled([
    staticHints
      ? lookupGooglePlaces({
          url: startUrl,
          sourceType,
          hints: {
            name: staticHints.businessProfile.name.value,
            phone: staticHints.businessProfile.phone.value,
            address: staticHints.businessProfile.address.value,
            website: staticHints.businessProfile.website.value ?? startUrl.toString(),
          },
          apiKey: opts.googlePlacesApiKey!,
          fetcher: opts.fetcher,
          timeoutMs: Math.min(opts.timeoutMs ?? 5_000, budgetForEnrichment),
        })
      : Promise.resolve(googlePlaces),
    extractWebsiteImportWithLlm(
      { sourceUrl: startUrl.toString(), previews: finalPreviews, googlePlaces: null, selectedPages },
      {
        enabled: runLlm,
        apiKey: opts.openAiApiKey,
        model: opts.llmModel,
        maxTokens: opts.llmMaxTokens,
        fetcher: opts.fetcher,
        timeoutMs: Math.min(LLM_CALL_TIMEOUT_MS, budgetForEnrichment),
      },
    ),
  ]);
  const finalGooglePlaces = googlePlacesResult.status === 'fulfilled' ? googlePlacesResult.value : googlePlaces;
  const llmExtraction = llmResult.status === 'fulfilled' ? llmResult.value : null;
  const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews, googlePlaces: finalGooglePlaces, llmExtraction });
  const servicePagesFound = selectedPages.filter((page) => page.bucket === 'service_hub' || page.bucket === 'service_child').map((page) => page.url);
  const childServicePagesFound = selectedPages.filter((page) => page.bucket === 'service_child').map((page) => page.url);
  const richestPageMarkdownLength = finalPreviews.reduce((max, page) => Math.max(max, page.markdown?.length ?? page.firstTextChars.length), 0);
  const menuExceededSinglePassBudget = richestPageMarkdownLength > LLM_TOP_PAGE_MARKDOWN_BUDGET;
  const allWarnings = [
    ...suggestions.warnings,
    ...warnings,
    ...(llmGloballyCapped ? ['AI enrichment was skipped due to a temporary daily limit; details came from static extraction. Please review carefully.'] : []),
    ...(menuExceededSinglePassBudget ? ['This menu was longer than could be read in a single pass — some services may be missing. Please review and add any that are absent.'] : []),
  ];

  return {
    ok: suggestions.status !== 'failed',
    suggestions,
    diagnostics: {
      selectedPages,
      skippedPagesSummary: [`Cloudflare /crawl returned ${finalPreviews.length} readable markdown page(s).`],
      sitemapSourcesFound: sitemap.sitemapSourcesFound,
      serviceHubPagesFound: servicePagesFound,
      childServicePagesFound,
      confidenceSummary: {
        services: suggestions.serviceCatalog.confidence,
        businessProfile: suggestions.businessProfile.name.confidence,
        contact: suggestions.businessProfile.phone.confidence,
        overall: suggestions.completeness?.overallConfidence ?? 0,
      },
      warnings: allWarnings,
      fallbackUsed: [...new Set([...fallbackUsed, ...(finalGooglePlaces ? ['google_places'] : []), ...(llmExtraction ? ['llm'] : [])])],
    },
    logoUrl,
  };
}

export async function importWebsiteForOnboarding(input: { url: string }, opts: ImportOptions = {}): Promise<WebsiteImportResult> {
  return importWebsiteForOnboardingWithCloudflare(input, opts);
}
