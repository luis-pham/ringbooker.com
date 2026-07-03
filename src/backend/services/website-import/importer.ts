import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { isGoogleMapsShortLinkHostname, isGoogleMapsUrl } from '@/lib/google-maps-url';
import { preflightUrl, resolveSafeUrl, type DnsLookup } from './security';
import { resolveGoogleMapsShortLink } from './short-link-resolver';
import { detectImportSource, shouldDeepCrawlSource } from './source-routing';
import { extractLinks, previewHtml } from './html';
import { commonSitemapUrls, parseRobotsSitemaps, parseSitemapXml, prioritizeChildSitemaps, sitemapUrlsToCandidates } from './sitemap';
import { buildSuggestions } from './extract';
import { mergePolicyRetryIntoSuggestions, mergeServiceRetryIntoSuggestions, normalizeImportSuggestionsForReview } from './merge';
import { lookupGooglePlaces } from './google-places';
import { DEFAULT_WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL, extractPoliciesWithLlmRetry, extractServiceCatalogWithLlmRetry, extractWebsiteImportWithLlm, LLM_TOP_PAGE_MARKDOWN_BUDGET } from './llm';
import { classifyCandidate, selectPages, toDiagnostic } from './scoring';
import { renderHtml, type RenderConfig } from './render';
import { crawlWithCloudflare, CF_CRAWL_TIMEOUT_MS, type CfCrawlPage } from './cf-crawler';
import type { CandidateBucket, CandidateUrl, ImportSourceType, ImportSuggestions, PagePreview, SelectedPageDiagnostic, WebsiteImportErrorCode, WebsiteImportResult } from './types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

type SiteBuilder = 'nextjs' | 'nuxtjs' | 'react_spa' | 'square_weebly' | 'webflow' | 'wix' | 'squarespace' | 'shopify' | null;

const STATIC_ASSET_PATH_RE = /\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|mjs|map|mov|mp3|mp4|otf|pdf|png|svg|ttf|webm|webp|woff2?|zip)(?:$|[?#])/i;

function isLikelyStaticAssetUrl(value: string): boolean {
  try {
    return STATIC_ASSET_PATH_RE.test(new URL(value).pathname);
  } catch {
    return STATIC_ASSET_PATH_RE.test(value);
  }
}

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
  serviceRetryEnabled?: boolean;
  serviceRetryModel?: string | null;
  difficultFallbackModel?: string | null;
  serviceRetryMaxPages?: number;
  serviceRetryTimeoutMs?: number;
  serviceRetryMinServiceCount?: number;
  policyRetryEnabled?: boolean;
  policyRetryModel?: string | null;
  policyRetryFallbackModel?: string | null;
  policyRetryMaxPages?: number;
  policyRetryTimeoutMs?: number;
  policyRetryMinPolicyCount?: number;
  debugLog?: boolean;
  debugSaveText?: boolean;
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
  return !compact
    || /^(?:404|not found|page not found|not found \||500 internal server error|internal server error|server error|403 forbidden|forbidden|access denied|service unavailable|bad gateway|gateway timeout)/i.test(compact)
    || /\b(?:the server encountered an internal error|unable to complete your request|error document to handle the request|server misconfiguration|temporarily unavailable)\b/i.test(compact);
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
    if (isLikelyStaticAssetUrl(parsed.toString())) return null;
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
    // Use the post-redirect URL, not the requested one — a sitemap fetched via the
    // pre-redirect origin still lists pages on the site's canonical (resolved) origin.
    return { sitemapUrl: sitemap.url, parsed: parseSitemapXml(sitemap.text) };
  });
  for (const entry of topLevel) {
    if (!entry) continue;
    sitemapSourcesFound.push(entry.sitemapUrl);
    const entryOrigin = safeOrigin(entry.sitemapUrl) ?? origin;
    const childResults = await mapPool(prioritizeChildSitemaps(entry.parsed.childSitemaps, 5), concurrency, async (child) => {
      const childText = await fetchText(child, opts);
      if (!childText?.text) return null;
      return { child: childText.url, urls: parseSitemapXml(childText.text).urls };
    });
    for (const childResult of childResults) {
      if (!childResult) continue;
      sitemapSourcesFound.push(childResult.child);
      const childOrigin = safeOrigin(childResult.child) ?? entryOrigin;
      candidates.push(...sitemapUrlsToCandidates(childResult.urls, childResult.child, childOrigin, 200));
    }
    candidates.push(...sitemapUrlsToCandidates(entry.parsed.urls, entry.sitemapUrl, entryOrigin, 200));
  }
  return { candidates, sitemapSourcesFound };
}

function emptyResult(
  sourceUrl: string,
  sourceType: ImportSourceType = detectImportSource(new URL(sourceUrl)),
  opts?: { errorCode?: WebsiteImportErrorCode },
): WebsiteImportResult {
  const suggestions = buildSuggestions({ sourceUrl, sourceType, previews: [] });
  return {
    ok: false,
    suggestions,
    diagnostics: { selectedPages: [], skippedPagesSummary: [], sitemapSourcesFound: [], serviceHubPagesFound: [], childServicePagesFound: [], confidenceSummary: {}, warnings: ['Import returned no readable website content.'], fallbackUsed: [] },
    logoUrl: null,
    errorCode: opts?.errorCode,
  };
}

/** Classifies a terminal Maps-import failure so callers can surface a distinct, actionable message. */
function googleMapsErrorCode(sourceType: ImportSourceType, googlePlaces: import('./google-places').GooglePlacesSuggestion | null): WebsiteImportErrorCode | undefined {
  if (sourceType !== 'google_maps' || !googlePlaces) return undefined;
  if (googlePlaces.name || googlePlaces.address || googlePlaces.phone || googlePlaces.website) return undefined;
  const warningText = (googlePlaces.warnings ?? []).join(' ');
  if (!warningText) return undefined;
  if (/Place Details lookup failed/i.test(warningText)) return 'PLACE_ID_LOOKUP_FAILED';
  return 'PLACE_NOT_FOUND';
}

/**
 * Overlays service/staff/policy/FAQ/promotion/booking data scraped from a Places-listed website
 * onto Places-derived suggestions. Structured business-profile fields (name, address, phone,
 * hours, timezone) stay authoritative from Google Places and are never overwritten here.
 */
function mergeSecondaryWebsiteSuggestions(base: ImportSuggestions, secondary: ImportSuggestions): ImportSuggestions {
  return {
    ...base,
    serviceCatalog: secondary.serviceCatalog.services.length ? secondary.serviceCatalog : base.serviceCatalog,
    alsoOffers: secondary.alsoOffers.length ? secondary.alsoOffers : base.alsoOffers,
    languages: secondary.languages.length ? secondary.languages : base.languages,
    staffSuggestions: secondary.staffSuggestions.length ? secondary.staffSuggestions : base.staffSuggestions,
    policySuggestions: secondary.policySuggestions.length ? secondary.policySuggestions : base.policySuggestions,
    faqSuggestions: secondary.faqSuggestions.length ? secondary.faqSuggestions : base.faqSuggestions,
    promotionSuggestions: secondary.promotionSuggestions.length ? secondary.promotionSuggestions : base.promotionSuggestions,
    bookingSetupSuggestions: secondary.bookingSetupSuggestions.length ? secondary.bookingSetupSuggestions : base.bookingSetupSuggestions,
    bookingUrl: base.bookingUrl.value ? base.bookingUrl : secondary.bookingUrl,
    warnings: [...base.warnings, ...secondary.warnings],
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

function safeOrigin(url: string): string | null {
  try { return new URL(url).origin; } catch { return null; }
}

/**
 * Sites commonly redirect the requested URL to a different scheme/host (http→https,
 * www→bare or vice versa). `startUrl.origin` is the origin the user typed, not the one
 * the site actually serves content from, so same-origin candidate filtering must key off
 * the origin of a page we actually fetched (once we have one) or it silently discards
 * every real nav link discovered on the redirected site.
 */
function resolvedOrigin(startUrl: URL, previews: PagePreview[]): string {
  for (const preview of previews) {
    const origin = safeOrigin(preview.url);
    if (origin) return origin;
  }
  return startUrl.origin;
}

function seedCandidates(startUrl: URL, previews: PagePreview[], sitemapCandidates: CandidateUrl[]): CandidateUrl[] {
  const origin = resolvedOrigin(startUrl, previews);
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
      if (!looksLikeEmptyOrNotFoundPage(renderedPreview.firstTextChars || renderedPreview.h1 || renderedPreview.title)
        && (forceRender || shouldKeepRenderedPreview(renderedPreview, staticPreview))) {
        return { preview: renderedPreview, usedRender: true };
      }
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

function countPreviewsInBucket(
  previews: PagePreview[],
  startUrl: URL,
  candidates: CandidateUrl[],
  bucket: CandidateBucket,
): number {
  const candidateByUrl = new Map(dedupeCandidates(candidates).map((candidate) => [normalizedUrlKey(candidate.url), candidate]));
  const rootKey = normalizedUrlKey(`${startUrl.origin}/`);
  return previews.filter((preview, index) => {
    const key = normalizedUrlKey(preview.url);
    const candidate = candidateByUrl.get(key)
      ?? candidateFromUrl(preview.url, key === rootKey ? 'homepage' : 'sitemap', undefined, startUrl.toString())
      ?? { url: preview.url, source: index === 0 ? 'homepage' : 'sitemap', pathTokens: [], discoveredFrom: startUrl.toString() } satisfies CandidateUrl;
    return classifyImportCandidate(candidate, preview).bucket === bucket;
  }).length;
}

function selectMissingSitemapBucketCandidates(
  candidates: CandidateUrl[],
  existingPreviews: PagePreview[],
  bucket: CandidateBucket,
  maxTargets: number,
): CandidateUrl[] {
  if (maxTargets <= 0) return [];
  const existing = new Set(existingPreviews.map((preview) => normalizedUrlKey(preview.url)));
  return dedupeCandidates(candidates)
    .filter((candidate) => !existing.has(normalizedUrlKey(candidate.url)))
    .map((candidate) => ({ candidate, ...classifyImportCandidate(candidate) }))
    .filter((item) => item.bucket === bucket && item.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTargets)
    .map((item) => item.candidate);
}

async function addSpecificCandidatePreviews(
  previews: PagePreview[],
  targets: CandidateUrl[],
  opts: ImportOptions,
  renderConfig: RenderConfig,
  remainingBudget: () => number,
  options: { concurrency: number; forceRender?: boolean },
): Promise<{ previews: PagePreview[]; renderedCount: number }> {
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

const SERVICE_RETRY_KEYWORDS = [
  'service', 'services', 'pricing', 'menu',
  'cut', 'style', 'haircut', 'haircuts',
  'color', 'colour', 'balayage', 'highlight',
  'treatment', 'treatments', 'scalp',
  'waxing', 'wax', 'facial', 'facials',
  'spa', 'massage',
  'extension', 'extensions', 'texture',
  'bridal', 'occasion', 'add-services',
  'lash', 'brow',
  'nails', 'manicure', 'pedicure',
  'microchanneling', 'led', 'therapy',
] as const;
const SERVICE_RETRY_KEYWORD_RE = new RegExp(`\\b(?:${SERVICE_RETRY_KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
const SERVICE_RETRY_WARNING_RE = /low service coverage|multiple service pages|only \d+ services|service pages found|broad service categories/i;

type ServiceRetrySelectedPageInfo = {
  url?: string;
  title?: string | null;
  bucket?: string;
  markdownLength?: number;
  visibleTextLength?: number;
  serviceBlockCount?: number;
};
type ServiceRetryPage = {
  url: string;
  title: string | null;
  text: string;
  textLength: number;
  source: 'selected_page' | 'discovered_url' | 'evidence' | 'fetched';
  error?: string;
  debugTextPath?: string;
};

function isServiceRetryRelatedText(value: string): boolean {
  return SERVICE_RETRY_KEYWORD_RE.test(value);
}

function sameOriginUrl(value: string, origin: string): string | null {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    if (parsed.origin !== origin) return null;
    if (isLikelyStaticAssetUrl(parsed.toString())) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function detectLowServiceCoverage(input: {
  suggestions: ImportSuggestions;
  selectedPages?: ServiceRetrySelectedPageInfo[];
  discoveredUrls?: string[];
  warnings?: string[];
  minServiceCount?: number;
}): {
  shouldRetryServices: boolean;
  reasons: string[];
  servicesCount: number;
  servicePageCount: number;
} {
  const minServiceCount = input.minServiceCount ?? 15;
  const servicesCount = input.suggestions.serviceCatalog.services.length;
  const servicePageUrls = new Set<string>();
  for (const page of input.selectedPages ?? []) {
    const probe = `${page.url ?? ''} ${page.title ?? ''} ${page.bucket ?? ''}`;
    if (page.bucket === 'service_hub' || page.bucket === 'service_child' || (page.serviceBlockCount ?? 0) > 0 || isServiceRetryRelatedText(probe)) {
      if (page.url) servicePageUrls.add(normalizedUrlKey(page.url));
    }
  }
  for (const url of input.discoveredUrls ?? []) {
    if (isServiceRetryRelatedText(url)) servicePageUrls.add(normalizedUrlKey(url));
  }
  const servicePageCount = servicePageUrls.size;
  const warningText = (input.warnings ?? []).join('\n');
  const reasons: string[] = [];
  if (servicesCount === 0) reasons.push('No services were extracted.');
  if (servicesCount < 12 && servicePageCount > 0) reasons.push(`Only ${servicesCount} services extracted despite service-related pages.`);
  if (servicesCount < minServiceCount && servicePageCount >= 3) reasons.push(`Only ${servicesCount} services extracted with ${servicePageCount} service-related pages found.`);
  if (SERVICE_RETRY_WARNING_RE.test(warningText)) reasons.push('Import warnings indicate low or incomplete service coverage.');
  return { shouldRetryServices: reasons.length > 0, reasons, servicesCount, servicePageCount };
}

function serviceRetryTextFromPreview(preview: PagePreview): string {
  const markdownOrText = (preview.markdown || preview.firstTextChars || '').trim();
  const serviceBlockText = (preview.serviceBlocks ?? [])
    .map((block) => [
      block.groupHeading,
      block.serviceName,
      block.priceText,
      block.durationText,
      block.descriptionText,
      block.sourceText,
    ].filter(Boolean).join(' | '))
    .filter(Boolean)
    .join('\n');
  const parts = [
    markdownOrText,
    serviceBlockText ? `\nSTRUCTURED_SERVICE_BLOCKS\n${serviceBlockText}` : '',
  ].filter(Boolean);
  return parts.join('\n\n').replace(/\u0000/g, ' ').replace(/\s+\n/g, '\n').trim().slice(0, 20_000);
}

function serviceRetryPageFromPreview(
  preview: PagePreview,
  source: ServiceRetryPage['source'],
): ServiceRetryPage | null {
  const text = serviceRetryTextFromPreview(preview);
  const textLength = text.trim().length;
  if (textLength < 300 && (preview.serviceBlocks?.length ?? 0) === 0) return null;
  return { url: preview.url, title: preview.title || preview.h1 || null, text, textLength, source };
}

function selectedServiceRetryPageInfos(
  previews: PagePreview[],
  selectedPages: SelectedPageDiagnostic[],
): ServiceRetrySelectedPageInfo[] {
  const selectedByUrl = new Map(selectedPages.map((page) => [normalizedUrlKey(page.url), page]));
  return previews.map((preview) => {
    const selected = selectedByUrl.get(normalizedUrlKey(preview.url));
    return {
      url: preview.url,
      title: preview.title || preview.h1 || null,
      bucket: selected?.bucket,
      markdownLength: preview.markdown?.length ?? 0,
      visibleTextLength: preview.firstTextChars.length,
      serviceBlockCount: preview.serviceBlocks?.length ?? 0,
    };
  });
}

function collectDiscoveredUrls(startUrl: URL, previews: PagePreview[], sitemapCandidates: CandidateUrl[]): string[] {
  return [...new Set([
    ...previews.map((preview) => preview.url),
    ...previews.flatMap((preview) => preview.links.map((link) => link.href)),
    ...sitemapCandidates.map((candidate) => candidate.url),
    ...seedCandidates(startUrl, previews, sitemapCandidates).map((candidate) => candidate.url),
  ])];
}

function urlMatchesFromText(value?: string | null): string[] {
  if (!value) return [];
  return [...value.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)].map((match) => match[0].replace(/[.,;:]+$/g, ''));
}

function collectEvidenceUrls(suggestions: ImportSuggestions): string[] {
  return [...new Set([
    ...urlMatchesFromText(suggestions.bookingUrl.value),
    ...suggestions.serviceCatalog.services.flatMap((service) => urlMatchesFromText(service.evidenceSnippet)),
    ...suggestions.staffSuggestions.flatMap((item) => [item.sourceUrl, ...urlMatchesFromText(item.evidenceSnippet)]),
    ...suggestions.policySuggestions.flatMap((item) => [item.sourceUrl, ...urlMatchesFromText(item.evidenceSnippet)]),
    ...suggestions.faqSuggestions.flatMap((item) => [item.sourceUrl, ...urlMatchesFromText(item.evidenceSnippet)]),
    ...suggestions.promotionSuggestions.flatMap((item) => [item.sourceUrl, ...urlMatchesFromText(item.evidenceSnippet)]),
    ...suggestions.bookingSetupSuggestions.flatMap((item) => [item.sourceUrl, ...urlMatchesFromText(item.value)]),
  ].filter((url): url is string => Boolean(url)))];
}

function safeDebugSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'page';
}

async function saveServiceRetryDebugText(rootUrl: string, pages: ServiceRetryPage[]): Promise<ServiceRetryPage[]> {
  let root: URL;
  try { root = new URL(rootUrl); } catch { return pages; }
  const domain = safeDebugSegment(root.hostname.replace(/^www\./, ''));
  const dir = path.join(process.cwd(), 'tmp', 'website-import-debug', domain, 'service-retry-pages');
  await mkdir(dir, { recursive: true }).catch(() => undefined);
  return Promise.all(pages.map(async (page, index) => {
    let filename = `page-${index + 1}`;
    try {
      const parsed = new URL(page.url);
      filename = safeDebugSegment(parsed.pathname === '/' ? 'home' : parsed.pathname);
    } catch {
      filename = safeDebugSegment(page.title ?? `page-${index + 1}`);
    }
    const debugTextPath = path.join(dir, `${String(index + 1).padStart(2, '0')}-${filename}.txt`);
    const body = [`URL: ${page.url}`, `TITLE: ${page.title ?? ''}`, `TEXT_LENGTH: ${page.textLength}`, '---', page.text].join('\n');
    await writeFile(debugTextPath, body, 'utf8').catch(() => undefined);
    return { ...page, debugTextPath };
  }));
}

async function collectServiceRetryPages(input: {
  rootUrl: string;
  selectedPages: Array<{ preview: PagePreview; bucket?: CandidateBucket }>;
  discoveredUrls: string[];
  evidenceUrls: string[];
  maxPages: number;
  timeoutMs: number;
  opts: ImportOptions;
  renderConfig: RenderConfig;
  remainingBudget: () => number;
  debugSaveText?: boolean;
}): Promise<ServiceRetryPage[]> {
  const root = new URL(input.rootUrl);
  const pages: ServiceRetryPage[] = [];
  const seen = new Set<string>();
  const addPage = (page: ServiceRetryPage | null) => {
    if (!page || pages.length >= input.maxPages) return;
    if (page.textLength < 300 && !page.error) return;
    const key = normalizedUrlKey(page.url);
    if (seen.has(key)) return;
    seen.add(key);
    pages.push(page);
  };

  const sortedSelected = [...input.selectedPages].sort((a, b) => {
    const aService = a.bucket === 'service_hub' || a.bucket === 'service_child' ? 1 : 0;
    const bService = b.bucket === 'service_hub' || b.bucket === 'service_child' ? 1 : 0;
    const aScore = aService * 100 + (a.preview.serviceBlocks?.length ?? 0) * 5 + a.preview.priceCount;
    const bScore = bService * 100 + (b.preview.serviceBlocks?.length ?? 0) * 5 + b.preview.priceCount;
    return bScore - aScore;
  });
  for (const item of sortedSelected) {
    const probe = `${item.preview.url} ${item.preview.title} ${item.preview.h1} ${item.preview.h2s.join(' ')} ${item.bucket ?? ''}`;
    if (item.bucket === 'service_hub' || item.bucket === 'service_child' || isServiceRetryRelatedText(probe) || (item.preview.serviceBlocks?.length ?? 0) > 0) {
      addPage(serviceRetryPageFromPreview(item.preview, 'selected_page'));
    }
  }

  if (pages.length >= input.maxPages || input.remainingBudget() <= 1_000) {
    return input.debugSaveText ? saveServiceRetryDebugText(input.rootUrl, pages) : pages;
  }

  const evidenceSet = new Set(input.evidenceUrls.map((url) => normalizedUrlKey(url)));
  const candidateUrls = [...new Set([...input.discoveredUrls, ...input.evidenceUrls])]
    .map((url) => sameOriginUrl(url, root.origin))
    .filter((url): url is string => Boolean(url))
    .filter((url) => !seen.has(normalizedUrlKey(url)) && isServiceRetryRelatedText(url))
    .slice(0, Math.max(0, input.maxPages - pages.length) * 3);
  const retryDeadline = Math.min(input.opts.deadline ?? Number.MAX_SAFE_INTEGER, Date.now() + input.timeoutMs);
  const retryRemainingBudget = () => Math.min(input.remainingBudget(), Math.max(0, retryDeadline - Date.now()));
  const retryOpts: ImportOptions = {
    ...input.opts,
    deadline: retryDeadline,
    timeoutMs: Math.min(input.opts.timeoutMs ?? input.timeoutMs, input.timeoutMs),
  };
  const fetched = await mapPool(candidateUrls, Math.min(3, Math.max(1, candidateUrls.length)), async (url) => {
    if (pages.length >= input.maxPages || retryRemainingBudget() <= 1_000) return null;
    const candidate = candidateFromUrl(url, evidenceSet.has(normalizedUrlKey(url)) ? 'nav' : 'sitemap', undefined, input.rootUrl);
    if (!candidate) return null;
    const preview = await previewCandidate(candidate, retryOpts, input.renderConfig, retryRemainingBudget, true);
    if (!preview?.preview) return { url, title: null, text: '', textLength: 0, source: 'fetched' as const, error: 'fetch_failed' };
    return serviceRetryPageFromPreview(preview.preview, evidenceSet.has(normalizedUrlKey(url)) ? 'evidence' : 'discovered_url');
  });
  for (const page of fetched) addPage(page);
  return input.debugSaveText ? saveServiceRetryDebugText(input.rootUrl, pages) : pages;
}

const POLICY_RETRY_KEYWORDS = [
  'policy', 'policies', 'cancellation', 'cancel', 'no-show', 'noshow',
  'deposit', 'refund', 'return', 'late', 'arrival', 'walk-ins', 'walkins',
  'appointment', 'booking', 'book', 'faq', 'faqs', 'terms',
  'gift-card', 'giftcard', 'gift', 'guarantee', 'redo',
  'credit-card', 'card', 'payment', 'fee', 'consultation',
  'privacy', 'etiquette', 'spa-etiquette',
] as const;
const POLICY_RETRY_KEYWORD_RE = new RegExp(`\\b(?:${POLICY_RETRY_KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\-/g, '[-_\\s]?')).join('|')})\\b`, 'i');
const POLICY_RETRY_WARNING_RE = /policy|cancellation|no[- ]?show|deposit|refund|booking terms|terms/i;

type PolicyRetryPage = ServiceRetryPage;
type PolicyRetrySelectedPageInfo = Omit<ServiceRetrySelectedPageInfo, 'serviceBlockCount'>;

function isPolicyRetryRelatedText(value: string): boolean {
  return POLICY_RETRY_KEYWORD_RE.test(value);
}

export function detectLowPolicyCoverage(input: {
  suggestions: ImportSuggestions;
  selectedPages?: PolicyRetrySelectedPageInfo[];
  discoveredUrls?: string[];
  warnings?: string[];
  minPolicyCount?: number;
}): {
  shouldRetryPolicies: boolean;
  reasons: string[];
  policiesCount: number;
  policyPageCount: number;
} {
  const minPolicyCount = input.minPolicyCount ?? 3;
  const policiesCount = input.suggestions.policySuggestions.length;
  const policyPageUrls = new Set<string>();
  for (const page of input.selectedPages ?? []) {
    const probe = `${page.url ?? ''} ${page.title ?? ''} ${page.bucket ?? ''}`;
    if (page.bucket === 'policies' || page.bucket === 'faq' || page.bucket === 'contact_hours' || page.bucket === 'booking' || isPolicyRetryRelatedText(probe)) {
      if (page.url) policyPageUrls.add(normalizedUrlKey(page.url));
    }
  }
  for (const url of input.discoveredUrls ?? []) {
    if (isPolicyRetryRelatedText(url)) policyPageUrls.add(normalizedUrlKey(url));
  }
  const policyPageCount = policyPageUrls.size;
  const warningText = (input.warnings ?? []).join('\n');
  const reasons: string[] = [];
  if (policiesCount === 0 && policyPageCount > 0) reasons.push('No policies were extracted despite policy-related pages.');
  if (policiesCount < minPolicyCount && policyPageCount >= 1) reasons.push(`Only ${policiesCount} policies extracted with ${policyPageCount} policy-related page(s) found.`);
  if (POLICY_RETRY_WARNING_RE.test(warningText)) reasons.push('Import warnings indicate policy or booking-rule coverage risk.');
  return { shouldRetryPolicies: reasons.length > 0, reasons, policiesCount, policyPageCount };
}

function policyRetryTextFromPreview(preview: PagePreview): string {
  const markdownOrText = (preview.markdown || preview.firstTextChars || '').trim();
  const policyBlockText = (preview.policyBlocks ?? [])
    .map((block) => [block.heading, block.content].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
  const parts = [
    markdownOrText,
    policyBlockText ? `\nSTRUCTURED_POLICY_BLOCKS\n${policyBlockText}` : '',
  ].filter(Boolean);
  return parts.join('\n\n').replace(/\u0000/g, ' ').replace(/\s+\n/g, '\n').trim().slice(0, 18_000);
}

function policyRetryPageFromPreview(
  preview: PagePreview,
  source: PolicyRetryPage['source'],
): PolicyRetryPage | null {
  const text = policyRetryTextFromPreview(preview);
  const textLength = text.trim().length;
  if (textLength < 250 && (preview.policyBlocks?.length ?? 0) === 0) return null;
  return { url: preview.url, title: preview.title || preview.h1 || null, text, textLength, source };
}

function selectedPolicyRetryPageInfos(
  previews: PagePreview[],
  selectedPages: SelectedPageDiagnostic[],
): PolicyRetrySelectedPageInfo[] {
  const selectedByUrl = new Map(selectedPages.map((page) => [normalizedUrlKey(page.url), page]));
  return previews.map((preview) => {
    const selected = selectedByUrl.get(normalizedUrlKey(preview.url));
    return {
      url: preview.url,
      title: preview.title || preview.h1 || null,
      bucket: selected?.bucket,
      markdownLength: preview.markdown?.length ?? 0,
      visibleTextLength: preview.firstTextChars.length,
    };
  });
}

async function savePolicyRetryDebugText(rootUrl: string, pages: PolicyRetryPage[]): Promise<PolicyRetryPage[]> {
  let root: URL;
  try { root = new URL(rootUrl); } catch { return pages; }
  const domain = safeDebugSegment(root.hostname.replace(/^www\./, ''));
  const dir = path.join(process.cwd(), 'tmp', 'website-import-debug', domain, 'policy-retry-pages');
  await mkdir(dir, { recursive: true }).catch(() => undefined);
  return Promise.all(pages.map(async (page, index) => {
    let filename = `page-${index + 1}`;
    try {
      const parsed = new URL(page.url);
      filename = safeDebugSegment(parsed.pathname === '/' ? 'home' : parsed.pathname);
    } catch {
      filename = safeDebugSegment(page.title ?? `page-${index + 1}`);
    }
    const debugTextPath = path.join(dir, `${String(index + 1).padStart(2, '0')}-${filename}.txt`);
    const body = [`URL: ${page.url}`, `TITLE: ${page.title ?? ''}`, `TEXT_LENGTH: ${page.textLength}`, '---', page.text].join('\n');
    await writeFile(debugTextPath, body, 'utf8').catch(() => undefined);
    return { ...page, debugTextPath };
  }));
}

async function collectPolicyRetryPages(input: {
  rootUrl: string;
  selectedPages: Array<{ preview: PagePreview; bucket?: CandidateBucket }>;
  discoveredUrls: string[];
  evidenceUrls: string[];
  maxPages: number;
  timeoutMs: number;
  opts: ImportOptions;
  renderConfig: RenderConfig;
  remainingBudget: () => number;
  debugSaveText?: boolean;
}): Promise<PolicyRetryPage[]> {
  const root = new URL(input.rootUrl);
  const pages: PolicyRetryPage[] = [];
  const seen = new Set<string>();
  const addPage = (page: PolicyRetryPage | null) => {
    if (!page || pages.length >= input.maxPages) return;
    if (page.textLength < 250 && !page.error) return;
    const key = normalizedUrlKey(page.url);
    if (seen.has(key)) return;
    seen.add(key);
    pages.push(page);
  };

  const sortedSelected = [...input.selectedPages].sort((a, b) => {
    const aPolicy = a.bucket === 'policies' ? 1 : a.bucket === 'faq' || a.bucket === 'contact_hours' || a.bucket === 'booking' ? 0.8 : 0;
    const bPolicy = b.bucket === 'policies' ? 1 : b.bucket === 'faq' || b.bucket === 'contact_hours' || b.bucket === 'booking' ? 0.8 : 0;
    const aScore = aPolicy * 100 + (a.preview.policyBlocks?.length ?? 0) * 20 + (isPolicyRetryRelatedText(`${a.preview.title} ${a.preview.h1} ${a.preview.firstTextChars}`) ? 20 : 0);
    const bScore = bPolicy * 100 + (b.preview.policyBlocks?.length ?? 0) * 20 + (isPolicyRetryRelatedText(`${b.preview.title} ${b.preview.h1} ${b.preview.firstTextChars}`) ? 20 : 0);
    return bScore - aScore;
  });
  for (const item of sortedSelected) {
    const probe = `${item.preview.url} ${item.preview.title} ${item.preview.h1} ${item.preview.h2s.join(' ')} ${item.bucket ?? ''} ${item.preview.firstTextChars.slice(0, 1200)}`;
    if (item.bucket === 'policies' || item.bucket === 'faq' || item.bucket === 'contact_hours' || item.bucket === 'booking' || (item.preview.policyBlocks?.length ?? 0) > 0 || isPolicyRetryRelatedText(probe)) {
      addPage(policyRetryPageFromPreview(item.preview, 'selected_page'));
    }
  }

  if (pages.length >= input.maxPages || input.remainingBudget() <= 1_000) {
    return input.debugSaveText ? savePolicyRetryDebugText(input.rootUrl, pages) : pages;
  }

  const evidenceSet = new Set(input.evidenceUrls.map((url) => normalizedUrlKey(url)));
  const candidateUrls = [...new Set([...input.discoveredUrls, ...input.evidenceUrls])]
    .map((url) => sameOriginUrl(url, root.origin))
    .filter((url): url is string => Boolean(url))
    .filter((url) => !seen.has(normalizedUrlKey(url)) && isPolicyRetryRelatedText(url))
    .slice(0, Math.max(0, input.maxPages - pages.length) * 3);
  const retryDeadline = Math.min(input.opts.deadline ?? Number.MAX_SAFE_INTEGER, Date.now() + input.timeoutMs);
  const retryRemainingBudget = () => Math.min(input.remainingBudget(), Math.max(0, retryDeadline - Date.now()));
  const retryOpts: ImportOptions = {
    ...input.opts,
    deadline: retryDeadline,
    timeoutMs: Math.min(input.opts.timeoutMs ?? input.timeoutMs, input.timeoutMs),
  };
  const fetched = await mapPool(candidateUrls, Math.min(3, Math.max(1, candidateUrls.length)), async (url) => {
    if (pages.length >= input.maxPages || retryRemainingBudget() <= 1_000) return null;
    const candidate = candidateFromUrl(url, evidenceSet.has(normalizedUrlKey(url)) ? 'nav' : 'sitemap', undefined, input.rootUrl);
    if (!candidate) return null;
    const preview = await previewCandidate(candidate, retryOpts, input.renderConfig, retryRemainingBudget, true);
    if (!preview?.preview) return { url, title: null, text: '', textLength: 0, source: 'fetched' as const, error: 'fetch_failed' };
    return policyRetryPageFromPreview(preview.preview, evidenceSet.has(normalizedUrlKey(url)) ? 'evidence' : 'discovered_url');
  });
  for (const page of fetched) addPage(page);
  return input.debugSaveText ? savePolicyRetryDebugText(input.rootUrl, pages) : pages;
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

  // Short Google Maps share links (maps.app.goo.gl, goo.gl, g.page) are opaque redirectors —
  // detectImportSource must classify the resolved destination, not the redirector hostname.
  const originalStartUrl = startUrl;
  const shortLinkResolution = await resolveGoogleMapsShortLink(startUrl, { fetcher: opts.fetcher, lookup: opts.lookup });
  if (!shortLinkResolution.ok) {
    const result = emptyResult(startUrl.toString(), detectImportSource(startUrl), { errorCode: shortLinkResolution.errorCode });
    result.diagnostics.warnings.push('Google Maps short link could not be resolved (expired, dead, or blocked).');
    return result;
  }
  startUrl = shortLinkResolution.resolvedUrl;

  const sourceType = detectImportSource(startUrl);
  const warnings: string[] = [];
  if (shortLinkResolution.wasShortLink) warnings.push(`Resolved short link ${originalStartUrl.toString()} to ${startUrl.toString()}.`);
  const fallbackUsed: string[] = [];
  let finalPreviews: PagePreview[] = [];
  let selectedPages: SelectedPageDiagnostic[] = [];
  let logoUrl: string | null = null;
  const concurrency = Math.max(1, Math.min(opts.fetchConcurrency ?? DEFAULT_FETCH_CONCURRENCY, 8));
  const renderConfig: RenderConfig = { endpoint: opts.renderEndpoint, apiKey: opts.renderApiKey };
  let sitemapDiscovery: Promise<{ candidates: CandidateUrl[]; sitemapSourcesFound: string[] }> | null = null;
  const loadSitemapDiscovery = () => {
    if (!shouldDeepCrawlSource(sourceType)) return Promise.resolve({ candidates: [] as CandidateUrl[], sitemapSourcesFound: [] as string[] });
    sitemapDiscovery ??= discoverSitemapCandidates(resolvedOrigin(startUrl, finalPreviews), fetchOpts, Math.min(concurrency, 4)).catch((error) => {
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
    let suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews, googlePlaces });
    if (!suggestions.bookingUrl.value) suggestions.bookingUrl = { value: startUrl.toString(), confidence: 0.75, source: 'Platform profile' };

    const secondaryScrapeWarnings: string[] = [];
    if (sourceType === 'google_maps' && googlePlaces?.website && remainingBudget() > 5_000) {
      const listedWebsite = googlePlaces.website;
      const isRecursiveMapsLink = (() => {
        try {
          const parsed = new URL(listedWebsite);
          return isGoogleMapsUrl(parsed) || isGoogleMapsShortLinkHostname(parsed.hostname);
        } catch {
          return true; // unparsable "website" — treat as unusable rather than recurse on garbage
        }
      })();
      if (!isRecursiveMapsLink) {
        try {
          const secondary = await importWebsiteForOnboardingWithCloudflare({ url: listedWebsite }, { ...opts, deadlineMs: remainingBudget() });
          if (secondary.suggestions.serviceCatalog.services.length || secondary.suggestions.staffSuggestions.length || secondary.suggestions.policySuggestions.length) {
            suggestions = mergeSecondaryWebsiteSuggestions(suggestions, secondary.suggestions);
            secondaryScrapeWarnings.push(`Enriched services/pricing from the listed website ${listedWebsite}.`);
          }
        } catch {
          secondaryScrapeWarnings.push('Could not read the listed website for services/pricing; Google Places details were kept.');
        }
      }
    }

    const errorCode = googleMapsErrorCode(sourceType, googlePlaces);
    return {
      ok: suggestions.status !== 'failed' && !errorCode,
      suggestions,
      diagnostics: {
        selectedPages,
        skippedPagesSummary: ['Platform/social URLs are not recursively crawled.'],
        sitemapSourcesFound: [],
        serviceHubPagesFound: [],
        childServicePagesFound: [],
        confidenceSummary: { services: suggestions.serviceCatalog.confidence },
        warnings: [...suggestions.warnings, ...secondaryScrapeWarnings],
        fallbackUsed: fallbackUsed.length ? fallbackUsed : ['static_homepage'],
      },
      logoUrl: null,
      errorCode,
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
      const readableCrawlPages = crawl.pages
        .filter((page) => !isLikelyStaticAssetUrl(page.url))
        .map((page) => ({ page, preview: pagePreviewFromCrawlPage(page) }))
        .filter(({ preview }) => !looksLikeEmptyOrNotFoundPage(preview.firstTextChars || preview.h1 || preview.title));
      const droppedCrawlPages = crawl.pages.length - readableCrawlPages.length;
      if (droppedCrawlPages > 0) warnings.push(`Dropped ${droppedCrawlPages} Cloudflare crawl page(s) that looked like assets or server error pages.`);
      finalPreviews = readableCrawlPages.map(({ preview }) => preview);
      selectedPages = diagnosticsFromCrawlPages(readableCrawlPages.map(({ page }) => page));
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

    const afterAugmentCandidates = seedCandidates(startUrl, finalPreviews, sitemap.candidates);
    const desiredChildPages = Math.min(opts.maxChildServicePages ?? 6, maxPages);
    const existingChildPages = countPreviewsInBucket(finalPreviews, startUrl, afterAugmentCandidates, 'service_child');
    const missingChildSlots = desiredChildPages - existingChildPages;
    if (missingChildSlots > 0 && sitemap.candidates.length && remainingBudget() > 2_000) {
      const rescueTargets = selectMissingSitemapBucketCandidates(sitemap.candidates, finalPreviews, 'service_child', missingChildSlots);
      const rescued = await addSpecificCandidatePreviews(finalPreviews, rescueTargets, fetchOpts, renderConfig, remainingBudget, {
        concurrency: Math.min(concurrency, 4),
        forceRender: fallbackUsed.includes('cloudflare_crawl'),
      });
      finalPreviews = rescued.previews;
      if (rescued.renderedCount > 0) fallbackUsed.push('headless_render');
    }

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
  const llmWantsToRun = Boolean(opts.llmEnabled && opts.openAiApiKey) && budgetForEnrichment >= MIN_LLM_BUDGET_MS;
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
        debugLog: opts.debugLog,
      },
    ),
  ]);
  const finalGooglePlaces = googlePlacesResult.status === 'fulfilled' ? googlePlacesResult.value : googlePlaces;
  let llmExtraction = llmResult.status === 'fulfilled' ? llmResult.value : null;
  let llmHardFallbackGloballyCapped = false;
  const difficultFallbackModelForFullImport = opts.difficultFallbackModel?.trim() || DEFAULT_WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL;
  if (
    llmWantsToRun
    && runLlm
    && !llmExtraction
    && difficultFallbackModelForFullImport
    && difficultFallbackModelForFullImport !== (opts.llmModel ?? '')
    && remainingBudget() >= MIN_LLM_BUDGET_MS
  ) {
    let runLlmHardFallback = true;
    if (opts.acquireLlmBudget) {
      runLlmHardFallback = await opts.acquireLlmBudget().catch(() => false);
      llmHardFallbackGloballyCapped = !runLlmHardFallback;
    }
    if (runLlmHardFallback) {
      llmExtraction = await extractWebsiteImportWithLlm(
        { sourceUrl: startUrl.toString(), previews: finalPreviews, googlePlaces: null, selectedPages },
        {
          enabled: true,
          apiKey: opts.openAiApiKey,
          model: difficultFallbackModelForFullImport,
          maxTokens: opts.llmMaxTokens,
          fetcher: opts.fetcher,
          timeoutMs: Math.min(LLM_CALL_TIMEOUT_MS, remainingBudget()),
          debugLog: opts.debugLog,
        },
      );
      if (llmExtraction) fallbackUsed.push('llm_hard_fallback');
    }
  }
  const llmAttemptedButFailed = llmWantsToRun && runLlm && !llmExtraction;
  let suggestions = normalizeImportSuggestionsForReview(buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews, googlePlaces: finalGooglePlaces, llmExtraction }));
  const discoveredUrls = collectDiscoveredUrls(startUrl, finalPreviews, sitemap.candidates);
  // Service retry and policy retry are independent enrichment passes — one only touches the
  // serviceCatalog, the other only the policySuggestions. Both read this enriched snapshot and
  // return their own slice + warnings, then run concurrently (each is a separate fetch+LLM round
  // costing 20–45s) so a hard site pays the slower of the two instead of their sum. Results are
  // merged back deterministically below.
  const enrichedSuggestions = suggestions;
  const retrySelectedPageInfos = selectedServiceRetryPageInfos(finalPreviews, selectedPages);
  const serviceRetryDetection = detectLowServiceCoverage({
    suggestions: enrichedSuggestions,
    selectedPages: retrySelectedPageInfos,
    discoveredUrls,
    warnings: [...enrichedSuggestions.warnings, ...warnings],
    minServiceCount: opts.serviceRetryMinServiceCount,
  });
  const serviceRetryDiagnostics = {
    enabled: Boolean(opts.serviceRetryEnabled),
    triggered: false,
    reasons: serviceRetryDetection.reasons,
    pagesCount: 0,
    pageUrls: [] as string[],
    servicesBefore: serviceRetryDetection.servicesCount,
    servicesAfter: serviceRetryDetection.servicesCount,
    improved: false,
  };
  let serviceRetryGloballyCapped = false;
  let difficultFallbackGloballyCapped = false;
  const policySelectedPageInfos = selectedPolicyRetryPageInfos(finalPreviews, selectedPages);
  const policyRetryDetection = detectLowPolicyCoverage({
    suggestions: enrichedSuggestions,
    selectedPages: policySelectedPageInfos,
    discoveredUrls,
    warnings: [...enrichedSuggestions.warnings, ...warnings],
    minPolicyCount: opts.policyRetryMinPolicyCount,
  });
  const policyRetryDiagnostics = {
    enabled: Boolean(opts.policyRetryEnabled),
    triggered: false,
    reasons: policyRetryDetection.reasons,
    pagesCount: 0,
    pageUrls: [] as string[],
    policiesBefore: policyRetryDetection.policiesCount,
    policiesAfter: policyRetryDetection.policiesCount,
    improved: false,
    fallbackUsed: false,
  };
  let policyRetryGloballyCapped = false;
  let policyRetryFallbackGloballyCapped = false;

  const runServiceRetryPass = async (): Promise<{ merged: ImportSuggestions | null; extraWarnings: string[] }> => {
    if (!(
      opts.serviceRetryEnabled
      && opts.llmEnabled
      && opts.openAiApiKey
      && serviceRetryDetection.shouldRetryServices
      && remainingBudget() >= MIN_LLM_BUDGET_MS
    )) return { merged: null, extraWarnings: [] };
    serviceRetryDiagnostics.triggered = true;
    let runServiceRetry = true;
    if (opts.acquireLlmBudget) {
      runServiceRetry = await opts.acquireLlmBudget().catch(() => false);
      serviceRetryGloballyCapped = !runServiceRetry;
    }
    if (!runServiceRetry) return { merged: null, extraWarnings: [] };
    const retryPages = await collectServiceRetryPages({
      rootUrl: startUrl.toString(),
      selectedPages: finalPreviews.map((preview) => ({
        preview,
        bucket: selectedPages.find((page) => normalizedUrlKey(page.url) === normalizedUrlKey(preview.url))?.bucket,
      })),
      discoveredUrls,
      evidenceUrls: collectEvidenceUrls(enrichedSuggestions),
      maxPages: Math.max(1, Math.min(opts.serviceRetryMaxPages ?? 12, 24)),
      timeoutMs: Math.max(1_000, opts.serviceRetryTimeoutMs ?? 20_000),
      opts: fetchOpts,
      renderConfig,
      remainingBudget,
      debugSaveText: opts.debugSaveText,
    });
    const usableRetryPages = retryPages.filter((page) => page.textLength > 500 && !page.error);
    serviceRetryDiagnostics.pagesCount = usableRetryPages.length;
    serviceRetryDiagnostics.pageUrls = usableRetryPages.map((page) => page.url);
    if (!usableRetryPages.length) return { merged: null, extraWarnings: [] };
    const beforeCount = enrichedSuggestions.serviceCatalog.services.length;
    const runServiceRetryModel = (model: string | null | undefined) => extractServiceCatalogWithLlmRetry(
      {
        websiteUrl: startUrl.toString(),
        businessName: enrichedSuggestions.businessProfile.name.value,
        pages: usableRetryPages.map((page) => ({ url: page.url, title: page.title, text: page.text })),
        previousServicesCount: beforeCount,
        previousWarnings: [...enrichedSuggestions.warnings, ...warnings],
        model,
      },
      {
        enabled: true,
        apiKey: opts.openAiApiKey,
        model,
        maxTokens: opts.llmMaxTokens ? Math.max(opts.llmMaxTokens, 8000) : 8000,
        fetcher: opts.fetcher,
        timeoutMs: Math.min(Math.max(1_000, opts.serviceRetryTimeoutMs ?? 20_000), remainingBudget()),
        debugLog: opts.debugLog,
      },
    );
    const serviceRetryModel = opts.serviceRetryModel || opts.llmModel || undefined;
    const primaryRetryResult = await runServiceRetryModel(serviceRetryModel);
    let bestSuggestions = primaryRetryResult ? mergeServiceRetryIntoSuggestions(enrichedSuggestions, primaryRetryResult) : enrichedSuggestions;
    let bestAfterCount = bestSuggestions.serviceCatalog.services.length;
    let usedDifficultFallback = false;
    const stillHard = bestAfterCount <= beforeCount || (
      bestAfterCount < (opts.serviceRetryMinServiceCount ?? 15)
      && usableRetryPages.length >= 3
    );
    const difficultFallbackModel = opts.difficultFallbackModel?.trim() || DEFAULT_WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL;
    if (stillHard && difficultFallbackModel && difficultFallbackModel !== (serviceRetryModel ?? '') && remainingBudget() >= MIN_LLM_BUDGET_MS) {
      let runDifficultFallback = true;
      if (opts.acquireLlmBudget) {
        runDifficultFallback = await opts.acquireLlmBudget().catch(() => false);
        difficultFallbackGloballyCapped = !runDifficultFallback;
      }
      if (runDifficultFallback) {
        const hardRetryResult = await runServiceRetryModel(difficultFallbackModel);
        if (hardRetryResult) {
          const hardSuggestions = mergeServiceRetryIntoSuggestions(enrichedSuggestions, hardRetryResult);
          const hardAfterCount = hardSuggestions.serviceCatalog.services.length;
          if (hardAfterCount > bestAfterCount) {
            bestSuggestions = hardSuggestions;
            bestAfterCount = hardAfterCount;
            usedDifficultFallback = true;
          }
        }
      }
    }
    if (bestAfterCount > beforeCount) {
      serviceRetryDiagnostics.servicesAfter = bestAfterCount;
      serviceRetryDiagnostics.improved = true;
      fallbackUsed.push('service_retry');
      if (usedDifficultFallback) fallbackUsed.push('service_retry_hard_fallback');
      return { merged: bestSuggestions, extraWarnings: [] };
    }
    if (!primaryRetryResult) {
      return { merged: null, extraWarnings: ['Service retry failed validation; original serviceCatalog retained.'] };
    }
    return { merged: null, extraWarnings: [] };
  };

  const runPolicyRetryPass = async (): Promise<{ merged: ImportSuggestions | null; extraWarnings: string[] }> => {
    if (!(
      opts.policyRetryEnabled
      && opts.llmEnabled
      && opts.openAiApiKey
      && policyRetryDetection.shouldRetryPolicies
      && remainingBudget() >= MIN_LLM_BUDGET_MS
    )) return { merged: null, extraWarnings: [] };
    policyRetryDiagnostics.triggered = true;
    let runPolicyRetry = true;
    if (opts.acquireLlmBudget) {
      runPolicyRetry = await opts.acquireLlmBudget().catch(() => false);
      policyRetryGloballyCapped = !runPolicyRetry;
    }
    if (!runPolicyRetry) return { merged: null, extraWarnings: [] };
    const retryPages = await collectPolicyRetryPages({
      rootUrl: startUrl.toString(),
      selectedPages: finalPreviews.map((preview) => ({
        preview,
        bucket: selectedPages.find((page) => normalizedUrlKey(page.url) === normalizedUrlKey(preview.url))?.bucket,
      })),
      discoveredUrls,
      evidenceUrls: collectEvidenceUrls(enrichedSuggestions),
      maxPages: Math.max(1, Math.min(opts.policyRetryMaxPages ?? 8, 16)),
      timeoutMs: Math.max(1_000, opts.policyRetryTimeoutMs ?? 20_000),
      opts: fetchOpts,
      renderConfig,
      remainingBudget,
      debugSaveText: opts.debugSaveText,
    });
    const usableRetryPages = retryPages.filter((page) => page.textLength > 300 && !page.error);
    policyRetryDiagnostics.pagesCount = usableRetryPages.length;
    policyRetryDiagnostics.pageUrls = usableRetryPages.map((page) => page.url);
    if (!usableRetryPages.length) {
      return { merged: null, extraWarnings: ['Policy retry did not improve coverage; original policySuggestions retained.'] };
    }
    const beforeCount = enrichedSuggestions.policySuggestions.length;
    const runPolicyRetryModel = (model: string | null | undefined) => extractPoliciesWithLlmRetry(
      {
        websiteUrl: startUrl.toString(),
        businessName: enrichedSuggestions.businessProfile.name.value,
        pages: usableRetryPages.map((page) => ({ url: page.url, title: page.title, text: page.text })),
        previousPoliciesCount: beforeCount,
        previousWarnings: [...enrichedSuggestions.warnings, ...warnings],
        model,
      },
      {
        enabled: true,
        apiKey: opts.openAiApiKey,
        model,
        maxTokens: opts.llmMaxTokens ? Math.max(opts.llmMaxTokens, 5000) : 5000,
        fetcher: opts.fetcher,
        timeoutMs: Math.min(Math.max(1_000, opts.policyRetryTimeoutMs ?? 20_000), remainingBudget()),
        debugLog: opts.debugLog,
      },
    );
    const policyRetryModel = opts.policyRetryModel || opts.llmModel || undefined;
    const primaryRetryResult = await runPolicyRetryModel(policyRetryModel);
    let bestSuggestions = primaryRetryResult ? mergePolicyRetryIntoSuggestions(enrichedSuggestions, primaryRetryResult) : enrichedSuggestions;
    let bestAfterCount = bestSuggestions.policySuggestions.length;
    const stillHard = bestAfterCount <= beforeCount && policyRetryDetection.policyPageCount >= 1;
    const fallbackModel = opts.policyRetryFallbackModel?.trim() || DEFAULT_WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL;
    if (stillHard && fallbackModel && fallbackModel !== (policyRetryModel ?? '') && remainingBudget() >= MIN_LLM_BUDGET_MS) {
      let runFallback = true;
      if (opts.acquireLlmBudget) {
        runFallback = await opts.acquireLlmBudget().catch(() => false);
        policyRetryFallbackGloballyCapped = !runFallback;
      }
      if (runFallback) {
        const fallbackRetryResult = await runPolicyRetryModel(fallbackModel);
        policyRetryDiagnostics.fallbackUsed = true;
        if (fallbackRetryResult) {
          const fallbackSuggestions = mergePolicyRetryIntoSuggestions(enrichedSuggestions, fallbackRetryResult);
          const fallbackAfterCount = fallbackSuggestions.policySuggestions.length;
          if (fallbackAfterCount > bestAfterCount) {
            bestSuggestions = fallbackSuggestions;
            bestAfterCount = fallbackAfterCount;
          }
        }
      }
    }
    if (bestAfterCount > beforeCount) {
      policyRetryDiagnostics.policiesAfter = bestAfterCount;
      policyRetryDiagnostics.improved = true;
      fallbackUsed.push('policy_retry');
      if (policyRetryDiagnostics.fallbackUsed) fallbackUsed.push('policy_retry_hard_fallback');
      return { merged: bestSuggestions, extraWarnings: [] };
    }
    return {
      merged: null,
      extraWarnings: [primaryRetryResult ? 'Policy retry did not improve coverage; original policySuggestions retained.' : 'Policy retry failed validation; original policySuggestions retained.'],
    };
  };

  // Combine the two passes. They mutate disjoint field sets (service → serviceCatalog/alsoOffers;
  // policy → policySuggestions/faqSuggestions/bookingSetupSuggestions), so each improved slice can
  // be taken independently; warnings are unioned and completeness is recomputed by the final
  // normalize. When neither pass changed anything (and added no warning), keep the already-normalized
  // enriched suggestions untouched.
  const [serviceRetryOutcome, policyRetryOutcome] = await Promise.all([runServiceRetryPass(), runPolicyRetryPass()]);
  let mergedSuggestions = enrichedSuggestions;
  const mergedWarnings = new Set(enrichedSuggestions.warnings);
  if (serviceRetryOutcome.merged) {
    mergedSuggestions = {
      ...mergedSuggestions,
      serviceCatalog: serviceRetryOutcome.merged.serviceCatalog,
      alsoOffers: serviceRetryOutcome.merged.alsoOffers,
    };
    serviceRetryOutcome.merged.warnings.forEach((warning) => mergedWarnings.add(warning));
  }
  if (policyRetryOutcome.merged) {
    mergedSuggestions = {
      ...mergedSuggestions,
      policySuggestions: policyRetryOutcome.merged.policySuggestions,
      faqSuggestions: policyRetryOutcome.merged.faqSuggestions,
      bookingSetupSuggestions: policyRetryOutcome.merged.bookingSetupSuggestions,
    };
    policyRetryOutcome.merged.warnings.forEach((warning) => mergedWarnings.add(warning));
  }
  for (const warning of [...serviceRetryOutcome.extraWarnings, ...policyRetryOutcome.extraWarnings]) mergedWarnings.add(warning);
  if (mergedSuggestions !== enrichedSuggestions || mergedWarnings.size !== enrichedSuggestions.warnings.length) {
    suggestions = normalizeImportSuggestionsForReview({
      ...mergedSuggestions,
      warnings: [...mergedWarnings],
    });
  }
  if (opts.debugLog) {
    console.info('[website-import-service-retry]', {
      serviceRetryEnabled: serviceRetryDiagnostics.enabled,
      serviceRetryTriggered: serviceRetryDiagnostics.triggered,
      serviceRetryReasons: serviceRetryDiagnostics.reasons,
      serviceRetryPagesCount: serviceRetryDiagnostics.pagesCount,
      serviceRetryPageUrls: serviceRetryDiagnostics.pageUrls,
      serviceRetryServicesBefore: serviceRetryDiagnostics.servicesBefore,
      serviceRetryServicesAfter: serviceRetryDiagnostics.servicesAfter,
      serviceRetryImproved: serviceRetryDiagnostics.improved,
      finalServices: suggestions.serviceCatalog.services.length,
      finalCategories: suggestions.serviceCatalog.categories.length,
      finalWarnings: suggestions.warnings.length,
    });
    console.info('[website-import-policy-retry]', {
      policyRetryEnabled: policyRetryDiagnostics.enabled,
      policyRetryTriggered: policyRetryDiagnostics.triggered,
      policyRetryReasons: policyRetryDiagnostics.reasons,
      policyRetryPagesCount: policyRetryDiagnostics.pagesCount,
      policyRetryPageUrls: policyRetryDiagnostics.pageUrls,
      policyRetryPoliciesBefore: policyRetryDiagnostics.policiesBefore,
      policyRetryPoliciesAfter: policyRetryDiagnostics.policiesAfter,
      policyRetryImproved: policyRetryDiagnostics.improved,
      policyRetryFallbackUsed: policyRetryDiagnostics.fallbackUsed,
      finalPolicies: suggestions.policySuggestions.length,
      finalWarnings: suggestions.warnings.length,
    });
  }
  const servicePagesFound = selectedPages.filter((page) => page.bucket === 'service_hub' || page.bucket === 'service_child').map((page) => page.url);
  const childServicePagesFound = selectedPages.filter((page) => page.bucket === 'service_child').map((page) => page.url);
  const richestPageMarkdownLength = finalPreviews.reduce((max, page) => Math.max(max, page.markdown?.length ?? page.firstTextChars.length), 0);
  const menuExceededSinglePassBudget = richestPageMarkdownLength > LLM_TOP_PAGE_MARKDOWN_BUDGET;
  const allWarnings = [
    ...suggestions.warnings,
    ...warnings,
    ...(llmAttemptedButFailed ? ['AI enrichment failed or timed out; details came from static extraction. Please review carefully.'] : []),
    ...(llmGloballyCapped ? ['AI enrichment was skipped due to a temporary daily limit; details came from static extraction. Please review carefully.'] : []),
    ...(llmHardFallbackGloballyCapped ? ['AI hard fallback was skipped due to a temporary daily limit; details came from static extraction. Please review carefully.'] : []),
    ...(serviceRetryGloballyCapped ? ['Service retry was skipped due to a temporary daily limit; original serviceCatalog retained.'] : []),
    ...(difficultFallbackGloballyCapped ? ['Difficult service fallback was skipped due to a temporary daily limit; original serviceCatalog retained.'] : []),
    ...(policyRetryGloballyCapped ? ['Policy retry was skipped due to a temporary daily limit; original policySuggestions retained.'] : []),
    ...(policyRetryFallbackGloballyCapped ? ['Policy retry fallback was skipped due to a temporary daily limit; original policySuggestions retained.'] : []),
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
      serviceRetry: serviceRetryDiagnostics,
      policyRetry: policyRetryDiagnostics,
    },
    logoUrl,
  };
}

export async function importWebsiteForOnboarding(input: { url: string }, opts: ImportOptions = {}): Promise<WebsiteImportResult> {
  return importWebsiteForOnboardingWithCloudflare(input, opts);
}
