import * as cheerio from 'cheerio';
import type { PagePreview } from './types';

export const SERVICE_KEYWORD_PATTERN = /\b(nail|manicure|pedicure|acrylic|gel|shellac|dip powder|nail art|hair|haircut|color|colour|highlights|balayage|blowout|keratin|spa|massage|facial|waxing|wax|brow|eyebrow|lashes|lash|makeup|threading|microblading|botox|filler|injectable|laser|skin|hydrafacial|peel|treatment|consultation)\b/gi;
const PRICE_PATTERN = /(?:\$\s?\d{2,4}|\b\d{2,4}\s?(?:usd|dollars)\b|\bfrom\s+\$?\d{2,4}|\bstarting at\s+\$?\d{2,4})/gi;
const DURATION_PATTERN = /\b\d{1,3}\s?(?:min|mins|minute|minutes|hr|hour|hours)\b/gi;
type ServiceBlock = NonNullable<PagePreview['serviceBlocks']>[number];

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

function structuredServiceText($: cheerio.CheerioAPI): string {
  const rows: string[] = [];
  $('.service-item, [class*="service-item"]').each((_, el) => {
    const item = $(el);
    const name = item.find('.name, [class*="service-name"], h3, h4').first().text().replace(/\s+/g, ' ').trim();
    const price = item.find('.price, [class*="service-price"]').first().text().replace(/\s+/g, ' ').trim();
    if (!name || !price) return;
    const tabContent = item.closest('[id^="elementor-tab-content"], .elementor-tab-content');
    const labelledBy = tabContent.attr('aria-labelledby');
    const group = labelledBy ? $(`#${labelledBy}`).first().text().replace(/\s+/g, ' ').trim() : '';
    rows.push([group, name, price].filter(Boolean).join(' '));
  });
  return rows.join('\n');
}

function cleanBlockText(value: string): string {
  return value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstPrice(value: string): string | null {
  PRICE_PATTERN.lastIndex = 0;
  return value.match(PRICE_PATTERN)?.[0] ?? null;
}

function firstDuration(value: string): string | null {
  DURATION_PATTERN.lastIndex = 0;
  return value.match(DURATION_PATTERN)?.[0] ?? null;
}

function isLikelyServiceGroup(value: string): boolean {
  return /\b(blowout|color|cut|cuts|haircut|styling|extensions?|treatments?|facials?|massage|waxing|nails?|manicure|pedicure|lashes|brows|makeup|injectables?|laser|skin|services?)\b/i.test(value)
    && value.length <= 80;
}

function isLikelyServiceName(value: string): boolean {
  if (!value || value.length < 3 || value.length > 120) return false;
  if (/^(home|services?|book|booking|contact|about|hours|pricing)$/i.test(value)) return false;
  return /\b(blowout|color|cut|haircut|style|treatment|extension|facial|massage|wax|manicure|pedicure|lash|brow|makeup|consult|balayage|highlight|keratin|essential|signature|deluxe)\b/i.test(value);
}

function structuredServiceBlocks($: cheerio.CheerioAPI): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const pushBlock = (block: ServiceBlock) => {
    const serviceName = cleanBlockText(block.serviceName);
    if (!isLikelyServiceName(serviceName)) return;
    const key = `${block.groupHeading ?? ''}:${serviceName}:${block.sourceText ?? ''}`.toLowerCase();
    if (blocks.some((existing) => `${existing.groupHeading ?? ''}:${existing.serviceName}:${existing.sourceText ?? ''}`.toLowerCase() === key)) return;
    blocks.push({ ...block, serviceName });
  };

  $('.service-item, [class*="service-item"]').each((_, el) => {
    const item = $(el);
    const rawText = cleanBlockText(item.text());
    const name = cleanBlockText(item.find('.name, [class*="service-name"], h3, h4').first().text());
    if (!name) return;
    const price = cleanBlockText(item.find('.price, [class*="service-price"]').first().text()) || firstPrice(rawText);
    const duration = firstDuration(rawText);
    const tabContent = item.closest('[id^="elementor-tab-content"], .elementor-tab-content');
    const labelledBy = tabContent.attr('aria-labelledby');
    const group = labelledBy ? cleanBlockText($(`#${labelledBy}`).first().text()) : cleanBlockText(item.prevAll('h2,h3').first().text());
    const description = cleanBlockText(item.find('p, .description, [class*="description"]').first().text());
    pushBlock({ groupHeading: group || null, serviceName: name, descriptionText: description || null, priceText: price || null, durationText: duration, sourceText: rawText });
  });

  $('h2,h3').each((_, headingEl) => {
    const group = cleanBlockText($(headingEl).text());
    if (!isLikelyServiceGroup(group)) return;
    let cursor = $(headingEl).next();
    let scanned = 0;
    while (cursor.length && scanned < 12 && !/h2|h3/i.test(cursor.get(0)?.tagName ?? '')) {
      const rawText = cleanBlockText(cursor.text());
      const childHeading = cleanBlockText(cursor.find('h3,h4,h5,.name,[class*="service-name"]').first().text());
      const detailText = childHeading
        ? cleanBlockText(cursor.clone().find('h3,h4,h5,.name,[class*="service-name"]').remove().end().text())
        : rawText;
      if (detailText.includes('•') || firstPrice(detailText) || firstDuration(detailText)) {
        const parts = detailText.split(/\s*•\s*/).map(cleanBlockText).filter(Boolean);
        const durationPart = parts.find((part) => Boolean(firstDuration(part)));
        const pricePart = parts.find((part) => Boolean(firstPrice(part)));
        const first = childHeading || parts[0] || rawText;
        const serviceName = first.replace(/\b(shampoo\s*&\s*condition|shampoo\s+and\s+condition|wash\s*&\s*style|wash\s+and\s+style|blow\s+dry|style\s+included)\b.*$/i, '').trim() || first;
        const description = (childHeading ? parts : parts.slice(1)).filter((part) => part !== durationPart && part !== pricePart).join(' • ');
        pushBlock({ groupHeading: group, serviceName, descriptionText: description || null, priceText: pricePart ?? firstPrice(detailText), durationText: durationPart ?? firstDuration(detailText), sourceText: rawText });
      }
      cursor = cursor.next();
      scanned += 1;
    }
  });

  return blocks.slice(0, 80);
}

function cleanStaffText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikePersonName(value: string): boolean {
  const cleaned = cleanStaffText(value);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 60) return false;
  if (/\d|@|#|\/|\$/.test(cleaned)) return false;
  if (/^(home|services?|artists?|team|staff|contact|book|booking|online booking|hours|about|policies?|policy|faq)$/i.test(cleaned)) return false;
  if (/\b(policy|policies|cancellation|deposit|specials?|offers?|faq|questions?|booking|available|hours)\b/i.test(cleaned)) return false;
  if (/\b(salon|spa|studio|clinic|business|services?)\b/i.test(cleaned)) return false;
  return /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}$/.test(cleaned);
}

function structuredStaffText($: cheerio.CheerioAPI): string {
  const title = cleanStaffText($('title').first().text());
  const h1 = cleanStaffText($('h1').first().text());
  const bodyClass = cleanStaffText($('body').attr('class') ?? '');
  const isDedicatedStaffPage = /\b(artists?|staff|team|stylists?|providers?|technicians?)\b/i.test(bodyClass)
    || /^\s*(artists?|staff|team|stylists?|providers?|technicians?)\b/i.test(title)
    || /^\s*(artists?|staff|team|stylists?|providers?|technicians?)\b/i.test(h1);
  if (!isDedicatedStaffPage) return '';
  const rows: string[] = [];
  $('h2,h3,h4').each((_, el) => {
    const heading = cleanStaffText($(el).text());
    if (!looksLikePersonName(heading)) return;
    const wrapper = $(el).closest('.flexible-column-wrapper, .wp-block-column, .team-member, [class*="team"], [class*="staff"], [class*="artist"]');
    const container = wrapper.length ? wrapper : $(el).parent();
    const bio = container
      .find('p')
      .map((__, p) => cleanStaffText($(p).text()))
      .get()
      .filter((text) => text && !/^online booking available$/i.test(text))
      .join(' ')
      .slice(0, 500);
    rows.push(`STAFF_MEMBER: ${heading}${bio ? ` | Bio: ${bio}` : ''}`);
  });
  return rows.join('\n');
}

export function previewHtml(html: string, url: string): PagePreview {
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || $('meta[property="og:title"]').attr('content') || '').trim();
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const h2s = $('h2').slice(0, 8).map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  const serviceBlocks = structuredServiceBlocks($);
  const structuredServices = structuredServiceText($);
  const structuredStaff = structuredStaffText($);
  const text = [structuredServices, structuredStaff, visibleTextFromHtml(html)].filter(Boolean).join('\n');
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
    serviceBlocks,
    priceCount,
    durationCount,
    serviceKeywordCount,
    internalServiceLikeLinkCount,
    links,
    jsonLd: extractJsonLd(html),
    contentScore: Math.min(100, Math.floor(text.length / 80) + serviceKeywordCount * 3 + priceCount * 4 + durationCount * 2),
  };
}
