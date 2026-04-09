import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({
  gfm: true,
  breaks: true,
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
      'code',
      'pre',
      'a',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }),
    },
  });
}
