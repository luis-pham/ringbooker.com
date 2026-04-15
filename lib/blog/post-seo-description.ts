import type { Post } from '@prisma/client';

const SEO_META_MAX_LEN = 320;

export function stripHtmlToPlainText(input: string): string {
  const withoutTags = input.replace(/<[^>]*>/g, ' ');
  return withoutTags.replace(/\s+/g, ' ').trim();
}

/**
 * Lightweight markdown stripping for schema snippets / fallbacks (article HTML still uses
 * `renderMarkdownToSafeHtml`).
 */
export function markdownToPlainTextForSchema(markdown: string, maxLen: number): string {
  let s = markdown ?? '';
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  s = s.replace(/<[^>]*>/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1).trim()}…`;
}

/**
 * Single source for `<meta name="description">`, Open Graph / Twitter copy, and BlogPosting `description`.
 * Prefers `metaDescription` when set; otherwise same fallbacks as before (excerpt → body plain → title).
 */
export function buildPostSeoDescription(post: Pick<Post, 'metaDescription' | 'excerpt' | 'content' | 'title'>): string {
  const metaRaw = (post.metaDescription ?? '').trim();
  if (metaRaw.length > 0) {
    const meta = stripHtmlToPlainText(metaRaw).trim();
    if (meta.length > 0) {
      return meta.length <= SEO_META_MAX_LEN ? meta : `${meta.slice(0, SEO_META_MAX_LEN - 1).trim()}…`;
    }
  }

  const ex = stripHtmlToPlainText(post.excerpt ?? '');
  if (ex.length >= 40) return ex;
  const fromBody = markdownToPlainTextForSchema(post.content ?? '', 320);
  if (fromBody.length >= 40) return fromBody;
  if (ex.length > 0) return ex;
  if (fromBody.length > 0) return fromBody;
  return post.title;
}
