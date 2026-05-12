import type { CandidateUrl } from './types';

export function commonSitemapUrls(origin: string): string[] {
  return ['/sitemap.xml','/sitemap_index.xml','/sitemap-index.xml','/wp-sitemap.xml','/page-sitemap.xml','/pages-sitemap.xml','/post-sitemap.xml','/service-sitemap.xml','/services-sitemap.xml','/product-sitemap.xml','/location-sitemap.xml'].map((path) => `${origin}${path}`);
}

export function parseRobotsSitemaps(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.match(/^\s*Sitemap:\s*(\S+)/i)?.[1]).filter((url): url is string => Boolean(url));
}

export function parseSitemapXml(xml: string): { urls: Array<{ loc: string; lastmod?: string }>; childSitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
  const lastmods = [...xml.matchAll(/<lastmod>\s*([^<]+)\s*<\/lastmod>/gi)].map((m) => m[1].trim());
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  if (isIndex) return { urls: [], childSitemaps: locs };
  return { urls: locs.map((loc, index) => ({ loc, lastmod: lastmods[index] })), childSitemaps: [] };
}

export function prioritizeChildSitemaps(urls: string[], max = 5): string[] {
  return [...new Set(urls)]
    .filter((url) => !/image|video/i.test(url))
    .sort((a, b) => scoreChild(b) - scoreChild(a))
    .slice(0, max);
}

function scoreChild(url: string): number {
  let score = 0;
  if (/page|service|services|product|location/i.test(url)) score += 20;
  if (/post|blog|author|tag|category|image|video/i.test(url)) score -= 25;
  return score;
}

export function sitemapUrlsToCandidates(urls: Array<{ loc: string; lastmod?: string }>, sourceSitemap: string, origin: string, cap = 200): CandidateUrl[] {
  const out: CandidateUrl[] = [];
  const seen = new Set<string>();
  for (const entry of urls) {
    if (out.length >= cap) break;
    try {
      const url = new URL(entry.loc);
      if (url.origin !== origin) continue;
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) {
        const lower = key.toLowerCase();
        if (/^utm_/.test(lower) || ['fbclid', 'gclid', 'itemid', 'variantid', 'productid', 'sku'].includes(lower)) url.searchParams.delete(key);
      }
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push({ url: normalized, source: 'sitemap', sitemapLastmod: entry.lastmod, pathTokens: url.pathname.split(/[\/\-_]+/).filter(Boolean), discoveredFrom: sourceSitemap });
    } catch {
      // Ignore malformed sitemap entries.
    }
  }
  return out;
}
