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
  $('br').replaceWith('\n');
  $('td,th').append(' ');
  $('h1,h2,h3,h4,h5,h6,p,li,tr,table,section,article,div,footer,main').append('\n');
  return $('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Converts HTML to structure-preserving Markdown for the LLM extractor.
 *  - `<table>` → Markdown table rows: keeps cell/row boundaries. A flattened table
 *    mashes "<td>Lip</td><td>$25</td><td>Brow and Lip</td>" into "Lip $25 Brow and Lip";
 *    a Markdown table does not.
 *  - headings → `#` prefixes, `<li>` → `- ` bullets.
 *  - block elements → line breaks, so each service / `<div>` card sits on its own line.
 *  - inline elements → a space, so adjacent `<span>`s never mash ("Lip"+"$25" ≠ "Lip$25").
 * Structure only — it does not fix source-side typos (a website's "425+" stays "425+").
 */
export function htmlToStructuredMarkdown(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, img, iframe, head, template, link, meta').remove();
  $('br').replaceWith('\n');

  // Tables first — replace each with Markdown rows before later transforms strip <tr>/<td>.
  $('table').each((_, tableEl) => {
    const rows: string[] = [];
    $(tableEl)
      .find('tr')
      .each((_, trEl) => {
        const cells = $(trEl)
          .find('th, td')
          .map((_, cellEl) => $(cellEl).text().replace(/\s+/g, ' ').trim())
          .get();
        if (cells.some((cell) => cell.length > 0)) rows.push(`| ${cells.join(' | ')} |`);
      });
    if (rows.length === 0) {
      $(tableEl).remove();
      return;
    }
    const columnCount = Math.max(1, (rows[0].match(/\|/g)?.length ?? 2) - 1);
    const separator = `| ${Array.from({ length: columnCount }, () => '---').join(' | ')} |`;
    $(tableEl).replaceWith(`\n\n${rows[0]}\n${separator}\n${rows.slice(1).join('\n')}\n\n`);
  });

  // Headings → Markdown headings.
  for (let level = 1; level <= 6; level += 1) {
    $(`h${level}`).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      $(el).replaceWith(text ? `\n\n${'#'.repeat(level)} ${text}\n` : '\n');
    });
  }

  // List items → bullets.
  $('li').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    $(el).replaceWith(text ? `\n- ${text}` : '');
  });

  // Block elements → line breaks so each service / card lands on its own line.
  $('p, div, section, article, header, footer, main, ul, ol, dl, dd').append('\n');
  // Inline elements → a space so adjacent text never mashes.
  $('span, a, label, strong, b, em, i, small').append(' ');

  return $('body')
    .text()
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeJsonStringLiteral(value: string): string | null {
  try {
    const parsed = JSON.parse(`"${value}"`) as unknown;
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function embeddedBuilderTextFromHtml(html: string): string {
  const rows: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null) => {
    if (!value) return;
    const cleaned = value
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => cleanBlockText(line))
      .filter((line) =>
        line.length >= 2
        && !/^https?:\/\//i.test(line)
        && !/^\/(?:uploads|assets)\//i.test(line)
        && !/\.(?:jpe?g|png|gif|webp|svg)(?:\?|$)/i.test(line)
        && !/^[a-f0-9-]{20,}$/i.test(line)
        && !/^[\W_]+$/.test(line))
      .join('\n')
      .trim();
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(cleaned);
  };

  for (const match of html.matchAll(/"insert"\s*:\s*"((?:\\.|[^"\\])*)"/g)) {
    push(decodeJsonStringLiteral(match[1]));
  }
  return rows.join('\n');
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
  return /\b(blow\s*out|blowout|color|lightening|tint|retouch|touch\s*-?\s*up|cut|haircut|style|package|scrub|treatment|extensions?|hydrafacial|facial|massage|wax|manicure|pedicure|lash|brow|makeup|consult|balayage|highlights?|lowlights?|keratin|essential|signature|deluxe|curly|men'?s?|women'?s?|children'?s|up-?do|relaxing|therapeutic|reflexology|stone|body)\b/i.test(value);
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

function durationFromHeader(value: string): { label: string; minutes: number | null } | null {
  const text = cleanBlockText(value).toLowerCase();
  const min = text.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\+?\b/);
  if (min) return { label: `${Number(min[1])} min${/\+/.test(text) ? '+' : ''}`, minutes: Number(min[1]) };
  const hour = text.match(/\b(\d(?:\.\d)?)\s*(?:hr|hrs|hour|hours)\+?\b/);
  if (hour) {
    const minutes = Math.round(Number(hour[1]) * 60);
    return Number.isFinite(minutes) && minutes > 0 ? { label: `${minutes} min${/\+/.test(text) ? '+' : ''}`, minutes } : null;
  }
  return null;
}

function priceFromCell(value: string): { amount: number | null; type: 'fixed' | 'from' | 'varies' | 'consultation'; raw: string } | null {
  const text = cleanBlockText(value);
  if (!text || /^[-–—]+$/.test(text)) return null;
  if (/consultation/i.test(text)) return { amount: null, type: 'consultation', raw: text };
  if (/varies|call/i.test(text)) return { amount: null, type: 'varies', raw: text };
  const match = text.match(/\$?\s*(\d{1,5})(?:\.\d{1,2})?\s*\+?/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount > 2000) return null;
  return {
    amount,
    type: /from|starting|starts|\+/i.test(text) ? 'from' : 'fixed',
    raw: text,
  };
}

/** Handles simple 2-column name/price tables (no duration header required).
 *  Matches sites like Avalon Salon that use <table class="im-services …">
 *  with <td class="serv-title"> / <td class="serv-price"> rows. */
function simplePriceTableBlocks($: cheerio.CheerioAPI): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const seen = new Set<string>();
  $('table').each((_, tableEl) => {
    const table = $(tableEl);
    const tableClass = table.attr('class') ?? '';
    if (/service[_-]?levels/i.test(tableClass) || table.find('.serv-title,.serv-header,.serv-price').length > 0) return;
    const tableText = cleanElementText(table);
    if (!tableText || looksLikeNonServiceBlock(tableText) || isEcommerceContext($)) return;
    const rows = table.find('tr').toArray();
    if (rows.length < 2) return;
    // Collect 2-column data rows (skip colspan description/note rows)
    const dataRows = rows.filter((rowEl) => {
      const cells = $(rowEl).children('td').toArray();
      return cells.length === 2 && Number($(cells[0]).attr('colspan') ?? 1) <= 1;
    });
    if (dataRows.length < 1) return;
    // Second column must have at least one price value
    const hasPriceEvidence = dataRows.slice(0, 6).some((rowEl) => {
      const cells = $(rowEl).children('td').toArray();
      return Boolean(firstPrice(cleanElementText($(cells[1]))));
    });
    if (!hasPriceEvidence) return;
    // Defer to serviceMatrixTableBlocks when duration headers are present
    const allCellTexts = rows.flatMap((rowEl) =>
      $(rowEl).children('th,td').toArray().map((cellEl) => cleanElementText($(cellEl))),
    );
    if (allCellTexts.some((cell) => Boolean(durationFromHeader(cell)))) return;
    const group = nearestSectionHeading($, table)
      ?? cleanBlockText(table.prevAll('h1,h2,h3,h4').first().text());
    const groupHeading = group && isLikelyServiceGroup(group) ? group : null;
    for (const rowEl of rows) {
      const cells = $(rowEl).children('td').toArray();
      if (cells.length !== 2 || Number($(cells[0]).attr('colspan') ?? 1) > 1) continue;
      const nameText = cleanElementText($(cells[0]));
      const rawPrice = cleanElementText($(cells[1]));
      if (!nameText || nameText.length < 2 || nameText.length > 120) continue;
      if (looksLikeNonServiceBlock(nameText)) continue;
      const price = firstPrice(rawPrice) || (/consultation/i.test(rawPrice) ? 'Consultation Required' : null);
      const hasPlus = /\+/.test(rawPrice);
      const priceText = price
        ? (hasPlus && !price.includes('+') ? `${price}+` : price)
        : null;
      const name = splitBlockNameDescription(nameText).name
        .replace(/\b(book now|schedule|reserve|appointment)\b.*$/i, '').trim();
      if (name.length < 2) continue;
      const key = `${groupHeading ?? ''}:${name}:${priceText ?? ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      blocks.push({
        groupHeading,
        serviceName: name,
        descriptionText: null,
        priceText,
        durationText: null,
        sourceText: `${nameText} ${rawPrice}`.trim().slice(0, 600),
        sourceHint: 'simple_price_table',
        confidence: price ? 0.80 : 0.52,
        evidenceSnippet: `${nameText}: ${rawPrice}`.slice(0, 220),
      });
    }
  });
  return blocks.slice(0, 80);
}

function serviceLevelTableBlocks($: cheerio.CheerioAPI): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const seen = new Set<string>();
  const push = (block: ServiceBlock) => {
    const key = `${block.groupHeading ?? ''}:${block.serviceName}:${(block.variants ?? []).map((variant) => `${variant.label}:${variant.priceAmount}`).join('|')}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push(block);
  };
  $('table').each((_, tableEl) => {
    const table = $(tableEl);
    const tableClass = table.attr('class') ?? '';
    if (!/service[_-]?levels/i.test(tableClass) && table.find('.serv-title,.serv-header,.serv-price').length === 0) return;
    const tableText = cleanElementText(table);
    if (!tableText || looksLikeNonServiceBlock(tableText) || isEcommerceContext($)) return;
    const group = nearestSectionHeading($, table) ?? cleanBlockText(table.prevAll('h1,h2,h3').first().text());
    const groupHeading = group && isLikelyServiceGroup(group) ? group : null;

    let currentName: string | null = null;
    let variants: NonNullable<ServiceBlock['variants']> = [];
    const flushVertical = () => {
      if (!currentName || variants.length === 0) {
        currentName = null;
        variants = [];
        return;
      }
      const serviceName = splitBlockNameDescription(currentName).name.replace(/\s+/g, ' ').trim();
      if (isLikelyServiceName(serviceName) && !looksLikeNonServiceBlock(serviceName)) {
        const evidence = `${serviceName}: ${variants.map((variant) => `${variant.label} ${variant.priceAmount ?? variant.priceType}`).join(' | ')}`;
        push({
          groupHeading,
          serviceName,
          descriptionText: null,
          priceText: variants[0]?.priceAmount !== null && variants[0]?.priceAmount !== undefined ? `$${variants[0].priceAmount}` : null,
          durationText: variants[0]?.durationText ?? null,
          sourceText: evidence.slice(0, 600),
          sourceHint: 'service_matrix_table',
          confidence: 0.86,
          evidenceSnippet: evidence.slice(0, 220),
          variants,
        });
      }
      currentName = null;
      variants = [];
    };

    table.find('tr').each((_, rowEl) => {
      const cells = $(rowEl).children('th,td').toArray();
      if (cells.length === 0) return;
      const texts = cells.map((cellEl) => cleanElementText($(cellEl)));
      const first = $(cells[0]);
      if (first.hasClass('serv-title') || Number(first.attr('colspan') ?? 1) > 1 && texts[0] && !priceFromCell(texts[0])) {
        flushVertical();
        currentName = texts[0];
        return;
      }
      if (currentName && cells.length >= 2 && ($(cells[0]).hasClass('serv-header') || $(cells[1]).hasClass('serv-price'))) {
        const label = texts[0];
        const price = priceFromCell(texts[1]);
        const duration = durationFromHeader(label);
        if (label && price) {
          variants.push({
            label: duration?.label ?? label,
            durationMinutes: duration?.minutes ?? null,
            durationText: duration?.label ?? null,
            priceAmount: price.amount,
            priceCurrency: 'USD',
            priceType: price.type,
            sortOrder: variants.length,
            notes: null,
          });
        }
      }
    });
    flushVertical();

    const rowElements = table.find('tr').toArray();
    const rows = rowElements.map((rowEl) =>
      $(rowEl).children('th,td').toArray().map((cellEl) => cleanElementText($(cellEl))),
    );
    const headerIndex = rowElements.findIndex((rowEl) => $(rowEl).children('th').length >= 2);
    const header = headerIndex >= 0 ? rows[headerIndex] : undefined;
    if (!header || header.filter(Boolean).length < 2) return;
    for (const row of rows.slice(headerIndex + 1).filter((entry) => entry.filter(Boolean).length >= 2)) {
      const serviceName = splitBlockNameDescription(row[0] ?? '').name.replace(/\s+/g, ' ').trim();
      if (!isLikelyServiceName(serviceName) || looksLikeNonServiceBlock(serviceName)) continue;
      const rowVariants = header.slice(1).flatMap((label, index) => {
        const price = priceFromCell(row[index + 1] ?? '');
        if (!label || !price) return [];
        const duration = durationFromHeader(label);
        return [{
          label: duration?.label ?? label,
          durationMinutes: duration?.minutes ?? null,
          durationText: duration?.label ?? null,
          priceAmount: price.amount,
          priceCurrency: 'USD',
          priceType: price.type,
          sortOrder: index,
          notes: null,
        }];
      });
      if (rowVariants.length === 0) continue;
      const evidence = `${header.join(' | ')} / ${row.join(' | ')}`;
      push({
        groupHeading,
        serviceName,
        descriptionText: null,
        priceText: rowVariants[0]?.priceAmount !== null && rowVariants[0]?.priceAmount !== undefined ? `$${rowVariants[0].priceAmount}` : null,
        durationText: rowVariants[0]?.durationText ?? null,
        sourceText: evidence.slice(0, 600),
        sourceHint: 'service_matrix_table',
        confidence: 0.86,
        evidenceSnippet: evidence.slice(0, 220),
        variants: rowVariants,
      });
    }
  });
  return blocks.slice(0, 80);
}

function serviceMatrixTableBlocks($: cheerio.CheerioAPI): ServiceBlock[] {
  const blocks: ServiceBlock[] = [];
  const seen = new Set<string>();
  $('table').each((_, tableEl) => {
    const table = $(tableEl);
    const tableText = cleanElementText(table);
    if (!tableText || looksLikeNonServiceBlock(tableText) || isEcommerceContext($)) return;
    const rows = table.find('tr').toArray().map((rowEl) =>
      $(rowEl).children('th,td').toArray().map((cellEl) => cleanElementText($(cellEl))),
    ).filter((row) => row.filter(Boolean).length >= 2);
    if (rows.length < 2) return;

    let headerIndex = rows.findIndex((row) => row.slice(1).filter((cell) => durationFromHeader(cell)).length >= 1);
    if (headerIndex < 0) headerIndex = 0;
    const headers = rows[headerIndex] ?? [];
    const durationHeaders = headers.map((cell, index) => ({ index, duration: durationFromHeader(cell) })).filter((item) => item.index > 0 && item.duration);
    if (durationHeaders.length === 0) return;
    const group = nearestSectionHeading($, table) ?? cleanBlockText(table.prevAll('h1,h2,h3').first().text());
    const groupHeading = group && isLikelyServiceGroup(group) ? group : null;
    for (const row of rows.slice(headerIndex + 1)) {
      const serviceName = splitBlockNameDescription(row[0] ?? '').name.replace(/\s+/g, ' ').trim();
      if (!isLikelyServiceName(serviceName) || looksLikeNonServiceBlock(serviceName)) continue;
      const variants = durationHeaders.flatMap((item, variantIndex) => {
        const price = priceFromCell(row[item.index] ?? '');
        if (!price || !item.duration) return [];
        return [{
          label: item.duration.label,
          durationMinutes: item.duration.minutes,
          durationText: item.duration.label,
          priceAmount: price.amount,
          priceCurrency: 'USD',
          priceType: price.type,
          sortOrder: variantIndex,
          notes: null,
        }];
      });
      if (variants.length === 0) continue;
      const key = `${groupHeading ?? ''}:${serviceName}:${variants.map((variant) => `${variant.label}:${variant.priceAmount}`).join('|')}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const evidence = `${headers.join(' | ')} / ${row.join(' | ')}`;
      blocks.push({
        groupHeading,
        serviceName,
        descriptionText: null,
        priceText: variants[0]?.priceAmount !== null && variants[0]?.priceAmount !== undefined ? `$${variants[0].priceAmount}` : null,
        durationText: variants[0]?.durationText ?? null,
        sourceText: evidence.slice(0, 600),
        sourceHint: 'service_matrix_table',
        confidence: 0.86,
        evidenceSnippet: evidence.slice(0, 220),
        variants,
      });
    }
  });
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
      if (cursor.is('table')) {
        cursor = cursor.next();
        scanned += 1;
        continue;
      }
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

  for (const block of serviceLevelTableBlocks($)) pushBlock(block);
  for (const block of simplePriceTableBlocks($)) pushBlock(block);
  for (const block of serviceMatrixTableBlocks($)) pushBlock(block);
  for (const block of repeatedCardServiceBlocks($)) pushBlock(block);
  return blocks.slice(0, 80);
}

function cleanStaffText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function looksLikePersonName(value: string): boolean {
  const cleaned = cleanStaffText(value);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 60) return false;
  const compact = cleaned.replace(/\s+/g, '').toLowerCase();
  if (/^(?:previous|next|previousnext|nextprevious|prev|back|close|open|menu|learnmore|readmore|viewall|loadmore)$/.test(compact)) return false;
  if (/^(?:team|staff|meet|our)\s+/i.test(cleaned)) return false;
  if (/\d|@|#|\/|\$/.test(cleaned)) return false;
  if (/^(home|services?|artists?|team|staff|contact|contact information|book|booking|online booking|hours|about|policies?|policy|faq)$/i.test(cleaned)) return false;
  if (/^(master|massage|licensed|certified|senior|lead|medical|hairstylist|stylist|colorist|artist|apprentice|junior|receptionist|director|specialist|expert|owner|manager)$/i.test(cleaned)) return false;
  if (/^(?:master\s+)?(?:colorist|hairstylist|stylist|artist|apprentice|junior\s+stylist|studio\s+director|tooth\s+gem\s+specialist|hair\s+replacement\s+specialist)$/i.test(cleaned)) return false;
  if (/\b(policy|policies|cancellation|deposit|specials?|offers?|faq|questions?|booking|available|hours)\b/i.test(cleaned)) return false;
  if (/\b(salon|spa|studio|clinic|business|services?)\b/i.test(cleaned)) return false;
  if (/\b(?:internal|server|error|forbidden|denied|unavailable|misconfiguration|webmaster|document)\b/i.test(cleaned)) return false;
  return /^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}$/.test(cleaned);
}

function splitTrailingStaffRole(value: string): { name: string; role: string | null } {
  const cleaned = cleanStaffText(value);
  const match = cleaned.match(/^(.+?)\s+((?:Hair\s+|Nail\s+|Lash\s+|Brow\s+|Makeup\s+)?(?:Stylist|Colorist|Artist|Provider|Technician|Injector|Esthetician|Barber|Owner|Manager|Director|Founder|Specialist|Therapist|Aesthetician|Nail\s+Tech|Master))$/i);
  if (!match) return { name: cleaned, role: null };
  const name = cleanStaffText(match[1]);
  const role = cleanStaffText(match[2]);
  return looksLikePersonName(name) ? { name, role } : { name: cleaned, role: null };
}

function structuredStaffText($: cheerio.CheerioAPI, url = ''): string {
  const title = cleanStaffText($('title').first().text());
  const h1 = cleanStaffText($('h1').first().text());
  const bodyClass = $('body').attr('class') ?? '';
  const allH2s = $('h2').map((_, el) => $(el).text()).get().join(' ');
  const hasStaffContext =
    /\b(artists?|staff|team|stylists?|providers?|technicians?)\b/i.test(bodyClass)
    || /\b(artists?|staff|team|stylists?|providers?|technicians?|meet\s+(?:our|the))\b/i.test(`${title} ${h1} ${allH2s}`)
    || /\/(about|team|staff|artists?|stylists?|providers?|our-?team|meet-?us)/i.test(url);
  if (!hasStaffContext) return '';

  const rows: string[] = [];
  const seen = new Set<string>();

  function pushStaffRow(name: string, role: string | null, bio: string) {
    const split = splitTrailingStaffRole(name);
    const finalName = split.name;
    const finalRole = role || split.role;
    if (!looksLikePersonName(finalName)) return;
    const key = finalName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(`STAFF_MEMBER: ${finalName}${finalRole ? ` | Role: ${finalRole}` : ''}${bio ? ` | Bio: ${bio}` : ''}`);
  }

  function bioFromContainer(container: cheerio.Cheerio<AnyNode>): string {
    return container.find('p').map((_, p) => cleanStaffText($(p).text())).get()
      .filter((t) => t && t.length > 3 && !/^online booking/i.test(t)).join(' ').slice(0, 500);
  }

  function roleFromContainer(container: cheerio.Cheerio<AnyNode>, nameEl: cheerio.Cheerio<AnyNode>): string | null {
    const roleText = container.find('[class*="role"],[class*="position"],[class*="subtitle"],small').not(nameEl).first().text().trim();
    return roleText && roleText.length < 80 && !looksLikePersonName(cleanStaffText(roleText)) ? roleText : null;
  }

  // Strategy 1: explicit team/staff card container classes
  $('[class*="team-member"],[class*="team_member"],[class*="staff-member"],[class*="staff_member"],[class*="artist-card"],[class*="stylist-card"],[class*="provider-card"],[class*="bio-card"]').each((_, el) => {
    const container = $(el);
    const nameEl = container.find('h2,h3,h4,h5,[class*="name"],[class*="title"]').first();
    const name = cleanStaffText(nameEl.text());
    if (!looksLikePersonName(name)) return;
    pushStaffRow(name, roleFromContainer(container, nameEl), bioFromContainer(container));
  });

  // Strategy 2: section heading like "Meet Our Team" → look for person names inside siblings
  $('h1,h2,h3').each((_, headingEl) => {
    if (!/\b(meet\s+(?:our|the)\s+)?(?:team|staff|artists?|stylists?|providers?|technicians?)\b/i.test($(headingEl).text())) return;
    let cursor = $(headingEl).next();
    let scanned = 0;
    while (cursor.length && scanned < 30) {
      const tag = (cursor.get(0)?.tagName ?? '').toLowerCase();
      if (/^h[12]$/.test(tag)) break;
      cursor.find('h3,h4,h5').each((_, nameEl) => {
        const name = cleanStaffText($(nameEl).text());
        if (!looksLikePersonName(name)) return;
        const wrapper = $(nameEl).closest('[class*="team"],[class*="staff"],[class*="artist"],[class*="member"],[class*="card"]');
        const container = wrapper.length ? wrapper : $(nameEl).parent();
        pushStaffRow(name, roleFromContainer(container, $(nameEl)), bioFromContainer(container));
      });
      cursor = cursor.next();
      scanned += 1;
    }
  });

  function roleAndBioFromSiblings(nameEl: cheerio.Cheerio<AnyNode>): { role: string | null; bio: string } {
    const level = Number((nameEl.get(0) as { tagName?: string } | undefined)?.tagName?.replace('h', '') ?? '6');
    const stopTags = Array.from({ length: Math.max(1, level) }, (_, i) => `h${i + 1}`).join(',');
    let cursor = nameEl.next();
    let role: string | null = null;
    const bioParts: string[] = [];
    let scanned = 0;
    while (cursor.length && scanned < 20) {
      if (cursor.is(stopTags)) break;
      const tag = (cursor.get(0)?.tagName ?? '').toLowerCase();
      const text = cleanStaffText(cursor.text());
      if (!text) {
        cursor = cursor.next();
        scanned += 1;
        continue;
      }
      if (!role && /^h[3-6]$/.test(tag) && text.length < 100 && !looksLikePersonName(text)) {
        role = text;
        cursor = cursor.next();
        scanned += 1;
        continue;
      }
      if (tag === 'p' || cursor.find('p').length) {
        const paragraphText = tag === 'p' ? text : cursor.find('p').map((_, p) => cleanStaffText($(p).text())).get().join(' ');
        if (paragraphText.length > 8 && !/^online booking/i.test(paragraphText)) bioParts.push(paragraphText);
      }
      cursor = cursor.next();
      scanned += 1;
    }
    return { role, bio: bioParts.join(' ').slice(0, 500) };
  }

  // Strategy 3: flat staff pages where each person is a heading followed by role/bio.
  $('h1,h2,h3,h4').each((_, el) => {
    const heading = cleanStaffText($(el).text());
    if (!looksLikePersonName(heading)) return;
    const wrapper = $(el).closest('.flexible-column-wrapper, .wp-block-column, .team-member, [class*="team"], [class*="staff"], [class*="artist"], [class*="member"], [class*="card"]');
    const container = wrapper.length ? wrapper : $(el).parent();
    const sibling = roleAndBioFromSiblings($(el));
    pushStaffRow(heading, roleFromContainer(container, $(el)) ?? sibling.role, sibling.bio || bioFromContainer(container));
  });

  return rows.join('\n');
}

function extractPolicyBlocks($: cheerio.CheerioAPI): Array<{ heading: string; content: string }> {
  const blocks: Array<{ heading: string; content: string }> = [];
  const seen = new Set<string>();
  const policyHeadingRe = /\b(cancell|no.?show|missed\s+appointment|deposit|booking\s+fee|late\s+arrival|walk.?in|refund|returns?|aftercare|before\s+your\s+appointment|appointment\s+prep|consultation\s+(?:required|policy)|our\s+polic|important\s+(?:info|notice)|please\s+(?:note|read)|etiquette|terms\s+(?:of|and|&)|card\s+on\s+file|credit\s+card|payment|processing\s+fee|service\s+charge|gift\s+(?:card|certificate)s?|guarantee|redo)\b/i;
  $('h2,h3,h4,h5').each((_, headingEl) => {
    const headingText = cleanBlockText($(headingEl).text());
    if (!headingText || headingText.length < 3 || headingText.length > 120) return;
    if (!policyHeadingRe.test(headingText)) return;
    const level = parseInt((headingEl as { tagName?: string }).tagName?.replace('h', '') ?? '6');
    const stopTags = Array.from({ length: level }, (_, i) => `h${i + 1}`).join(',');
    const parts: string[] = [];
    let cursor = $(headingEl).next();
    let scanned = 0;
    while (cursor.length && scanned < 20) {
      if (cursor.is(stopTags)) break;
      const text = cleanBlockText(cursor.text());
      if (text && text.length >= 5) parts.push(text);
      cursor = cursor.next();
      scanned += 1;
    }
    const content = parts.join(' ').slice(0, 1200);
    if (content.length < 15) return;
    const key = headingText.toLowerCase().slice(0, 40);
    if (seen.has(key)) return;
    seen.add(key);
    blocks.push({ heading: headingText, content });
  });
  return blocks;
}

/**
 * Priority: an <img> that looks like the site's own brand mark (class/id/alt containing
 * "logo", preferring one inside header/nav) beats the generic `og:image` share-card image,
 * which in turn beats the favicon — a header logo is far more often the actual brand mark
 * than either of those.
 */
function nodeLooksLikeLogo($: cheerio.CheerioAPI, node: cheerio.Cheerio<AnyNode>, src: string): boolean {
  // The <img> itself often carries no hint at all (theme markup like Themeco's
  // `<a class="x-brand img"><img src="logoAcme.jpg"></a>` puts "logo"/"brand" on the
  // filename or a wrapper element instead) — so check own attrs, the filename, and the
  // nearest few ancestor elements' class/id before giving up.
  const ownHaystack = `${node.attr('class') ?? ''} ${node.attr('id') ?? ''} ${node.attr('alt') ?? ''} ${src}`.toLowerCase();
  if (/logo/.test(ownHaystack)) return true;
  const ancestorHaystack = node.parents().slice(0, 3)
    .map((_, p) => `${$(p).attr('class') ?? ''} ${$(p).attr('id') ?? ''}`).get().join(' ').toLowerCase();
  return /logo/.test(ancestorHaystack);
}

function extractLogoUrl($: cheerio.CheerioAPI, url: string): string | null {
  const findLogoImgIn = (scope: cheerio.Cheerio<AnyNode>): string | null => {
    let found: string | null = null;
    scope.find('img').each((_, el) => {
      if (found) return;
      const node = $(el);
      const raw = node.attr('src') || node.attr('data-src') || node.attr('data-lazy-src');
      if (!raw || raw.startsWith('data:')) return;
      if (!nodeLooksLikeLogo($, node, raw)) return;
      found = absolutize(raw, url);
    });
    return found;
  };

  const headerLogo = findLogoImgIn($('header, nav'));
  if (headerLogo) return headerLogo;
  const anyLogo = findLogoImgIn($('body'));
  if (anyLogo) return anyLogo;

  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    const resolved = absolutize(ogImage, url);
    if (resolved) return resolved;
  }

  for (const selector of ['link[rel="apple-touch-icon"]', 'link[rel="shortcut icon"]', 'link[rel="icon"]']) {
    const raw = $(selector).first().attr('href');
    if (!raw) continue;
    const resolved = absolutize(raw, url);
    if (resolved) return resolved;
  }
  return null;
}

export function previewHtml(html: string, url: string): PagePreview {
  const $ = cheerio.load(html);
  const title = ($('title').first().text() || $('meta[property="og:title"]').attr('content') || '').trim();
  const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
  const h2s = $('h2').slice(0, 8).map((_, el) => $(el).text().replace(/\s+/g, ' ').trim()).get().filter(Boolean);
  const serviceBlocks = structuredServiceBlocks($);
  const structuredServices = structuredServiceText($);
  const structuredStaff = structuredStaffText($, url);
  const policyBlocks = extractPolicyBlocks($);
  const embeddedText = embeddedBuilderTextFromHtml(html);
  const text = [structuredServices, structuredStaff, visibleTextFromHtml(html), embeddedText].filter(Boolean).join('\n');
  const markdown = [htmlToStructuredMarkdown(html), embeddedText].filter(Boolean).join('\n\n');
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
    markdown: markdown.slice(0, 16000),
    serviceBlocks,
    priceCount,
    durationCount,
    serviceKeywordCount,
    internalServiceLikeLinkCount,
    links,
    jsonLd: extractJsonLd(html),
    policyBlocks,
    contentScore: Math.min(100, Math.floor(text.length / 80) + serviceKeywordCount * 3 + priceCount * 4 + durationCount * 2),
    logoUrl: extractLogoUrl($, url),
  };
}
