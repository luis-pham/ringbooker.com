import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPostSeoDescription } from '@/lib/blog/post-seo-description';

test('buildPostSeoDescription prefers metaDescription when set', () => {
  const d = buildPostSeoDescription({
    metaDescription: '  Custom SERP snippet.  ',
    excerpt: 'Excerpt is different and longer than forty characters minimum here.',
    content: '# Body\n\nMore.',
    title: 'T',
  });
  assert.equal(d, 'Custom SERP snippet.');
});

test('buildPostSeoDescription falls back when meta empty', () => {
  const d = buildPostSeoDescription({
    metaDescription: null,
    excerpt: 'This excerpt is over forty characters so it wins without meta description.',
    content: '# x',
    title: 'T',
  });
  assert.equal(d, 'This excerpt is over forty characters so it wins without meta description.');
});
