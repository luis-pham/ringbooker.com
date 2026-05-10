import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRobotsSitemaps, parseSitemapXml, prioritizeChildSitemaps, sitemapUrlsToCandidates } from './sitemap';

test('reads robots sitemap lines and sitemap indexes', () => {
  assert.deepEqual(parseRobotsSitemaps('User-agent: *\nSitemap: https://a.com/sitemap.xml'), ['https://a.com/sitemap.xml']);
  const parsed = parseSitemapXml('<sitemapindex><sitemap><loc>https://a.com/page-sitemap.xml</loc></sitemap><sitemap><loc>https://a.com/post-sitemap.xml</loc></sitemap></sitemapindex>');
  assert.equal(parsed.childSitemaps.length, 2);
  assert.equal(prioritizeChildSitemaps(parsed.childSitemaps)[0], 'https://a.com/page-sitemap.xml');
});

test('caps and dedupes same-origin sitemap URLs', () => {
  const urls = Array.from({ length: 250 }, (_, i) => ({ loc: `https://a.com/services/${i}` }));
  urls.push({ loc: 'https://other.com/services/x' }, { loc: 'https://a.com/services/1' });
  const candidates = sitemapUrlsToCandidates(urls, 'https://a.com/sitemap.xml', 'https://a.com', 200);
  assert.equal(candidates.length, 200);
  assert.equal(candidates.some((candidate) => candidate.url.includes('other.com')), false);
});
