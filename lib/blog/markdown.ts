import { marked } from 'marked';
import type { RendererThis, Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';

import { plainTextFromMarkdownHeading, slugifyTocAnchor } from '@/lib/extractToc';
import { siteConfig } from '@/lib/site';

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    heading(this: RendererThis, { tokens, depth, text }: Tokens.Heading) {
      const id = slugifyTocAnchor(plainTextFromMarkdownHeading(text.trim()));
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
    },
  },
});

/** Paths where editor-authored links should pass equity (no rel=nofollow). */
function isInternalSeoPublicPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/pricing') return true;
  const prefixes = [
    '/demo',
    '/industries',
    '/missed-booking-protection',
    '/current-number',
    '/works-with',
    '/compare',
    '/trust',
    '/blog',
  ];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

function normalizeHost(host: string): string {
  return host.replace(/^www\./i, '').toLowerCase();
}

/**
 * External links: noopener noreferrer nofollow.
 * Internal SEO public URLs on this site: noopener noreferrer (follow).
 * Other internal (e.g. /user): keep nofollow.
 * mailto/tel: noopener noreferrer, same tab.
 */
function anchorSecurityAttrs(href: string | undefined): { target?: string; rel: string } {
  if (!href?.trim()) return { target: '_blank', rel: 'noopener noreferrer nofollow' };
  const trimmed = href.trim();
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return { rel: 'noopener noreferrer' };
  }

  try {
    const base = siteConfig.url.replace(/\/$/, '');
    const siteHost = normalizeHost(new URL(base).hostname);

    // Root-relative only (`//host` is protocol-relative absolute — must not use pathname-only logic).
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      const pathname = new URL(trimmed, `${base}/`).pathname;
      if (isInternalSeoPublicPath(pathname)) {
        return { target: '_blank', rel: 'noopener noreferrer' };
      }
      return { target: '_blank', rel: 'noopener noreferrer nofollow' };
    }

    if (trimmed.startsWith('//') && /^\/\/[^/]+/i.test(trimmed)) {
      const u = new URL(`https:${trimmed}`);
      const host = normalizeHost(u.hostname);
      const internal = host === siteHost;
      if (internal && isInternalSeoPublicPath(u.pathname)) {
        return { target: '_blank', rel: 'noopener noreferrer' };
      }
      return { target: '_blank', rel: 'noopener noreferrer nofollow' };
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      const host = normalizeHost(u.hostname);
      const internal = host === siteHost;
      if (internal && isInternalSeoPublicPath(u.pathname)) {
        return { target: '_blank', rel: 'noopener noreferrer' };
      }
      return { target: '_blank', rel: 'noopener noreferrer nofollow' };
    }

    return { target: '_blank', rel: 'noopener noreferrer nofollow' };
  } catch {
    return { target: '_blank', rel: 'noopener noreferrer nofollow' };
  }
}

export function renderMarkdownToSafeHtml(markdown: string): string {
  const raw = marked.parse(markdown ?? '');
  const html = typeof raw === 'string' ? raw : '';
  return sanitizeHtml(html, {
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'blockquote',
      'ul',
      'ol',
      'li',
      'strong',
      'em',
      'del',
      's',
      'code',
      'pre',
      'a',
      'hr',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    allowedAttributes: {
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      th: ['colspan', 'rowspan', 'align'],
      td: ['colspan', 'rowspan', 'align'],
      code: ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
    transformTags: {
      a: (tagName, attribs) => {
        const { target, rel } = anchorSecurityAttrs(attribs.href);
        return {
          tagName,
          attribs: {
            ...attribs,
            ...(target !== undefined ? { target } : {}),
            rel,
          },
        };
      },
    },
  });
}
