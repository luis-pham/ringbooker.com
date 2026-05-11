import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyCandidate, selectPages } from './scoring';
import type { CandidateUrl, PagePreview } from './types';

function candidate(url: string, anchorText = ''): CandidateUrl {
  return { url, anchorText, source: 'nav', pathTokens: new URL(url).pathname.split('/').filter(Boolean) };
}

function preview(overrides: Partial<PagePreview>): PagePreview {
  return { url: 'https://x.test', title: '', h1: '', h2s: [], firstTextChars: '', priceCount: 0, durationCount: 0, serviceKeywordCount: 0, internalServiceLikeLinkCount: 0, links: [], jsonLd: [], contentScore: 10, ...overrides };
}

test('/salon is service hub only when content has service evidence', () => {
  assert.equal(classifyCandidate(candidate('https://x.test/salon'), preview({ h1: 'Our story', firstTextChars: 'Brand story only.' })).bucket, 'noise');
  assert.equal(classifyCandidate(candidate('https://x.test/salon'), preview({ h1: 'Salon Services', priceCount: 3, serviceKeywordCount: 6 })).bucket, 'service_hub');
});

test('non-standard paths use anchor and heading evidence', () => {
  assert.equal(classifyCandidate(candidate('https://x.test/blank-2', 'Services')).bucket, 'service_hub');
  assert.equal(classifyCandidate(candidate('https://x.test/page-1', 'Balayage')).bucket, 'service_child');
  assert.equal(classifyCandidate(candidate('https://x.test/page-2', 'Hair Extensions')).bucket, 'service_child');
  assert.equal(classifyCandidate(candidate('https://x.test/location/nyc'), preview({ firstTextChars: '123 Main St Open Monday to Friday' })).bucket, 'contact_hours');
});

test('page selection prioritizes multiple service child pages for pricing extraction', () => {
  const scored = [
    { candidate: candidate('https://x.test'), bucket: 'homepage' as const, score: 100, reason: 'Homepage' },
    { candidate: candidate('https://x.test/services'), bucket: 'service_hub' as const, score: 90, reason: 'Service hub' },
    { candidate: candidate('https://x.test/services/balayage'), bucket: 'service_child' as const, score: 88, reason: 'Service child' },
    { candidate: candidate('https://x.test/services/color'), bucket: 'service_child' as const, score: 87, reason: 'Service child' },
    { candidate: candidate('https://x.test/services/extensions'), bucket: 'service_child' as const, score: 86, reason: 'Service child' },
    { candidate: candidate('https://x.test/services/haircut'), bucket: 'service_child' as const, score: 85, reason: 'Service child' },
    { candidate: candidate('https://x.test/faq'), bucket: 'faq' as const, score: 80, reason: 'FAQ' },
  ];
  const selected = selectPages(scored, 8).map((item) => item.candidate.url);
  assert.ok(selected.includes('https://x.test/services/balayage'));
  assert.ok(selected.includes('https://x.test/services/color'));
  assert.ok(selected.includes('https://x.test/services/extensions'));
  assert.ok(selected.includes('https://x.test/services/haircut'));
});
