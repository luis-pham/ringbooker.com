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
      const response = await (opts.fetcher ?? fetch)(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'RingBookerBot/1.0 (+https://ringbooker.com)', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8' },
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
      if (!response.ok) return null;
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
    return { url: parsed.toString(), source, anchorText, pathTokens: parsed.pathname.split(/[\/\-_]+/).filter(Boolean), discoveredFrom };
  } catch {
    return null;
  }
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

  if (!shouldDeepCrawlSource(sourceType)) {
    const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: [homepagePreview], googlePlaces });
    if (!suggestions.bookingUrl.value) suggestions.bookingUrl = { value: startUrl.toString(), confidence: 0.75, source: 'Platform profile' };
    return {
      ok: suggestions.status !== 'failed',
      suggestions,
      diagnostics: { selectedPages: [{ url: homepage.url, bucket: 'homepage', score: 100, source: 'homepage', reason: 'Platform profile; deep crawl skipped' }], skippedPagesSummary: ['Platform/social URLs are not recursively crawled.'], sitemapSourcesFound: [], serviceHubPagesFound: [], childServicePagesFound: [], confidenceSummary: { services: suggestions.serviceCatalog.confidence }, warnings: suggestions.warnings, fallbackUsed: ['static'] },
    };
  }

  const candidates: CandidateUrl[] = [candidateFromUrl(homepage.url, 'homepage')!];
  for (const link of extractLinks(homepage.text, homepage.url)) {
    if (new URL(link.href).origin === startUrl.origin) {
      const candidate = candidateFromUrl(link.href, /contact|hours|location/i.test(link.text) ? 'footer' : 'nav', link.text, homepage.url);
      if (candidate) candidates.push(candidate);
    }
  }
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
  const finalPreviews = selectedPreviews.length ? selectedPreviews : [homepagePreview];
  if (!googlePlaces && sourceType === 'normal_website' && opts.googlePlacesApiKey) {
    const staticPreviewSuggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews });
    googlePlaces = await lookupGooglePlaces({
      url: startUrl,
      sourceType,
      hints: {
        name: staticPreviewSuggestions.businessProfile.name.value,
        phone: staticPreviewSuggestions.businessProfile.phone.value,
        address: staticPreviewSuggestions.businessProfile.address.value,
        website: staticPreviewSuggestions.businessProfile.website.value ?? startUrl.toString(),
      },
      apiKey: opts.googlePlacesApiKey,
      fetcher: opts.fetcher,
      timeoutMs: opts.timeoutMs,
    });
  }
  const llmExtraction = await extractWebsiteImportWithLlm(
    { sourceUrl: startUrl.toString(), previews: finalPreviews, googlePlaces, selectedPages: selected.map(toDiagnostic) },
    { enabled: opts.llmEnabled, apiKey: opts.openAiApiKey, model: opts.llmModel, maxTokens: opts.llmMaxTokens, fetcher: opts.fetcher, timeoutMs: opts.timeoutMs },
  );
  const suggestions = buildSuggestions({ sourceUrl: startUrl.toString(), sourceType, previews: finalPreviews, googlePlaces, llmExtraction });
  const serviceHubPagesFound = selected.filter((s) => s.bucket === 'service_hub').map((s) => s.candidate.url);
  const childServicePagesFound = selected.filter((s) => s.bucket === 'service_child').map((s) => s.candidate.url);
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
      warnings: suggestions.warnings,
      fallbackUsed: ['static', ...(googlePlaces ? ['google_places'] : []), ...(llmExtraction ? ['llm'] : [])],
    },
  };
  return result;
}
