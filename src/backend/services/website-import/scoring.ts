import type { CandidateBucket, CandidateUrl, PagePreview, SelectedPageDiagnostic } from './types';

const SERVICE_WORDS = /\b(service|services|menu|pricing|price|treatment|treatments|salon|spa|beauty|hair|haircut|color|balayage|manicure|pedicure|waxing|massage|facial|botox|laser|injectable|lashes|brow)\b/i;
const SPECIFIC_SERVICE = /\b(balayage|hydrafacial|botox|filler|gel manicure|deluxe pedicure|eyebrow wax|waxing|massage|facial|hair color|highlights|acrylic|dip powder)\b/i;

export function classifyCandidate(candidate: CandidateUrl, preview?: PagePreview): { bucket: CandidateBucket; score: number; reason: string } {
  const haystack = `${candidate.url} ${candidate.anchorText ?? ''} ${preview?.title ?? ''} ${preview?.h1 ?? ''} ${preview?.h2s.join(' ') ?? ''}`.toLowerCase();
  let score = 0;
  let bucket: CandidateBucket = 'noise';
  const reasons: string[] = [];

  if (/privacy|terms|login|cart|checkout|account/.test(haystack)) return { bucket: 'noise', score: -50, reason: 'Excluded utility page' };
  if (/blog|news|article|post|author|tag|category/.test(haystack)) { score -= 25; reasons.push('Blog/news deprioritized'); }

  if (candidate.source === 'homepage') { bucket = 'homepage'; score += 100; reasons.push('Homepage'); }
  if (/contact|hours|location|directions/.test(haystack)) { bucket = 'contact_hours'; score += 28; reasons.push('Contact/hours signals'); }
  if (/about|team|staff|artist|provider/.test(haystack)) { bucket = bucket === 'noise' ? 'about_team' : bucket; score += 12; reasons.push('About/team signals'); }
  if (/book|appointment|schedule|reserve/.test(haystack)) { bucket = 'booking'; score += 22; reasons.push('Booking signals'); }

  if ((candidate.anchorText && SPECIFIC_SERVICE.test(candidate.anchorText)) || (preview && SPECIFIC_SERVICE.test(`${preview.title} ${preview.h1}`))) {
    bucket = 'service_child'; score += 45; reasons.push('Specific service signal');
  }
  if (/service|menu|pricing|treatment/.test(haystack) || (preview && preview.internalServiceLikeLinkCount >= 2)) {
    bucket = bucket === 'service_child' ? bucket : 'service_hub'; score += 35; reasons.push('Service hub/menu signal');
  }
  if (SERVICE_WORDS.test(haystack)) { score += 15; reasons.push('Service keyword'); }
  if (preview) {
    if (preview.serviceKeywordCount >= 4 && (preview.priceCount > 0 || preview.durationCount > 0)) { bucket = bucket === 'service_child' ? bucket : 'service_hub'; score += 24; reasons.push('Service content with prices/durations'); }
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
  add('homepage', 1); add('service_hub', 2); add('service_child', 3); add('contact_hours', 1); add('booking', 1); add('about_team', 1);
  return selected.slice(0, maxPages);
}

export function toDiagnostic(item: { candidate: CandidateUrl; bucket: CandidateBucket; score: number; reason: string }): SelectedPageDiagnostic {
  return { url: item.candidate.url, bucket: item.bucket, score: item.score, source: item.candidate.source, reason: item.reason };
}
