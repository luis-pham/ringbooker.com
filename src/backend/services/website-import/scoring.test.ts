import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyCandidate, selectPages } from './scoring';
import type { CandidateBucket, CandidateUrl, PagePreview } from './types';

function scoredItem(url: string, bucket: CandidateBucket, score: number) {
  return { candidate: candidate(url), bucket, score, reason: '' };
}

function candidate(url: string, anchorText = '', source: CandidateUrl['source'] = 'nav'): CandidateUrl {
  return { url, anchorText, source, pathTokens: new URL(url).pathname.split('/').filter(Boolean) };
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

test('concatenated service category slugs are treated as child menu pages', () => {
  assert.equal(classifyCandidate(candidate('https://x.test/cutandstyle'), preview({ h1: 'Cut + Style', priceCount: 4, serviceKeywordCount: 5 })).bucket, 'service_child');
  assert.equal(classifyCandidate(candidate('https://x.test/textureandextentions'), preview({ h1: 'Texture + Extensions', firstTextChars: 'Services can only be booked with participating stylists.', priceCount: 3, serviceKeywordCount: 5 })).bucket, 'service_child');
  assert.equal(classifyCandidate(candidate('https://x.test/contactus'), preview({ h1: 'Contact us', firstTextChars: '123 Main St Open Monday to Friday' })).bucket, 'contact_hours');
});

test('service hub child links can promote category pages to service child', () => {
  assert.equal(classifyCandidate(
    candidate('https://x.test/textureandextentions', 'Texture & Extensions', 'service_hub_child'),
    preview({ h1: 'Texture and Extensions', h2s: ['Texture + Extensions'], priceCount: 3, serviceKeywordCount: 8 }),
  ).bucket, 'service_child');
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

test('page selection reserves FAQ for AI extraction when the page budget is full', () => {
  const scored = [
    { candidate: candidate('https://x.test'), bucket: 'homepage' as const, score: 100, reason: 'Homepage' },
    { candidate: candidate('https://x.test/services'), bucket: 'service_hub' as const, score: 90, reason: 'Service hub' },
    { candidate: candidate('https://x.test/services/balayage'), bucket: 'service_child' as const, score: 88, reason: 'Service child' },
    { candidate: candidate('https://x.test/services/color'), bucket: 'service_child' as const, score: 87, reason: 'Service child' },
    { candidate: candidate('https://x.test/services/extensions'), bucket: 'service_child' as const, score: 86, reason: 'Service child' },
    { candidate: candidate('https://x.test/services/haircut'), bucket: 'service_child' as const, score: 85, reason: 'Service child' },
    { candidate: candidate('https://x.test/contact'), bucket: 'contact_hours' as const, score: 84, reason: 'Contact' },
    { candidate: candidate('https://x.test/team'), bucket: 'staff_team' as const, score: 83, reason: 'Team' },
    { candidate: candidate('https://x.test/faq'), bucket: 'faq' as const, score: 82, reason: 'FAQ' },
  ];
  const selected = selectPages(scored, 8).map((item) => item.candidate.url);
  assert.ok(selected.includes('https://x.test/faq'));
  assert.ok(selected.includes('https://x.test/team'));
  assert.ok(!selected.includes('https://x.test/services/haircut'));
});

test('homepage remains homepage and exact services page wins service hub slot', () => {
  const homepage = { candidate: { ...candidate('https://x.test'), source: 'homepage' as const }, ...classifyCandidate({ ...candidate('https://x.test'), source: 'homepage' as const }, preview({ h2s: ['Our Services'], serviceKeywordCount: 8, internalServiceLikeLinkCount: 3 })) };
  const services = { candidate: candidate('https://x.test/services', 'Services'), ...classifyCandidate(candidate('https://x.test/services', 'Services'), preview({ h1: 'Our Services', priceCount: 8, durationCount: 2, serviceKeywordCount: 12 })) };
  const about = { candidate: candidate('https://x.test/about', 'About'), ...classifyCandidate(candidate('https://x.test/about', 'About'), preview({ h1: 'About us', h2s: ['Our Services'], durationCount: 1, serviceKeywordCount: 12, internalServiceLikeLinkCount: 3 })) };
  assert.equal(homepage.bucket, 'homepage');
  assert.equal(services.bucket, 'service_hub');
  assert.notEqual(about.bucket, 'service_hub');
  const selected = selectPages([homepage, services, about], 8).map((item) => item.candidate.url);
  assert.ok(selected.includes('https://x.test'));
  assert.ok(selected.includes('https://x.test/services'));
});

test('service-area pages are not treated as menu pages and staff pages stay staff', () => {
  const services = { candidate: candidate('https://x.test/our-services', 'Our Services'), ...classifyCandidate(candidate('https://x.test/our-services', 'Our Services'), preview({ h1: 'Our Services', serviceKeywordCount: 12 })) };
  const staff = { candidate: candidate('https://x.test/staff', 'Staff'), ...classifyCandidate(candidate('https://x.test/staff', 'Staff'), preview({ title: 'Staff', h1: 'Cassie', h2s: ['Hair Restoration & Extension Expert'] })) };
  const serviceArea = { candidate: candidate('https://x.test/areas-of-service/harrisburg-hair-extensions', 'Harrisburg Hair Extensions'), ...classifyCandidate(candidate('https://x.test/areas-of-service/harrisburg-hair-extensions', 'Harrisburg Hair Extensions'), preview({ title: 'Hair Extensions Harrisburg', h1: 'Hair Extensions Harrisburg', serviceKeywordCount: 10 })) };
  const taxonomyArchive = { candidate: candidate('https://x.test/service_type/hair-extensions', 'Hair Extensions'), ...classifyCandidate(candidate('https://x.test/service_type/hair-extensions', 'Hair Extensions'), preview({ title: 'Hair Extensions', h1: 'Hair Extensions', serviceKeywordCount: 10 })) };

  assert.equal(services.bucket, 'service_hub');
  assert.equal(staff.bucket, 'staff_team');
  assert.notEqual(serviceArea.bucket, 'service_hub');
  assert.notEqual(serviceArea.bucket, 'service_child');
  assert.notEqual(taxonomyArchive.bucket, 'service_hub');
  assert.notEqual(taxonomyArchive.bucket, 'service_child');

  const selected = selectPages([
    { candidate: { ...candidate('https://x.test'), source: 'homepage' as const }, bucket: 'homepage' as const, score: 100, reason: 'Homepage' },
    services,
    staff,
    serviceArea,
    taxonomyArchive,
    { candidate: candidate('https://x.test/faq', 'FAQ'), bucket: 'faq' as const, score: 40, reason: 'FAQ' },
  ], 8).map((item) => item.candidate.url);
  assert.ok(selected.includes('https://x.test/our-services'));
  assert.ok(selected.includes('https://x.test/staff'));
  assert.ok(!selected.includes('https://x.test/areas-of-service/harrisburg-hair-extensions'));
  assert.ok(!selected.includes('https://x.test/service_type/hair-extensions'));
});

test('footer contact headings do not turn SEO content pages into contact pages', () => {
  const contentPage = classifyCandidate(
    candidate('https://x.test/hair-loss-specialists-philadelphia', 'Hair Loss Specialists'),
    preview({
      title: 'Hair Loss Specialists Philadelphia',
      h1: 'Hair Loss Specialists Philadelphia',
      h2s: ['Compassionate Hair Loss Technicians', 'Contact Us'],
      serviceKeywordCount: 10,
    }),
  );
  assert.notEqual(contentPage.bucket, 'contact_hours');
});

test('selectPages reserves staff, FAQ and policy pages on a service-heavy site', () => {
  const scored = [
    scoredItem('https://x.test/', 'homepage', 100),
    scoredItem('https://x.test/services', 'service_hub', 95),
    scoredItem('https://x.test/contact', 'contact_hours', 50),
    ...Array.from({ length: 10 }, (_, i) => scoredItem(`https://x.test/services/s${i}`, 'service_child', 80 - i)),
    scoredItem('https://x.test/team', 'staff_team', 40),
    scoredItem('https://x.test/faq', 'faq', 35),
    scoredItem('https://x.test/policies', 'policies', 30),
  ];
  const buckets = selectPages(scored, 10).map((item) => item.bucket);
  assert.ok(buckets.includes('staff_team'), 'staff page reserved');
  assert.ok(buckets.includes('faq'), 'faq page reserved');
  assert.ok(buckets.includes('policies'), 'policy page reserved');
  assert.ok(buckets.includes('service_hub'), 'service hub still present');
});
