import { preflightUrl, type DnsLookup } from './security';
import { detectImportSource, shouldDeepCrawlSource } from './source-routing';
import { extractLinks, previewHtml } from './html';
import { commonSitemapUrls, parseRobotsSitemaps, parseSitemapXml, prioritizeChildSitemaps, sitemapUrlsToCandidates } from './sitemap';
import { buildSuggestions } from './extract';
import { lookupGooglePlaces } from './google-places';
import { extractWebsiteImportWithLlm } from './llm';
import { classifyCandidate, selectPages, toDiagnostic } from './scoring';
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
};

export const DEFAULT_WEBSITE_IMPORT_MAX_BYTES = 1_500_000;

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

async function fetchText(url: string, opts: ImportOptions): Promise<{ url: string; text: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    let current = (await preflightUrl(url, { lookup: opts.lookup })).toString();
    let redirectsFollowed = 0;
    while (true) {
      const fetchHeaders = {
        'user-agent': 'RingBookerBot/1.0 (+https://ringbooker.com/bot)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
      };
      const response = await (opts.fetcher ?? fetch)(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: fetchHeaders,
      });
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
        if (response.status === 429) {
          await new Promise((res) => setTimeout(res, 1500));
          const retried = await (opts.fetcher ?? fetch)(current, { signal: controller.signal, headers: fetchHeaders }).catch(() => null);
          if (!retried?.ok) return null;
          const retryType = retried.headers.get('content-type') ?? '';
          if (retryType && !/html|xml|text|markdown/i.test(retryType)) return null;
          const retryRaw = await readResponseTextWithLimit(retried, opts.maxBytes ?? DEFAULT_WEBSITE_IMPORT_MAX_BYTES);
          return { url: finalUrl, text: retryRaw };
        }
        return null;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!/html|xml|text|markdown/i.test(contentType) && contentType) return null;
      const raw = await readResponseTextWithLimit(response, opts.maxBytes ?? DEFAULT_WEBSITE_IMPORT_MAX_BYTES);
      return { url: finalUrl, text: raw };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
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

async function discoverSitemapCandidates(origin: string, opts: ImportOptions) {
  const sitemapSourcesFound: string[] = [];
  const candidates: CandidateUrl[] = [];
  const robots = await fetchText(`${origin}/robots.txt`, opts);
  const sitemapUrls = new Set<string>(commonSitemapUrls(origin));
  if (robots?.text) parseRobotsSitemaps(robots.text).forEach((url) => sitemapUrls.add(url));
  for (const sitemapUrl of [...sitemapUrls].slice(0, 12)) {
    const sitemap = await fetchText(sitemapUrl, opts);
    if (!sitemap?.text) continue;
    sitemapSourcesFound.push(sitemapUrl);
    const parsed = parseSitemapXml(sitemap.text);
    for (const child of prioritizeChildSitemaps(parsed.childSitemaps, 5)) {
      const childText = await fetchText(child, opts);
      if (!childText?.text) continue;
      sitemapSourcesFound.push(child);
      candidates.push(...sitemapUrlsToCandidates(parseSitemapXml(childText.text).urls, child, origin, 200));
    }
    candidates.push(...sitemapUrlsToCandidates(parsed.urls, sitemapUrl, origin, 200));
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
    ? await lookupGooglePlaces({ url: startUrl, sourceType, apiKey: opts.googlePlacesApiKey, fetcher: opts.fetcher, timeoutMs: opts.timeoutMs })
    : null;
  const homepage = await fetchText(startUrl.toString(), opts);
  if (!homepage) {
    if (googlePlaces) {
      const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: [], googlePlaces });
      const result = {
        ok: suggestions.status !== 'failed',
        suggestions,
        diagnostics: { selectedPages: [], skippedPagesSummary: [], sitemapSourcesFound: [], serviceHubPagesFound: [], childServicePagesFound: [], confidenceSummary: { hours: suggestions.hours.confidence, contact: suggestions.businessProfile.phone.confidence }, warnings: suggestions.warnings, fallbackUsed: ['google_places'] },
      };
      return result;
    }
    return emptyResult(startUrl.toString(), sourceType);
  }
  const homepagePreview = previewHtml(homepage.text, homepage.url);
  const siteBuilder = detectSiteBuilder(homepage.text);
  const spaWarning = siteBuilder && hasThinContent(homepage.text)
    ? `Site appears to be a JavaScript SPA (${siteBuilder}). Extracted content may be incomplete — full extraction requires a headless browser.`
    : null;

  if (!shouldDeepCrawlSource(sourceType)) {
    const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: [homepagePreview], googlePlaces });
    if (!suggestions.bookingUrl.value) suggestions.bookingUrl = { value: startUrl.toString(), confidence: 0.75, source: 'Platform profile' };
    return {
      ok: suggestions.status !== 'failed',
      suggestions,
      diagnostics: { selectedPages: [{ url: homepage.url, bucket: 'homepage', score: 100, source: 'homepage', reason: 'Platform profile; deep crawl skipped' }], skippedPagesSummary: ['Platform/social URLs are not recursively crawled.'], sitemapSourcesFound: [], serviceHubPagesFound: [], childServicePagesFound: [], confidenceSummary: { services: suggestions.serviceCatalog.confidence }, warnings: suggestions.warnings, fallbackUsed: ['static'] },
    };
  }

  const rootUrl = `${startUrl.origin}/`;
  const candidates: CandidateUrl[] = [candidateFromUrl(homepage.url, 'homepage')!];
  if (new URL(homepage.url).pathname !== '/') {
    const rootCandidate = candidateFromUrl(rootUrl, 'nav', 'Home', homepage.url);
    if (rootCandidate) candidates.push(rootCandidate);
  }
  for (const link of extractLinks(homepage.text, homepage.url)) {
    if (new URL(link.href).origin === startUrl.origin) {
      const candidate = candidateFromUrl(link.href, /contact|hours|location/i.test(link.text) ? 'footer' : 'nav', link.text, homepage.url);
      if (candidate) candidates.push(candidate);
    }
  }
  candidates.push(...commonServicePageCandidates(startUrl.origin, homepage.url));
  const sitemap = await discoverSitemapCandidates(startUrl.origin, opts);
  candidates.push(...sitemap.candidates);

  const seen = new Map<string, CandidateUrl>();
  for (const candidate of candidates) if (!seen.has(candidate.url)) seen.set(candidate.url, candidate);
  const unique = [...seen.values()].slice(0, 200);

  const previewMap = new Map<string, PagePreview>([[homepage.url, homepagePreview]]);
  for (const candidate of unique.filter((c) => c.source !== 'homepage').slice(0, 24)) {
    const fetched = await fetchText(candidate.url, opts);
    if (fetched) {
      const preview = previewHtml(fetched.text, fetched.url);
      previewMap.set(candidate.url, preview);
      previewMap.set(fetched.url, preview);
    }
  }

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
  for (const child of childCandidates.slice(0, opts.maxChildServicePages ?? 3)) {
    if (!previewMap.has(child.url)) {
      const fetched = await fetchText(child.url, opts);
      if (fetched) {
        const preview = previewHtml(fetched.text, fetched.url);
        previewMap.set(child.url, preview);
        previewMap.set(fetched.url, preview);
      }
    }
    if (!unique.some((c) => c.url === child.url)) unique.push(child);
  }
  scored = unique.map((candidate) => ({ candidate, ...classifyCandidate(candidate, previewMap.get(candidate.url)) }));
  selected = selectPages(scored, opts.maxPages ?? 8);

  for (const item of selected) {
    const existingPreview = previewMap.get(item.candidate.url);
    if (existingPreview && !(item.bucket === 'service_child' && existingPreview.priceCount === 0 && existingPreview.durationCount === 0)) continue;
    const fetched = await fetchText(item.candidate.url, opts);
    if (fetched) {
      const preview = previewHtml(fetched.text, fetched.url);
      previewMap.set(item.candidate.url, preview);
      previewMap.set(fetched.url, preview);
    }
  }

  const selectedPreviews = selected.map((item) => previewMap.get(item.candidate.url)).filter((p): p is PagePreview => Boolean(p));
  const supplementalRootPreview = previewMap.get(rootUrl);
  const finalPreviewMap = new Map<string, PagePreview>();
  for (const preview of selectedPreviews.length ? selectedPreviews : [homepagePreview]) finalPreviewMap.set(preview.url, preview);
  if (supplementalRootPreview) finalPreviewMap.set(supplementalRootPreview.url, supplementalRootPreview);
  const finalPreviews = [...finalPreviewMap.values()];
  // Run Google Places lookup and LLM extraction in parallel to save ~500ms.
  // LLM receives googlePlaces: null here; the merged result is used in buildSuggestions below.
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
          timeoutMs: opts.timeoutMs,
        })
      : Promise.resolve(googlePlaces),
    extractWebsiteImportWithLlm(
      { sourceUrl: startUrl.toString(), previews: finalPreviews, googlePlaces: null, selectedPages: selected.map(toDiagnostic) },
      { enabled: opts.llmEnabled, apiKey: opts.openAiApiKey, model: opts.llmModel, maxTokens: opts.llmMaxTokens, fetcher: opts.fetcher, timeoutMs: opts.timeoutMs },
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
      fallbackUsed: ['static', ...(finalGooglePlaces ? ['google_places'] : []), ...(llmExtraction ? ['llm'] : [])],
    },
  };
  return result;
}
