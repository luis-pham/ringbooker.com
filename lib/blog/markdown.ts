import { marked } from 'marked';
import type { RendererThis, Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';

import { slugifyTocAnchor } from '@/lib/extractToc';

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    heading(this: RendererThis, { tokens, depth, text }: Tokens.Heading) {
      const id = slugifyTocAnchor(text.trim());
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
    },
  },
});

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
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }),
    },
  });
}
