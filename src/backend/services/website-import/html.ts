import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { PagePreview } from './types';

export const SERVICE_KEYWORD_PATTERN = /\b(nail|manicure|pedicure|acrylic|gel|shellac|dip powder|nail art|hair|haircut|color|colour|lightening|tint|retouch|touch\s*-?\s*up|highlights|balayage|blowout|keratin|spa|massage|facial|waxing|wax|brow|eyebrow|lashes|lash|makeup|threading|microblading|botox|filler|injectable|laser|skin|hydrafacial|peel|treatment|consultation)\b/gi;
const PRICE_PATTERN = /(?:\bfrom\s+\$?\d{2,4}|\bstarting(?:\s+at)?\s+\$?\d{2,4}|\bstarts\s+at\s+\$?\d{2,4}|\$\s?\d{2,4}|\b\d{2,4}\s?(?:usd|dollars)\b)/gi;
const DURATION_PATTERN = /\b\d{1,3}\s?(?:min|mins|minute|minutes|hr|hour|hours)\+?(?=\s|$)/gi;
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

function cleanElementText(element: cheerio.Cheerio<AnyNode>): string {
  const clone = element.clone();
  clone.find('script,style,noscript,svg,img').remove();
  clone.find('br').replaceWith(' ');
  clone.find('h1,h2,h3,h4,h5,p,span,small,a,li,div,section,article').append(' ');
  return cleanBlockText(clone.text());
}

function firstPrice(value: string): string | null {
  PRICE_PATTERN.lastIndex = 0;
  return value.match(PRICE_PATTERN)?.[0] ?? null;
}

function firstDuration(value: string): string | null {
  DURATION_PATTERN.lastIndex = 0;
  return value.match(DURATION_PATTERN)?.[0] ?? null;
}

function stripDurationParts(value: string): string {
  return value
    .split(/\s*•\s*/)
    .map(cleanBlockText)
    .filter((part) => part && !firstDuration(part))
    .join(' • ');
}

function stripPriceAndDurationParts(value: string): string {
  return stripDurationParts(value)
    .split(/\s*•\s*/)
    .map((part) => cleanBlockText(part.replace(PRICE_PATTERN, '')))
    .filter(Boolean)
    .join(' • ');
}

function splitBlockNameDescription(value: string): { name: string; descriptionPrefix: string | null } {
  const cleaned = cleanBlockText(value);
  const lower = cleaned.toLowerCase();
  const starts = [
    'shampoo & condition',
    'shampoo and condition',
    'wash & style',
    'wash and style',
    'blow dry',
    'pricing is based',
    'involves',
    'r+co pro',
    '+ full head',
    '+full head',
  ]
    .map((needle) => ({ needle, index: lower.indexOf(needle) }))
    .filter((item) => item.index > 2)
    .sort((a, b) => a.index - b.index);
  const first = starts[0];
  if (!first) return { name: cleaned, descriptionPrefix: null };
  const descriptionPrefix = stripDurationParts(cleaned.slice(first.index).trim()).replace(/^\+\s*/, '').trim();
  return {
    name: cleaned.slice(0, first.index).trim(),
    descriptionPrefix: descriptionPrefix || null,
  };
}

function isLikelyServiceGroup(value: string): boolean {
  return /\b(blowout|color|lightening|cut|cuts|haircut|haircuts|cutting|styling|extensions?|treatments?|facials?|massage|waxing|nails?|manicure|pedicure|lashes|brows|makeup|injectables?|laser|skin|services?)\b/i.test(value)
    && value.length <= 80;
}

function isLikelyServiceName(value: string): boolean {
  if (!value || value.length < 3 || value.length > 120) return false;
  if (/^[a-z]\s+\w/.test(value)) return false;
  if (/^(home|services?|book|booking|contact|about|hours|pricing)$/i.test(value)) return false;
  return /\b(blow\s*out|blowout|color|lightening|tint|retouch|touch\s*-?\s*up|cut|haircut|style|package|scrub|treatment|extensions?|facial|massage|wax|manicure|pedicure|lash|brow|makeup|consult|balayage|highlights?|lowlights?|keratin|essential|signature|deluxe|curly|men'?s|women'?s|children'?s|up-?do)\b/i.test(value);
}

function isLikelySpecificServiceHeading(value: string): boolean {
  const cleaned = cleanBlockText(value);
  if (!cleaned || cleaned.length > 90) return false;
  if (/^(?:services?|service menu|menu|treatments?|haircuts?|color|styling|extensions?|facials?|massage|waxing|nails?)$/i.test(cleaned)) return false;
  return isLikelyServiceName(cleaned) && /\b(haircut|lightening|tint|retouch|blowout|blow\s*out|balayage|highlight|treatment|extension|facial|massage|wax|manicure|pedicure|lash|brow|package|consultation)\b/i.test(cleaned);
}

function looksLikeNonServiceBlock(value: string): boolean {
  if (/\b(cancellation|refund|privacy|terms|policy|policies|faq|frequently asked|address|directions|contact us|follow us|copyright|subscribe|newsletter|add to cart|cart|checkout)\b/i.test(value)) return true;
  if (/\?$/.test(value.trim()) && !firstPrice(value) && !firstDuration(value)) return true;
  return false;
}

function isEcommerceContext($: cheerio.CheerioAPI): boolean {
  const context = `${$('title').first().text()} ${$('h1').first().text()} ${$('h2').slice(0, 8).map((_, el) => $(el).text()).get().join(' ')} ${$('body').attr('class') ?? ''}`;
  const serviceContext = /\b(service menu|services?|salon services|hair services|treatments?)\b/i.test(context);
  return !serviceContext && /\b(shop|store|products?|collections?|cart|checkout|add to cart|retail|merch)\b/i.test(context);
}

function serviceSignalScore(value: string, repeatedSibling: boolean, groupHeading?: string | null): number {
  const text = cleanBlockText(value);
  if (!text || looksLikeNonServiceBlock(text)) return 0;
  const hasPrice = Boolean(firstPrice(text)) || /consultation required/i.test(text);
  const hasDuration = Boolean(firstDuration(text));
  SERVICE_KEYWORD_PATTERN.lastIndex = 0;
  const hasKeyword = SERVICE_KEYWORD_PATTERN.test(text);
  const hasBookingCta = /\b(book now|book online|schedule|reserve|appointment)\b/i.test(text);
  const titleLikeFirst = text.split(/[•|·\n]/).map(cleanBlockText).filter(Boolean)[0] ?? '';
  let score = 0;
  if (hasPrice) score += 32;
  if (hasDuration) score += 22;
  if (hasKeyword) score += 18;
  if (titleLikeFirst.length >= 3 && titleLikeFirst.length <= 70) score += 12;
  if (repeatedSibling) score += 14;
  if (groupHeading && isLikelyServiceGroup(groupHeading)) score += 10;
  if (hasBookingCta) score += 4;
  if (text.length > 500) score -= 28;
  if (text.length < 8) score -= 20;
  if (!hasPrice && !hasDuration && !hasKeyword) score -= 24;
  return Math.max(0, Math.min(100, score));
}

function nearestSectionHeading($: cheerio.CheerioAPI, element: cheerio.Cheerio<AnyNode>): string | null {
  let cursor = element.prevAll('h1,h2,h3,h4').first();
  if (cursor.length) return cleanElementText(cursor);
  let parent = element.parent();
  for (let depth = 0; parent.length && depth < 5; depth += 1) {
    cursor = parent.prevAll('h1,h2,h3,h4').first();
    if (cursor.length) return cleanElementText(cursor);
    const ownHeading = parent.children('h1,h2,h3,h4').first();
    if (ownHeading.length && !ownHeading.is(element)) return cleanElementText(ownHeading);
    parent = parent.parent();
  }
  const labelledBy = element.closest('[aria-labelledby]').attr('aria-labelledby');
  if (labelledBy) {
    const labelled = cleanBlockText($(`#${labelledBy}`).first().text());
    if (labelled) return labelled;
  }
  return null;
}

function candidateNameFromCard(element: cheerio.Cheerio<AnyNode>, rawText: string): string {
  const heading = cleanElementText(element.find('h2,h3,h4,h5,strong,b,[class*="title"],[class*="name"]').first());
  const candidate = heading || rawText
    .split(/\s*(?:\||•|·|\$|\bfrom\s+\$|\bstarting(?:\s+at)?\s+\$|\bstarts\s+at\s+\$)\s*/i)
    .map(cleanBlockText)
    .filter(Boolean)[0]
    || rawText;
  return splitBlockNameDescription(candidate).name.replace(/\b(book now|schedule|reserve|appointment)\b.*$/i, '').trim();
}

function descriptionFromCard(rawText: string, name: string, price: string | null, duration: string | null): string | null {
  let text = cleanBlockText(rawText);
  if (name) text = cleanBlockText(text.replace(name, ''));
  if (price) text = cleanBlockText(text.replace(price, ''));
  if (duration) text = cleanBlockText(text.replace(duration, ''));
  text = stripPriceAndDurationParts(text)
    .replace(/\b(book now|book online|schedule|reserve|appointment|consultation required)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length < 4 || text.toLowerCase() === name.toLowerCase()) return null;
  return text.slice(0, 400);
}

function repeatedCardServiceBlocks($: cheerio.CheerioAPI): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const seen = new Set<string>();
  const parents = $('main, body, section, article, div, ul, ol').toArray();
  for (const parentEl of parents) {
    const parent = $(parentEl);
    if (/\b(nav|footer|header|menu|social|policy|faq|contact)\b/i.test(parent.attr('class') ?? '') && !/service|menu|pricing|treatment/i.test(parent.text())) continue;
    const children = parent.children('div, article, li, section, .wp-block-column').toArray();
    if (children.length < 2 || children.length > 80) continue;
    const shapeCounts = new Map<string, number>();
    for (const childEl of children) {
      const child = $(childEl);
      const classTokens = (child.attr('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      const headingCount = child.find('h2,h3,h4,h5,strong,b').length;
      const paragraphCount = child.find('p,span,small').length;
      const tagName = 'tagName' in childEl ? String(childEl.tagName) : 'node';
      const shape = `${tagName}:${classTokens}:${headingCount}:${Math.min(paragraphCount, 4)}`;
      shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
    }
    for (const childEl of children) {
      const child = $(childEl);
      const rawText = cleanElementText(child);
      if (rawText.length < 8 || rawText.length > 2000) continue;
      if (child.find('h3,h4,h5').length > 1) continue;
      const classTokens = (child.attr('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      const headingCount = child.find('h2,h3,h4,h5,strong,b').length;
      const paragraphCount = child.find('p,span,small').length;
      const tagName = 'tagName' in childEl ? String(childEl.tagName) : 'node';
      const shape = `${tagName}:${classTokens}:${headingCount}:${Math.min(paragraphCount, 4)}`;
      const repeatedSibling = (shapeCounts.get(shape) ?? 0) >= 2;
      const heading = nearestSectionHeading($, child);
      const score = serviceSignalScore(rawText, repeatedSibling, heading);
      if (score < 48) continue;
      const tagNameForGate = 'tagName' in childEl ? String(childEl.tagName).toLowerCase() : '';
      if (tagNameForGate === 'li' && !firstPrice(rawText) && !firstDuration(rawText) && !/consultation required/i.test(rawText)) continue;
      const name = candidateNameFromCard(child, rawText);
      if (!isLikelyServiceName(name)) continue;
      const price = firstPrice(rawText) || (/consultation required/i.test(rawText) ? 'Consultation Required' : null);
      const duration = firstDuration(rawText);
      const description = descriptionFromCard(rawText, name, price, duration);
      const key = `${heading ?? ''}:${name}:${price ?? ''}:${duration ?? ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push({
        groupHeading: heading && isLikelyServiceGroup(heading) ? heading : null,
        serviceName: name,
        descriptionText: description,
        priceText: price,
        durationText: duration,
        sourceText: rawText.slice(0, 600),
        sourceHint: 'repeated_card',
        confidence: score >= 70 ? 0.84 : 0.64,
        evidenceSnippet: rawText.slice(0, 220),
      });
    }
  }
  return blocks.slice(0, 80);
}

function structuredServiceBlocks($: cheerio.CheerioAPI): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const ecommerceContext = isEcommerceContext($);
  const pushBlock = (block: ServiceBlock) => {
    if (ecommerceContext && block.sourceHint === 'repeated_card') return;
    const serviceName = cleanBlockText(block.serviceName);
    if (!isLikelyServiceName(serviceName)) return;
    const key = `${block.groupHeading ?? ''}:${serviceName}:${block.sourceText ?? ''}`.toLowerCase();
    if (blocks.some((existing) => `${existing.groupHeading ?? ''}:${existing.serviceName}:${existing.sourceText ?? ''}`.toLowerCase() === key)) return;
    blocks.push({ ...block, serviceName });
  };

  $('h2,h3').each((_, headingEl) => {
    const group = cleanBlockText($(headingEl).text());
    if (!isLikelyServiceGroup(group)) return;
    const rows: string[] = [];
    let cursor = $(headingEl).next();
    let scanned = 0;
    while (cursor.length && scanned < 10 && !/h2|h3/i.test(cursor.get(0)?.tagName ?? '')) {
      if (cursor.find('h3,h4,h5,.name,[class*="service-name"]').length > 0) {
        cursor = cursor.next();
        scanned += 1;
        continue;
      }
      const rawText = cleanElementText(cursor);
      if (rawText) rows.push(rawText);
      cursor = cursor.next();
      scanned += 1;
    }
    const text = rows.join(' ');
    if (!text || !/[►•\u2022]/.test(text)) return;
    for (const rawItem of text.split(/\s*(?:►|•|\u2022)\s*/).map(cleanBlockText).filter(Boolean)) {
      const serviceName = rawItem.replace(/\bBook Now\b.*$/i, '').trim();
      if (!isLikelyServiceName(serviceName)) continue;
      pushBlock({
        groupHeading: group,
        serviceName,
        descriptionText: null,
        priceText: null,
        durationText: null,
        sourceText: rawItem,
        sourceHint: 'service_menu_list',
        confidence: 0.66,
        evidenceSnippet: `${group}: ${serviceName}`.slice(0, 220),
      });
    }
  });

  $('.service-item, [class*="service-item"]').each((_, el) => {
    const item = $(el);
    const rawText = cleanBlockText(item.text());
    const rawName = cleanElementText(item.find('.name, [class*="service-name"], h3, h4').first());
    if (!rawName) return;
    const name = splitBlockNameDescription(rawName);
    const rawPrice = cleanBlockText(item.find('.price, [class*="service-price"]').first().text());
    const price = firstPrice(rawPrice) || firstPrice(rawText) || (/consultation required/i.test(rawText) ? 'Consultation Required' : null);
    const duration = firstDuration(rawText);
    const tabContent = item.closest('[id^="elementor-tab-content"], .elementor-tab-content');
    const labelledBy = tabContent.attr('aria-labelledby');
    const group = labelledBy ? cleanBlockText($(`#${labelledBy}`).first().text()) : cleanBlockText(item.prevAll('h2,h3').first().text());
    const rawDescription = cleanBlockText(item.find('p, .description, [class*="description"]').first().text());
    const fallbackDescription = !name.descriptionPrefix && rawDescription && rawDescription !== rawName
      ? stripDurationParts(rawDescription)
      : null;
    const description = [name.descriptionPrefix, fallbackDescription]
      .filter((part): part is string => Boolean(part))
      .join(' • ');
    pushBlock({ groupHeading: group || null, serviceName: name.name, descriptionText: description || null, priceText: price || null, durationText: duration, sourceText: rawText, sourceHint: 'semantic', confidence: 0.9, evidenceSnippet: rawText.slice(0, 220) });
  });

  $('h2,h3').each((_, headingEl) => {
    const group = cleanBlockText($(headingEl).text());
    if (!isLikelyServiceGroup(group)) return;
    if ((headingEl as { tagName?: string }).tagName?.toLowerCase() === 'h3' && isLikelySpecificServiceHeading(group)) return;
    let cursor = $(headingEl).next();
    let scanned = 0;
    while (cursor.length && scanned < 12 && !/h2|h3/i.test(cursor.get(0)?.tagName ?? '')) {
      const rawText = cleanBlockText(cursor.text());
      if (cursor.children().length >= 2 && cursor.find('h3,h4,h5,.name,[class*="service-name"]').length > 1) {
        cursor = cursor.next();
        scanned += 1;
        continue;
      }
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
        pushBlock({ groupHeading: group, serviceName, descriptionText: description || null, priceText: pricePart ?? firstPrice(detailText), durationText: durationPart ?? firstDuration(detailText), sourceText: rawText, sourceHint: 'heading_sibling', confidence: 0.82, evidenceSnippet: rawText.slice(0, 220) });
      }
      cursor = cursor.next();
      scanned += 1;
    }
  });

  for (const block of repeatedCardServiceBlocks($)) pushBlock(block);
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
