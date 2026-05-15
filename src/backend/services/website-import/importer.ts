import { preflightUrl, type DnsLookup } from './security';
import { detectImportSource, shouldDeepCrawlSource } from './source-routing';
import { extractLinks, previewHtml } from './html';
import { commonSitemapUrls, parseRobotsSitemaps, parseSitemapXml, prioritizeChildSitemaps, sitemapUrlsToCandidates } from './sitemap';
import { buildSuggestions } from './extract';
import { lookupGooglePlaces } from './google-places';
import { extractWebsiteImportWithLlm } from './llm';
import { classifyCandidate, selectPages, toDiagnostic } from './scoring';
import { renderHtml, type RenderConfig } from './render';
import type { CandidateUrl, PagePreview, WebsiteImportResult } from './types';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

type SiteBuilder = 'nextjs' | 'nuxtjs' | 'react_spa' | 'webflow' | 'wix' | 'squarespace' | 'shopify' | null;

function detectSiteBuilder(html: string): SiteBuilder {
  if (/<div[^>]+id=["']__next["']/i.test(html)) return 'nextjs';
  if (/<div[^>]+id=["']__nuxt["']/i.test(html)) return 'nuxtjs';
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
const DEFAULT_DEADLINE_MS = 25_000;
const DEFAULT_FETCH_CONCURRENCY = 6;
/** LLM needs at least this much remaining budget to be worth calling. */
const MIN_LLM_BUDGET_MS = 4_000;

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

async function fetchText(url: string, opts: ImportOptions): Promise<{ url: string; text: string } | null> {
  try {
    let current = (await preflightUrl(url, { lookup: opts.lookup })).toString();
    let redirectsFollowed = 0;
    // One retry shared across the whole fetch (covers a transient network error
    // OR a single rate-limit / 5xx response — whichever happens first).
    let retriesLeft = 1;
    while (true) {
      if (opts.deadline !== undefined && Date.now() >= opts.deadline) return null;
      const budgetMs = opts.deadline !== undefined ? opts.deadline - Date.now() : Number.POSITIVE_INFINITY;
      const perFetchTimeout = Math.min(opts.timeoutMs ?? 5000, budgetMs);
      if (perFetchTimeout <= 0) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), perFetchTimeout);
      try {
        let response: Response;
        try {
          response = await (opts.fetcher ?? fetch)(current, {
            redirect: 'manual',
            signal: controller.signal,
            headers: FETCH_HEADERS,
          });
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
  };
}

export async function importWebsiteForOnboarding(input: { url: string }, opts: ImportOptions = {}): Promise<WebsiteImportResult> {
  // Whole-import wall-clock budget. Every fetch clamps its timeout to the remaining
  // budget, so the import returns within ~deadlineMs even on slow/large sites.
  const deadline = Date.now() + (opts.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const fetchOpts: ImportOptions = { ...opts, deadline };
  const concurrency = Math.max(1, opts.fetchConcurrency ?? DEFAULT_FETCH_CONCURRENCY);
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
  let googlePlaces = sourceType === 'google_maps'
    ? await lookupGooglePlaces({ url: startUrl, sourceType, apiKey: opts.googlePlacesApiKey, fetcher: opts.fetcher, timeoutMs: Math.min(opts.timeoutMs ?? 5_000, remainingBudget()) })
    : null;
  const homepage = await fetchText(startUrl.toString(), fetchOpts);
  if (!homepage) {
    // The website is unreadable (down, slow, or blocking the crawler). For normal
    // websites, fall back to the Google Places business listing so a broken site
    // still yields name/phone/address/hours instead of an empty import.
    if (!googlePlaces && sourceType === 'normal_website' && opts.googlePlacesApiKey) {
      googlePlaces = await lookupGooglePlaces({
        url: startUrl,
        sourceType,
        hints: { website: startUrl.toString() },
        apiKey: opts.googlePlacesApiKey,
        fetcher: opts.fetcher,
        timeoutMs: Math.min(opts.timeoutMs ?? 5_000, remainingBudget()),
      }).catch(() => null);
    }
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
          warnings: [...suggestions.warnings, 'The website could not be read. Details came from the Google Places business listing — please review them.'],
          fallbackUsed: ['google_places'],
        },
      };
    }
    return emptyResult(startUrl.toString(), sourceType);
  }
  // Recover JS-rendered sites (Wix, SPAs, booking-platform profiles) through an
  // optional headless-render service. No-op when no render endpoint is configured.
  let homepageHtml = homepage.text;
  let renderUsed = false;
  const renderConfig: RenderConfig = { endpoint: opts.renderEndpoint ?? null, apiKey: opts.renderApiKey ?? null };
  const preRenderBuilder = detectSiteBuilder(homepageHtml);
  const shouldTryRender = Boolean(renderConfig.endpoint)
    && remainingBudget() > 3_000
    && ((hasThinContent(homepageHtml) && preRenderBuilder !== null) || !shouldDeepCrawlSource(sourceType));
  if (shouldTryRender) {
    const rendered = await renderHtml(homepage.url, renderConfig, { fetcher: opts.fetcher, timeoutMs: Math.min(12_000, remainingBudget()) });
    if (rendered && rendered.length > homepageHtml.length && !hasThinContent(rendered)) {
      homepageHtml = rendered;
      renderUsed = true;
    }
  }
  const homepagePreview = previewHtml(homepageHtml, homepage.url);
  const siteBuilder = detectSiteBuilder(homepageHtml);
  const thinHomepage = hasThinContent(homepageHtml);
  const spaWarning = siteBuilder && thinHomepage && !renderUsed
    ? `Site appears to be a JavaScript SPA (${siteBuilder}). Extracted content may be incomplete — configure a headless-render service (WEBSITE_IMPORT_RENDER_URL) for full extraction.`
    : null;
  // Thin content without a known SPA builder usually means an image-based site
  // (service menu shipped as images) or a custom JS-rendered site we cannot read.
  const thinContentWarning = !siteBuilder && thinHomepage
    ? 'The homepage has very little readable text — the site may be image-based or render content with JavaScript. Imported details may be incomplete; please review carefully.'
    : null;

  if (!shouldDeepCrawlSource(sourceType)) {
    const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: [homepagePreview], googlePlaces });
    if (!suggestions.bookingUrl.value) suggestions.bookingUrl = { value: startUrl.toString(), confidence: 0.75, source: 'Platform profile' };
    return {
      ok: suggestions.status !== 'failed',
      suggestions,
      diagnostics: { selectedPages: [{ url: homepage.url, bucket: 'homepage', score: 100, source: 'homepage', reason: 'Platform profile; deep crawl skipped' }], skippedPagesSummary: ['Platform/social URLs are not recursively crawled.'], sitemapSourcesFound: [], serviceHubPagesFound: [], childServicePagesFound: [], confidenceSummary: { services: suggestions.serviceCatalog.confidence }, warnings: suggestions.warnings, fallbackUsed: renderUsed ? ['headless_render'] : ['static'] },
    };
  }

  const rootUrl = `${startUrl.origin}/`;
  const candidates: CandidateUrl[] = [candidateFromUrl(homepage.url, 'homepage')!];
  if (new URL(homepage.url).pathname !== '/') {
    const rootCandidate = candidateFromUrl(rootUrl, 'nav', 'Home', homepage.url);
    if (rootCandidate) candidates.push(rootCandidate);
  }
  for (const link of extractLinks(homepageHtml, homepage.url)) {
    if (new URL(link.href).origin === startUrl.origin) {
      const candidate = candidateFromUrl(link.href, /contact|hours|location/i.test(link.text) ? 'footer' : 'nav', link.text, homepage.url);
      if (candidate) candidates.push(candidate);
    }
  }
  candidates.push(...commonServicePageCandidates(startUrl.origin, homepage.url));
  const sitemap = await discoverSitemapCandidates(startUrl.origin, fetchOpts, concurrency);
  candidates.push(...sitemap.candidates);

  const seen = new Map<string, CandidateUrl>();
  for (const candidate of candidates) if (!seen.has(candidate.url)) seen.set(candidate.url, candidate);
  const unique = [...seen.values()].slice(0, 200);

  const previewMap = new Map<string, PagePreview>([[homepage.url, homepagePreview]]);
  // Preview-fetch budget is 24 pages. Rank candidates by path/anchor relevance first
  // so the budget is spent on likely service/contact/staff pages instead of being
  // consumed by sitemap insertion order.
  const nonHomepage = unique.filter((c) => c.source !== 'homepage');
  const previewTargets = nonHomepage
    .map((candidate) => ({ candidate, score: classifyCandidate(candidate).score }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.candidate)
    .slice(0, 24);
  // Always preview the site root — salons routinely keep hours/contact in the footer.
  const rootCandidate = nonHomepage.find((c) => c.url === rootUrl);
  if (rootCandidate && !previewTargets.includes(rootCandidate)) previewTargets.push(rootCandidate);
  await mapPool(previewTargets, concurrency, async (candidate) => {
    const fetched = await fetchText(candidate.url, fetchOpts);
    if (fetched) {
      const preview = previewHtml(fetched.text, fetched.url);
      previewMap.set(candidate.url, preview);
      previewMap.set(fetched.url, preview);
    }
  });

  let scored = unique.map((candidate) => ({ candidate, ...classifyCandidate(candidate, previewMap.get(candidate.url)) }));
  let selected = selectPages(scored, opts.maxPages ?? 8);

  const childCandidates: CandidateUrl[] = [];
  for (const item of selected.filter((s) => s.bucket === 'service_hub').slice(0, 2)) {
    const preview = previewMap.get(item.candidate.url);
    if (!preview) continue;
    for (const link of preview.links.slice(0, 30)) {
      if (new URL(link.href).origin !== startUrl.origin) continue;
      const child = candidateFromUrl(link.href, 'service_hub_child', link.text, item.candidate.url);
      if (child) childCandidates.push(child);
    }
  }
  await mapPool(childCandidates.slice(0, opts.maxChildServicePages ?? 3), concurrency, async (child) => {
    if (!previewMap.has(child.url)) {
      const fetched = await fetchText(child.url, fetchOpts);
      if (fetched) {
        const preview = previewHtml(fetched.text, fetched.url);
        previewMap.set(child.url, preview);
        previewMap.set(fetched.url, preview);
      }
    }
    if (!unique.some((c) => c.url === child.url)) unique.push(child);
  });
  scored = unique.map((candidate) => ({ candidate, ...classifyCandidate(candidate, previewMap.get(candidate.url)) }));
  selected = selectPages(scored, opts.maxPages ?? 8);

  await mapPool(selected, concurrency, async (item) => {
    const existingPreview = previewMap.get(item.candidate.url);
    if (existingPreview && !(item.bucket === 'service_child' && existingPreview.priceCount === 0 && existingPreview.durationCount === 0)) return;
    const fetched = await fetchText(item.candidate.url, fetchOpts);
    if (fetched) {
      const preview = previewHtml(fetched.text, fetched.url);
      previewMap.set(item.candidate.url, preview);
      previewMap.set(fetched.url, preview);
    }
  });

  const selectedPreviews = selected.map((item) => previewMap.get(item.candidate.url)).filter((p): p is PagePreview => Boolean(p));
  const supplementalRootPreview = previewMap.get(rootUrl);
  const finalPreviewMap = new Map<string, PagePreview>();
  for (const preview of selectedPreviews.length ? selectedPreviews : [homepagePreview]) finalPreviewMap.set(preview.url, preview);
  if (supplementalRootPreview) finalPreviewMap.set(supplementalRootPreview.url, supplementalRootPreview);
  const finalPreviews = [...finalPreviewMap.values()];
  // Run Google Places lookup and LLM extraction in parallel to save ~500ms.
  // LLM receives googlePlaces: null here; the merged result is used in buildSuggestions below.
  // Both calls are clamped to the remaining import budget so the whole import stays within deadlineMs.
  const budgetForEnrichment = remainingBudget();
  const staticHints = (!googlePlaces && sourceType === 'normal_website' && opts.googlePlacesApiKey)
    ? buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews })
    : null;
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
      { sourceUrl: startUrl.toString(), previews: finalPreviews, googlePlaces: null, selectedPages: selected.map(toDiagnostic) },
      {
        // Skip the LLM entirely when there is not enough budget left for a useful call.
        enabled: opts.llmEnabled && budgetForEnrichment >= MIN_LLM_BUDGET_MS,
        apiKey: opts.openAiApiKey,
        model: opts.llmModel,
        maxTokens: opts.llmMaxTokens,
        fetcher: opts.fetcher,
        timeoutMs: Math.min(15_000, budgetForEnrichment),
      },
    ),
  ]);
  const finalGooglePlaces = googlePlacesResult.status === 'fulfilled' ? googlePlacesResult.value : googlePlaces;
  const llmExtraction = llmResult.status === 'fulfilled' ? llmResult.value : null;
  const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews, googlePlaces: finalGooglePlaces, llmExtraction });
  const serviceHubPagesFound = selected.filter((s) => s.bucket === 'service_hub').map((s) => s.candidate.url);
  const childServicePagesFound = selected.filter((s) => s.bucket === 'service_child').map((s) => s.candidate.url);
  const allWarnings = [
    ...suggestions.warnings,
    ...(spaWarning ? [spaWarning] : []),
    ...(thinContentWarning ? [thinContentWarning] : []),
    ...(siteBuilder && !spaWarning ? [`Site built with ${siteBuilder}. Content is server-rendered and should extract normally.`] : []),
  ];
  const result = {
    ok: suggestions.status !== 'failed',
    suggestions,
    diagnostics: {
      selectedPages: selected.map(toDiagnostic),
      skippedPagesSummary: [`${Math.max(0, unique.length - selected.length)} candidate pages were not selected by relevance/budget.`],
      sitemapSourcesFound: sitemap.sitemapSourcesFound,
      serviceHubPagesFound,
      childServicePagesFound,
      confidenceSummary: { services: suggestions.serviceCatalog.confidence, businessProfile: suggestions.businessProfile.name.confidence, contact: suggestions.businessProfile.phone.confidence, overall: suggestions.completeness?.overallConfidence ?? 0 },
      warnings: allWarnings,
      fallbackUsed: ['static', ...(renderUsed ? ['headless_render'] : []), ...(finalGooglePlaces ? ['google_places'] : []), ...(llmExtraction ? ['llm'] : [])],
    },
  };
  return result;
}
