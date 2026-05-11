import type { CandidateBucket, CandidateUrl, PagePreview, SelectedPageDiagnostic } from './types';

const SERVICE_WORDS = /\b(service|services|menu|pricing|price|treatment|treatments|salon|spa|beauty|hair|haircut|color|balayage|manicure|pedicure|waxing|massage|facial|botox|laser|injectable|lashes|brow)\b/i;
const SPECIFIC_SERVICE = /\b(balayage|hydrafacial|botox|filler|gel manicure|deluxe pedicure|eyebrow wax|waxing|massage|facial|hair color|highlights|haircut|hair cut|hair extensions?|brazilian blowout|bridal hair|make-?up|acrylic|dip powder)\b/i;
const STAFF_WORDS = /\b(staff|team|stylist|stylists|providers|artists|technicians|experts|injectors|estheticians|barbers)\b/i;
const POLICY_WORDS = /\b(policy|policies|cancellation|no-show|no show|deposit|refund|terms|appointment|late|prep|aftercare)\b/i;
const FAQ_WORDS = /\b(faq|faqs|questions|help)\b/i;
const PROMO_WORDS = /\b(specials|promotions|offers|deals|membership|packages)\b/i;

export function classifyCandidate(candidate: CandidateUrl, preview?: PagePreview): { bucket: CandidateBucket; score: number; reason: string } {
  const haystack = `${candidate.url} ${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''} ${preview?.h2s.join(' ') ?? ''}`.toLowerCase();
  let score = 0;
  let bucket: CandidateBucket = 'noise';
  const reasons: string[] = [];
  const staffContext = STAFF_WORDS.test(haystack) || /\/(?:our-)?team|\/staff|\/stylists?/.test(haystack);
  const primaryPageSignal = `${candidate.url} ${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''}`.toLowerCase();

  if (/privacy|terms|login|cart|checkout|account/.test(haystack)) return { bucket: 'noise', score: -50, reason: 'Excluded utility page' };
  if (/blog|news|article|post|author|tag|category/.test(haystack)) { score -= 25; reasons.push('Blog/news deprioritized'); }

  const isHomepage = candidate.source === 'homepage';
  const isServiceHubChild = candidate.source === 'service_hub_child';
  if (isHomepage) { bucket = 'homepage'; score += 100; reasons.push('Homepage'); }
  if (/contact|hours|location|directions/.test(haystack)) { bucket = 'contact_hours'; score += 28; reasons.push('Contact/hours signals'); }
  if (staffContext) { if (bucket === 'noise') bucket = 'staff_team'; score += 20; reasons.push('Staff/team signals'); }
  if (POLICY_WORDS.test(haystack)) { bucket = bucket === 'noise' ? 'policies' : bucket; score += 18; reasons.push('Policy signals'); }
  if (FAQ_WORDS.test(haystack)) { bucket = bucket === 'noise' ? 'faq' : bucket; score += 18; reasons.push('FAQ signals'); }
  if (PROMO_WORDS.test(haystack)) { bucket = bucket === 'noise' ? 'promotions' : bucket; score += 16; reasons.push('Promotion signals'); }
  if (/about|team|staff|artist|provider/.test(haystack)) { bucket = bucket === 'noise' ? 'about_team' : bucket; score += 12; reasons.push('About/team signals'); }
  if (/book|appointment|schedule|reserve/.test(haystack)) { bucket = isHomepage || staffContext ? bucket : 'booking'; score += 22; reasons.push('Booking signals'); }

  if ((candidate.anchorText && SPECIFIC_SERVICE.test(candidate.anchorText)) || (preview && SPECIFIC_SERVICE.test(`${preview.title} ${preview.h1}`))) {
    bucket = isHomepage ? bucket : 'service_child'; score += 45; reasons.push('Specific service signal');
  }
  if (/service|menu|pricing|treatment/.test(primaryPageSignal) || (preview && preview.priceCount > 0 && preview.internalServiceLikeLinkCount >= 2)) {
    bucket = bucket === 'service_child' || isHomepage || isServiceHubChild || staffContext ? bucket : 'service_hub'; score += 35; reasons.push('Service hub/menu signal');
  }
  if (SERVICE_WORDS.test(haystack)) { score += 15; reasons.push('Service keyword'); }
  if (preview) {
    if (preview.serviceKeywordCount >= 4 && preview.priceCount > 0) { bucket = bucket === 'service_child' || isHomepage || isServiceHubChild || staffContext ? bucket : 'service_hub'; score += 24; reasons.push('Service content with prices'); }
    if (preview.priceCount > 0) { score += 8; reasons.push('Price pattern'); }
    if (preview.durationCount > 0) { score += 5; reasons.push('Duration pattern'); }
    if (preview.contentScore < 5) { score -= 15; reasons.push('Weak content'); }
  }
  if (candidate.source === 'sitemap') { score += 8; reasons.push('Sitemap candidate'); }
  if (candidate.source === 'service_hub_child') { score += 18; reasons.push('Child link from service hub'); }
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
  add('homepage', 1); add('service_hub', 1); add('service_child', 5); add('contact_hours', 1); add('booking', 1); add('policies', 1); add('faq', 1); add('staff_team', 1); add('promotions', 1); add('about_team', 1);
  return selected.slice(0, maxPages);
}

export function toDiagnostic(item: { candidate: CandidateUrl; bucket: CandidateBucket; score: number; reason: string }): SelectedPageDiagnostic {
  return { url: item.candidate.url, bucket: item.bucket, score: item.score, source: item.candidate.source, reason: item.reason };
}
