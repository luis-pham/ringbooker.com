import { PostStatus } from '@prisma/client';
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBlogDetailJsonLd, parseFaqPairsFromMarkdown } from '@/lib/blog/blog-jsonld';
import type { PostWithRelations } from '@/types/blog';

function sampleAuthorPost(overrides: Partial<PostWithRelations> = {}): PostWithRelations {
  const base = {
    id: 'post_test_1',
    pathPrefix: 'blog',
    slug: 'test-slug',
    title: 'Test Article Title',
    excerpt:
      'This excerpt is intentionally longer than forty characters so description logic uses it as primary.',
    metaDescription: null,
    content: 'Hello **world**.\n\nMore text.',
    coverImageUrl: '/uploads/cover.jpg',
    coverStats: null,
    footerCtas: null,
    status: PostStatus.PUBLISHED,
    publishedAt: new Date('2025-06-01T12:00:00.000Z'),
    updatedAt: new Date('2025-06-15T12:00:00.000Z'),
    createdAt: new Date('2025-05-20T12:00:00.000Z'),
    readTimeMin: 3,
    views: 0,
    featured: false,
    authorId: 'author_1',
    author: {
      id: 'author_1',
      name: 'Jamie Writer',
      role: 'Editor',
      initials: 'JW',
      avatar: null,
    },
    categories: [
      {
        postId: 'post_test_1',
        categoryId: 'cat_1',
        category: { id: 'cat_1', name: 'Nail Salons', slug: 'nail-salons' },
      },
    ],
    tags: [{ postId: 'post_test_1', tagId: 'tag_1', tag: { id: 'tag_1', name: 'AI', slug: 'ai' } }],
  };
  return { ...base, ...overrides } as PostWithRelations;
}

test('parseFaqPairsFromMarkdown returns empty when no FAQ section', () => {
  assert.deepEqual(parseFaqPairsFromMarkdown('# Title\n\n### Not FAQ\n\nBody'), []);
});

test('parseFaqPairsFromMarkdown extracts pairs after H2 FAQ heading', () => {
  const md = `
## Intro

Hello.

## FAQ

### First question here?

Answer line one.

Answer **two**.

### Second?

Yes.
`;
  const pairs = parseFaqPairsFromMarkdown(md);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].q, 'First question here?');
  assert.match(pairs[0].a, /Answer line one/);
  assert.match(pairs[0].a, /Answer two/);
  assert.equal(pairs[1].q, 'Second?');
  assert.equal(pairs[1].a, 'Yes.');
});

test('parseFaqPairsFromMarkdown accepts H1 FAQ heading', () => {
  const pairs = parseFaqPairsFromMarkdown('# FAQ\n\n### One?\n\nA1.\n');
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].q, 'One?');
});

test('parseFaqPairsFromMarkdown stops at next H2 section', () => {
  const md = `## FAQ

### Q1?

A1.

## Not more FAQ

### Fake?

Should not appear.
`;
  const pairs = parseFaqPairsFromMarkdown(md);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].q, 'Q1?');
});

test('buildBlogDetailJsonLd returns null for draft', () => {
  const post = sampleAuthorPost({ status: PostStatus.DRAFT });
  assert.equal(buildBlogDetailJsonLd(post), null);
});

test('buildBlogDetailJsonLd maps BlogPosting fields', () => {
  const post = sampleAuthorPost();
  const out = buildBlogDetailJsonLd(post);
  assert.ok(out);
  assert.equal(out.blogPosting['@type'], 'BlogPosting');
  assert.equal(out.blogPosting.headline, 'Test Article Title');
  assert.match(String(out.blogPosting.description ?? ''), /forty characters/);
  assert.equal(out.blogPosting.url, 'https://ringbooker.com/blog/test-slug');
  assert.equal(out.blogPosting.articleSection, 'Nail Salons');
  assert.match(String(out.blogPosting.keywords ?? ''), /AI/);
  assert.equal(out.faqPage, null);
});

test('buildBlogDetailJsonLd uses metaDescription for description when set', () => {
  const post = sampleAuthorPost({
    metaDescription: 'Structured data should use the CMS meta line.',
  });
  const out = buildBlogDetailJsonLd(post);
  assert.equal(out?.blogPosting.description, 'Structured data should use the CMS meta line.');
});

test('buildBlogDetailJsonLd includes FAQPage when markdown FAQ section exists', () => {
  const post = sampleAuthorPost({
    content: '## FAQ\n\n### Pricing?\n\nWe post **plans** on the site.\n',
  });
  const out = buildBlogDetailJsonLd(post);
  assert.ok(out?.faqPage);
  assert.equal(out.faqPage['@type'], 'FAQPage');
  const main = out.faqPage.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
  assert.equal(main.length, 1);
  assert.equal(main[0].name, 'Pricing?');
  assert.match(main[0].acceptedAnswer.text, /plans/);
});
