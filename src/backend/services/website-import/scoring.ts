import type { CandidateBucket, CandidateUrl, PagePreview, SelectedPageDiagnostic } from './types';

const SERVICE_WORDS = /\b(service|services|menu|pricing|price|treatment|treatments|salon|spa|beauty|hair|haircut|cut|cuts|style|styling|texture|extensions?|exten[st]ions?|color|balayage|manicure|pedicure|waxing|massage|facial|botox|laser|injectable|lashes|brow)\b/i;
const SPECIFIC_SERVICE = /\b(balayage|hydrafacial|botox|filler|gel manicure|deluxe pedicure|eyebrow wax|waxing|massage|facial|hair color|highlights|haircut|hair cut|cut and style|hair extensions?|brazilian blowout|bridal hair|make-?up|acrylic|dip powder|keratin|perm)\b/i;
const STAFF_WORDS = /\b(staff|team|stylist|stylists|providers|artists|technicians|experts|injectors|estheticians|barbers)\b/i;
const POLICY_WORDS = /\b(policy|policies|cancellation|no-show|no show|deposit|refund|terms|appointment|late|prep|aftercare)\b/i;
const FAQ_WORDS = /\b(faq|faqs|questions|help)\b/i;
const PROMO_WORDS = /\b(specials|promotions|offers|deals|membership|packages)\b/i;
const ECOMMERCE_WORDS = /\b(shop|store|product|products|collection|collections|cart|checkout|retail|merch|gift-card|gift cards|buy|add to cart)\b/i;
const EXACT_SERVICE_PATH = /(?:^|\/)(services?|service-menu|salon-services|hair-services|menu|treatments?)(?:\/|$)/i;
const EXACT_SERVICE_LABEL = /\b(services?|service menu|salon services|hair services|treatments?|menu)\b/i;
const SERVICE_CATEGORY_WORDS = /\b(hair|haircut|haircuts|cut|cuts|style|styling|blowout|blow-dry|color|colour|balayage|highlight|highlights|texture|extensions?|exten[st]ions?|keratin|perm|wax|waxing|lash|lashes|brow|brows|facial|facials|massage|spa|nail|nails|manicure|pedicure|botox|filler|injectable|injectables|laser|skin|scalp|conditioning|makeup|make-up)\b/i;
const COMPACT_SERVICE_CATEGORY_SLUG_RE = /(?:haircut|haircuts|cut|cuts|style|styling|blowout|blowdry|color|colour|balayage|highlight|highlights|texture|extension|extensions|extention|extentions|keratin|perm|wax|waxing|lash|lashes|brow|brows|facial|facials|massage|spa|nail|nails|manicure|pedicure|botox|filler|injectable|injectables|laser|skin|scalp|conditioning|treatment|treatments)/i;
const MENU_INTENT_WORDS = /\b(menu|menus|service|services|pricing|prices|price|treatment|treatments|therapy)\b/i;
const ARTICLE_PATH = /\/(?:f|blog|blogs|news|article|articles|post|posts|stories?|s\/stories)\//i;
const DATED_ARTICLE_PATH = /\/(?:19|20)\d{2}\/\d{1,2}\/\d{1,2}\//;
const SERVICE_AREA_PATH = /\/(?:contact-us\/)?service-areas?\/?$|\/areas-of-service\//i;
const TAXONOMY_ARCHIVE_PATH = /\/(?:service[_-]?type|service[_-]?categor(?:y|ies)|product[_-]?categor(?:y|ies)|portfolio[_-]?categor(?:y|ies)|tag|category)\//i;

function normalizeIntentText(value: string): string {
  return decodeURIComponent(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(hair|haircut|haircuts|nail|nails|facial|facials|wax|lash|lashes|brow|brows|massage|spa|color|colour|cut|cuts|makeup|skin)(menu|menus|services?|pricing|prices?|treatments?|therapy)\b/gi, '$1 $2')
    .replace(/\b(menu|menus|services?|pricing|prices?|treatments?|therapy)(hair|haircut|haircuts|nail|nails|facial|facials|wax|lash|lashes|brow|brows|massage|spa|color|colour|cut|cuts|makeup|skin)\b/gi, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasCategoryMenuIntent(value: string): boolean {
  return SERVICE_CATEGORY_WORDS.test(value) && MENU_INTENT_WORDS.test(value);
}

function hasCategorySlugIntent(pathSignal: string): boolean {
  let segments: string[];
  try {
    segments = new URL(pathSignal, 'https://example.test').pathname.split('/').filter(Boolean);
  } catch {
    segments = pathSignal.split('/').filter(Boolean);
  }
  const last = segments.at(-1);
  if (!last) return false;
  const normalized = normalizeIntentText(last);
  if (SERVICE_CATEGORY_WORDS.test(normalized)) return true;
  return COMPACT_SERVICE_CATEGORY_SLUG_RE.test(normalized.replace(/\s+/g, ''));
}

function servicePathIntent(pathSignal: string, labelSignal: string, articleIntent: boolean): { serviceMenu: boolean; categoryPage: boolean } {
  if (articleIntent) return { serviceMenu: false, categoryPage: false };
  const normalizedPath = normalizeIntentText(pathSignal);
  const normalizedLabel = normalizeIntentText(labelSignal);
  const pathHasCategoryMenu = hasCategoryMenuIntent(normalizedPath);
  const labelHasCategoryMenu = hasCategoryMenuIntent(normalizedLabel);
  const genericServiceMenu = EXACT_SERVICE_LABEL.test(normalizedPath)
    || EXACT_SERVICE_LABEL.test(normalizedLabel)
    || EXACT_SERVICE_PATH.test(pathSignal);
  return {
    serviceMenu: genericServiceMenu || pathHasCategoryMenu || labelHasCategoryMenu,
    categoryPage: pathHasCategoryMenu || (!genericServiceMenu && labelHasCategoryMenu),
  };
}

export function classifyCandidate(candidate: CandidateUrl, preview?: PagePreview): { bucket: CandidateBucket; score: number; reason: string } {
  const pathSignal = (() => {
    try { return new URL(candidate.url).pathname; } catch { return candidate.url; }
  })();
  const haystack = `${pathSignal} ${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''} ${preview?.h2s.join(' ') ?? ''}`.toLowerCase();
  let score = 0;
  let bucket: CandidateBucket = 'noise';
  const reasons: string[] = [];
  const staffContext = STAFF_WORDS.test(haystack) || /\/(?:meet[-_]?)?(?:the[-_]?|our[-_]?)?(?:team|staff|stylists?)/.test(haystack);
  const primaryPageSignal = `${pathSignal} ${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''}`.toLowerCase();
  const ecommerceIntent = ECOMMERCE_WORDS.test(haystack) || /\/(?:shop|store|products?|collections?|cart|checkout)(?:\/|$)/i.test(pathSignal) || /[?&](?:itemid|variantid|productid|sku)=/i.test(candidate.url);
  const articleIntent = ARTICLE_PATH.test(pathSignal) || DATED_ARTICLE_PATH.test(pathSignal) || TAXONOMY_ARCHIVE_PATH.test(pathSignal) || /\/(?:tag|category|author)(?:\/|$)/i.test(pathSignal);
  const serviceAreaIntent = SERVICE_AREA_PATH.test(pathSignal);
  const policyPageIntent = /\/(?:salon-)?polic(?:y|ies)\/?$|\/terms(?:\/|$)|\/faq\/?$/i.test(pathSignal);
  const exactStaffPath = /\/(?:about\/)?(?:meet[-_]?)?(?:the[-_]?|our[-_]?)?(?:team|staff|artists?|stylists?|providers?|technicians?)\/?$/i.test(pathSignal);
  const exactServiceHubPath = /\/(?:our-services|services|service-menu|salon-services)\/?$/i.test(pathSignal);
  const pathIntent = servicePathIntent(pathSignal, `${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''}`, articleIntent);
  const categorySlugIntent = !articleIntent && !serviceAreaIntent && !policyPageIntent && !exactStaffPath && hasCategorySlugIntent(pathSignal);
  const categorySlugConfirmed = categorySlugIntent && (!preview || preview.priceCount > 0 || preview.durationCount > 0 || preview.serviceKeywordCount >= 2 || (preview.serviceBlocks?.length ?? 0) > 0);
  const serviceIntent = !articleIntent && !serviceAreaIntent && !policyPageIntent && (
    EXACT_SERVICE_PATH.test(pathSignal)
    || EXACT_SERVICE_LABEL.test(`${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''}`)
    || pathIntent.serviceMenu
    || categorySlugConfirmed
  );
  const ecommercePageIntent = ecommerceIntent && !serviceIntent;

  if (!serviceIntent && /privacy|terms|login|cart|checkout|account/.test(haystack)) return { bucket: 'noise', score: -50, reason: 'Excluded utility page' };
  if (/blog|news|article|post|author|tag|category/.test(haystack)) { score -= 25; reasons.push('Blog/news deprioritized'); }
  if (serviceAreaIntent) { score -= 50; reasons.push('Service-area/geo page deprioritized'); }
  if (ecommercePageIntent) {
    bucket = 'ecommerce_product';
    score -= 35;
    reasons.push('Ecommerce/product page deprioritized');
  }

  const isHomepage = candidate.source === 'homepage';
  const isServiceHubChild = candidate.source === 'service_hub_child';
  if (isHomepage) { bucket = 'homepage'; score += 100; reasons.push('Homepage'); }
  if (/contact|hours|location|directions/.test(primaryPageSignal)) { bucket = 'contact_hours'; score += 28; reasons.push('Contact/hours signals'); }
  if (staffContext && !serviceAreaIntent) { if (bucket === 'noise' || exactStaffPath) bucket = 'staff_team'; score += exactStaffPath ? 65 : 20; reasons.push(exactStaffPath ? 'Exact staff page' : 'Staff/team signals'); }
  if (POLICY_WORDS.test(haystack)) { bucket = bucket === 'noise' ? 'policies' : bucket; score += 18; reasons.push('Policy signals'); }
  if (FAQ_WORDS.test(haystack)) { bucket = bucket === 'noise' ? 'faq' : bucket; score += 18; reasons.push('FAQ signals'); }
  if (PROMO_WORDS.test(haystack)) { bucket = bucket === 'noise' ? 'promotions' : bucket; score += 16; reasons.push('Promotion signals'); }
  if (/about|team|staff|artist|provider/.test(haystack)) { bucket = bucket === 'noise' ? 'about_team' : bucket; score += 12; reasons.push('About/team signals'); }
  if (/book|appointment|schedule|reserve/.test(haystack)) { bucket = isHomepage || staffContext || ecommercePageIntent ? bucket : 'booking'; score += ecommercePageIntent ? 4 : 22; reasons.push('Booking signals'); }

  if (!articleIntent && !serviceAreaIntent && !policyPageIntent && !staffContext && ((candidate.anchorText && SPECIFIC_SERVICE.test(candidate.anchorText)) || (preview && SPECIFIC_SERVICE.test(`${preview.title} ${preview.h1}`)))) {
    bucket = isHomepage || ecommercePageIntent ? bucket : 'service_child'; score += ecommercePageIntent ? 8 : 45; reasons.push('Specific service signal');
  }
  if (serviceIntent) {
    if (!isHomepage && (!staffContext || categorySlugConfirmed || pathIntent.categoryPage || isServiceHubChild)) {
      bucket = exactServiceHubPath ? 'service_hub' : (pathIntent.categoryPage || categorySlugConfirmed || isServiceHubChild) ? 'service_child' : bucket === 'service_child' ? bucket : 'service_hub';
    }
    score += exactServiceHubPath ? 90 : (pathIntent.categoryPage || categorySlugConfirmed) ? 70 : 60;
    reasons.push(exactServiceHubPath ? 'Exact services page' : (pathIntent.categoryPage || categorySlugConfirmed) ? 'Category service menu' : 'Explicit services page');
  } else if (!articleIntent && !serviceAreaIntent && !policyPageIntent && (/service|menu|pricing|treatment/.test(primaryPageSignal) || (preview && preview.priceCount > 0 && preview.internalServiceLikeLinkCount >= 2))) {
    bucket = bucket === 'service_child' || isHomepage || isServiceHubChild || staffContext || ecommercePageIntent ? bucket : 'service_hub'; score += ecommercePageIntent ? 6 : 35; reasons.push('Service hub/menu signal');
  }
  if (SERVICE_WORDS.test(haystack)) { score += 15; reasons.push('Service keyword'); }
  if (preview) {
    if (preview.serviceKeywordCount >= 4 && preview.priceCount > 0) { bucket = bucket === 'service_child' || isHomepage || isServiceHubChild || staffContext || ecommercePageIntent ? bucket : 'service_hub'; score += ecommercePageIntent ? 4 : 24; reasons.push('Service content with prices'); }
    if (preview.priceCount > 0) { score += ecommercePageIntent ? 0 : 8; reasons.push('Price pattern'); }
    if (preview.durationCount > 0) { score += ecommercePageIntent ? 0 : 5; reasons.push('Duration pattern'); }
    if (preview.contentScore < 5) { score -= 15; reasons.push('Weak content'); }
  }
  if (candidate.source === 'sitemap') { score += 8; reasons.push('Sitemap candidate'); }
  if (candidate.source === 'service_hub_child') { score += 18; reasons.push('Child link from service hub'); }
  if (!preview && candidate.source !== 'homepage' && candidate.source !== 'sitemap') {
    const hasExplicitIntent = serviceIntent || bucket === 'service_child' || staffContext || FAQ_WORDS.test(haystack);
    score -= hasExplicitIntent ? 10 : 30;
    if (!hasExplicitIntent && score < 50) bucket = 'noise';
    reasons.push('Unverified guessed page');
  }
  return { bucket, score, reason: reasons.join('; ') || 'Low relevance' };
}

export function selectPages(scored: Array<{ candidate: CandidateUrl; bucket: CandidateBucket; score: number; reason: string }>, maxPages = 8) {
  const byScore = (bucket: CandidateBucket) => scored.filter((item) => item.bucket === bucket).sort((a, b) => b.score - a.score);
  const selected: typeof scored = [];
  const add = (bucket: CandidateBucket, count: number) => {
    for (const item of byScore(bucket).slice(0, count)) {
      if (selected.length < maxPages && !selected.some((s) => s.candidate.url === item.candidate.url)) selected.push(item);
    }
  };
  // Reserve one page per knowledge bucket (services, staff/team, FAQ, policies) BEFORE
  // filling the remaining budget with extra service detail pages — otherwise a service-heavy
  // site crowds out the staff/FAQ/policy pages and those knowledge types come back empty.
  add('homepage', 1);
  add('service_hub', 1);
  add('staff_team', 1);
  add('about_team', 1);
  add('faq', 1);
  add('policies', 1);
  add('service_child', 3);
  add('contact_hours', 1);
  add('booking', 1);
  add('promotions', 1);
  add('service_child', maxPages);
  return selected.slice(0, maxPages);
}

export function toDiagnostic(item: { candidate: CandidateUrl; bucket: CandidateBucket; score: number; reason: string }): SelectedPageDiagnostic {
  return { url: item.candidate.url, bucket: item.bucket, score: item.score, source: item.candidate.source, reason: item.reason };
}
