import assert from 'node:assert/strict';
import test from 'node:test';

import { getBlogIndexSeoDirectives } from '@/lib/blog/blog-index-seo';

test('/blog has index,follow and canonical /blog', () => {
  const out = getBlogIndexSeoDirectives({});
  assert.equal(out.robots.index, true);
  assert.equal(out.robots.follow, true);
  assert.equal(out.canonical, 'https://ringbooker.com/blog');
});

test('/blog?search=Nail%20Salon -> noindex,follow canonical /blog', () => {
  const out = getBlogIndexSeoDirectives({ search: 'Nail Salon' });
  assert.equal(out.robots.index, false);
  assert.equal(out.robots.follow, true);
  assert.equal(out.canonical, 'https://ringbooker.com/blog');
});

test('/blog?category=missed-calls -> noindex,follow canonical /blog', () => {
  const out = getBlogIndexSeoDirectives({ category: 'missed-calls' });
  assert.equal(out.robots.index, false);
  assert.equal(out.robots.follow, true);
  assert.equal(out.canonical, 'https://ringbooker.com/blog');
});

test('/blog?cluster=missed-booking-protection&search=Booking -> noindex,follow canonical /blog', () => {
  const out = getBlogIndexSeoDirectives({
    cluster: 'missed-booking-protection',
    search: 'Booking',
  });
  assert.equal(out.robots.index, false);
  assert.equal(out.robots.follow, true);
  assert.equal(out.canonical, 'https://ringbooker.com/blog');
});

test('/blog?page=2 -> noindex,follow canonical /blog', () => {
  const out = getBlogIndexSeoDirectives({ page: '2' });
  assert.equal(out.robots.index, false);
  assert.equal(out.robots.follow, true);
  assert.equal(out.canonical, 'https://ringbooker.com/blog');
});

test('/blog?page=1 still indexable (redundant param)', () => {
  const out = getBlogIndexSeoDirectives({ page: '1' });
  assert.equal(out.robots.index, true);
  assert.equal(out.robots.follow, true);
});

test('/blog?tag=some-slug -> noindex,follow', () => {
  const out = getBlogIndexSeoDirectives({ tag: 'some-slug' });
  assert.equal(out.robots.index, false);
  assert.equal(out.robots.follow, true);
});

test('/blog?cluster=blog -> index (default cluster)', () => {
  const out = getBlogIndexSeoDirectives({ cluster: 'blog' });
  assert.equal(out.robots.index, true);
  assert.equal(out.robots.follow, true);
});

test('/blog?cluster=trust -> noindex (non-default hub listing)', () => {
  const out = getBlogIndexSeoDirectives({ cluster: 'trust' });
  assert.equal(out.robots.index, false);
  assert.equal(out.robots.follow, true);
});
