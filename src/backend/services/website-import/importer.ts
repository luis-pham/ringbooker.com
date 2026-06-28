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
const DEFAULT_DEADLINE_MS = 55_000;
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
        const raw = await readResponseTextWithLimit(response, opts.maxBytes ?? DEFAULT_WEBSITE_IMPORT_MAX_BYTES);
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

function pagePreviewFromCrawlPage(page: CfCrawlPage): PagePreview {
  if (!page.markdown.trim() && page.html?.trim()) return previewHtml(page.html, page.url);
  const text = plainTextFromMarkdown(page.markdown);
  const h1 = markdownHeadings(page.markdown, 1)[0] ?? page.metadata.title ?? '';
  const h2s = markdownHeadings(page.markdown, 2);
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
    title: page.metadata.title ?? h1,
    h1,
    h2s,
    firstTextChars: text.slice(0, 12_000),
    markdown: page.markdown,
    priceCount,
    durationCount,
    serviceKeywordCount,
    internalServiceLikeLinkCount,
    links,
    jsonLd: [],
    contentScore: Math.min(100, Math.floor(text.length / 120) + priceCount * 8 + durationCount * 4 + serviceKeywordCount * 2),
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
  let googlePlaces = sourceType === 'google_maps'
    ? await lookupGooglePlaces({ url: startUrl, sourceType, apiKey: opts.googlePlacesApiKey, fetcher: opts.fetcher, timeoutMs: Math.min(opts.timeoutMs ?? 5_000, remainingBudget()) })
    : null;

  const useStaticHomepageFallback = async (reason: string) => {
    const homepage = await fetchText(startUrl.toString(), fetchOpts);
    if (!homepage) return false;
    const preview = previewHtml(homepage.text, homepage.url);
    finalPreviews = [preview];
    selectedPages = [{ url: homepage.url, bucket: 'homepage', score: 100, source: 'homepage', reason }];
    fallbackUsed.push('static_homepage');
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
      sitemapSourcesFound: [],
      serviceHubPagesFound: servicePagesFound,
      childServicePagesFound: [],
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
