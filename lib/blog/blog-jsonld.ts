import { PostStatus } from '@prisma/client';

import { buildPostSeoDescription, markdownToPlainTextForSchema } from '@/lib/blog/post-seo-description';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { absoluteOgImageUrl, siteConfig } from '@/lib/site';
import type { PostWithRelations } from '@/types/blog';

/** Aligns with root layout Organization JSON-LD (`app/layout.tsx`) — same `@id` for graph merge. */
function publisherOrganization(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': `${siteConfig.url}/#organization`,
    name: siteConfig.name,
    url: siteConfig.url,
    logo: {
      '@type': 'ImageObject',
      url: `${siteConfig.url}/images/logo.webp`,
      width: 512,
      height: 512,
    },
  };
}

/** Aligns with root layout WebSite JSON-LD `@id`. */
function isPartOfWebSite(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': `${siteConfig.url}/#website`,
    name: siteConfig.name,
    url: siteConfig.url,
  };
}

function wordCountFromMarkdown(markdown: string): number {
  const plain = markdownToPlainTextForSchema(markdown, 500_000);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

export type BlogFaqPair = { q: string; a: string };

/**
 * Parses FAQ Q/A only when the body contains a dedicated markdown section whose heading
 * (H1 or H2, at column 0) is exactly "FAQ" (case-insensitive). Each following `###` heading
 * starts a question; lines until the next `###` or top-level `##` / `#` end the answer.
 * Content outside that contract is ignored (no guessing from arbitrary headings).
 */
export function parseFaqPairsFromMarkdown(markdown: string): BlogFaqPair[] {
  const lines = (markdown ?? '').split(/\r?\n/);
  let i = 0;
  let faqStart = -1;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (/^#{1,2}\s+faq\s*$/i.test(line.trim())) {
      faqStart = i + 1;
      break;
    }
    i += 1;
  }
  if (faqStart < 0) return [];

  const pairs: BlogFaqPair[] = [];
  let currentQ: string | null = null;
  const answerLines: string[] = [];

  const flush = () => {
    if (!currentQ) return;
    const a = answerLines.join('\n').trim();
    const q = currentQ.trim();
    if (q.length >= 2 && a.length >= 2) {
      pairs.push({
        q: markdownToPlainTextForSchema(q, 500),
        a: markdownToPlainTextForSchema(a, 8000),
      });
    }
    answerLines.length = 0;
    currentQ = null;
  };

  for (let j = faqStart; j < lines.length; j += 1) {
    const raw = lines[j] ?? '';
    const trimmed = raw.trim();
    if (/^#\s+/.test(trimmed) && !/^##/.test(trimmed)) {
      flush();
      break;
    }
    if (/^##\s+/.test(trimmed) && !/^###/.test(trimmed)) {
      flush();
      break;
    }
    const h3 = trimmed.match(/^###\s+(.+)$/);
    if (h3) {
      flush();
      currentQ = h3[1] ?? '';
      continue;
    }
    if (currentQ !== null) {
      answerLines.push(raw);
    }
  }
  flush();
  return pairs;
}

export type BlogDetailJsonLd = {
  blogPosting: Record<string, unknown>;
  faqPage: Record<string, unknown> | null;
};

/**
 * BlogPosting + Article (+ optional FAQPage) for public article pages. Returns null when the post
 * is not published (aligns with listing-only published posts; avoids schema for drafts).
 */
export function buildBlogDetailJsonLd(post: PostWithRelations): BlogDetailJsonLd | null {
  if (post.status !== PostStatus.PUBLISHED) return null;

  const path = postPublicPath(post.pathPrefix, post.slug);
  const canonicalUrl = new URL(path, siteConfig.url).toString();
  const cover = post.coverImageUrl?.trim();
  const imageUrl = cover ? absoluteOgImageUrl(cover) : null;

  const keywords = [
    ...post.categories.map((c) => c.category.name),
    ...post.tags.map((t) => t.tag.name),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  const articleSection = post.categories[0]?.category.name?.trim() || undefined;
  const published = post.publishedAt ?? post.createdAt;
  const faqPairs = parseFaqPairsFromMarkdown(post.content ?? '');
  const wc = wordCountFromMarkdown(post.content ?? '');

  /** `BlogPosting` is the specific type; `Article` is included so consumers expecting Article / CreativeWork also match. */
  const blogPosting: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['BlogPosting', 'Article'],
    headline: post.title,
    description: buildPostSeoDescription(post),
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    datePublished: published.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: post.author.name.trim() || 'RingBooker',
    },
    publisher: publisherOrganization(),
    isPartOf: isPartOfWebSite(),
    inLanguage: 'en-US',
  };

  if (imageUrl) {
    blogPosting.image = [imageUrl];
  }
  if (articleSection) {
    blogPosting.articleSection = articleSection;
  }
  if (keywords.length > 0) {
    blogPosting.keywords = keywords.join(', ');
  }
  if (wc > 0) {
    blogPosting.wordCount = wc;
  }

  const faqPage =
    faqPairs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqPairs.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.a,
            },
          })),
        }
      : null;

  return { blogPosting, faqPage };
}
