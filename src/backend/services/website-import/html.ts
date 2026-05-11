import * as cheerio from 'cheerio';
import type { PagePreview } from './types';

export const SERVICE_KEYWORD_PATTERN = /\b(nail|manicure|pedicure|acrylic|gel|shellac|dip powder|nail art|hair|haircut|color|colour|highlights|balayage|blowout|keratin|spa|massage|facial|waxing|wax|brow|eyebrow|lashes|lash|makeup|threading|microblading|botox|filler|injectable|laser|skin|hydrafacial|peel|treatment|consultation)\b/gi;
const PRICE_PATTERN = /(?:\$\s?\d{2,4}|\b\d{2,4}\s?(?:usd|dollars)\b|\bfrom\s+\$?\d{2,4}|\bstarting at\s+\$?\d{2,4})/gi;
const DURATION_PATTERN = /\b\d{1,3}\s?(?:min|mins|minute|minutes|hr|hour|hours)\b/gi;

function absolutize(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

export function visibleTextFromHtml(html: string): string {
  const $ = cheerio.load(html);
  // Keep footer text because salons commonly place hours/contact details there.
  $('script, style, noscript, svg, img, nav').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

export function extractJsonLd(html: string): unknown[] {
  const $ = cheerio.load(html);
  const out: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // Ignore invalid site-provided JSON-LD.
    }
  });
  return out;
}

export function extractLinks(html: string, baseUrl: string): Array<{ href: string; text: string }> {
  const $ = cheerio.load(html);
  const origin = new URL(baseUrl).origin;
  const links: Array<{ href: string; text: string }> = [];
  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href') ?? '';
    const href = absolutize(raw, baseUrl);
    if (!href) return;
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    const sameOrigin = url.origin === origin;
    const bookingHost = /(vagaro|booksy|glossgenius|fresha|styleseat|square\.site|calendly|acuityscheduling)/i.test(host);
    if (!sameOrigin && !bookingHost) return;
    links.push({ href, text: $(el).text().replace(/\s+/g, ' ').trim().slice(0, 120) });
  });
  return links;
}

export function previewHtml(html: string, url: string): PagePreview {
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || $('meta[property="og:title"]').attr('content') || '').trim();
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const h2s = $('h2').slice(0, 8).map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  const text = visibleTextFromHtml(html);
  const links = extractLinks(html, url);
  const priceCount = (text.match(PRICE_PATTERN) ?? []).length;
  const durationCount = (text.match(DURATION_PATTERN) ?? []).length;
  const serviceKeywordCount = (text.match(SERVICE_KEYWORD_PATTERN) ?? []).length;
  const internalServiceLikeLinkCount = links.filter((link) => {
    SERVICE_KEYWORD_PATTERN.lastIndex = 0;
    return SERVICE_KEYWORD_PATTERN.test(link.text) || /service|menu|treatment|pricing/i.test(link.href + ' ' + link.text);
  }).length;
  SERVICE_KEYWORD_PATTERN.lastIndex = 0;
  return {
    url,
    title,
    h1,
    h2s,
    firstTextChars: text.slice(0, 8000),
    priceCount,
    durationCount,
    serviceKeywordCount,
    internalServiceLikeLinkCount,
    links,
    jsonLd: extractJsonLd(html),
    contentScore: Math.min(100, Math.floor(text.length / 80) + serviceKeywordCount * 3 + priceCount * 4 + durationCount * 2),
  };
}
