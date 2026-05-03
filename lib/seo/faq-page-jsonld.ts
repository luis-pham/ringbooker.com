import { isValidElement, type ReactNode } from 'react';

/** FAQ row for FAQPage JSON-LD; `a` may be rich React content (flattened to plain text for schema). */
export type FaqPageItem = { q: string; a: ReactNode };

function faqAnswerPlainText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(faqAnswerPlainText).join('');
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return faqAnswerPlainText(props.children);
  }
  return '';
}

/** Schema.org FAQPage JSON-LD; returns null when there are no items. */
export function buildFaqPageJsonLd(items: readonly FaqPageItem[]): Record<string, unknown> | null {
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqAnswerPlainText(item.a),
      },
    })),
  };
}
