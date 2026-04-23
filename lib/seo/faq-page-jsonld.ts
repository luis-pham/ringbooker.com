export type FaqPageItem = { q: string; a: string };

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
        text: item.a,
      },
    })),
  };
}
