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
