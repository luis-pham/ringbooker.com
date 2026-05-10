import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyCandidate } from './scoring';
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
  assert.equal(classifyCandidate(candidate('https://x.test/location/nyc'), preview({ firstTextChars: '123 Main St Open Monday to Friday' })).bucket, 'contact_hours');
});
