export type TocItem = {
  id: string;
  label: string;
  level: number;
};

/** Slug for heading anchors — shared by TOC extraction and blog markdown rendering. */
export function slugifyTocAnchor(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Strip inline Markdown from a heading line so TOC labels match visible title text.
 * Handles links `[label](url)`, bold/italic wrappers, `code`, and ~~strike~~.
 */
export function plainTextFromMarkdownHeading(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

  for (let i = 0; i < 8; i++) {
    const prev = s;
    s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
    if (s === prev) break;
  }

  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/~~([^~]+)~~/g, '$1');

  return s.replace(/\s+/g, ' ').trim();
}

type TocEntry = TocItem & { sortPos: number };

export function extractToc(mdxContent: string): TocItem[] {
  const toc: TocEntry[] = [];

  const markdownHeadingRegex = /^(#{1,3})\s+(.+)$/gm;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownHeadingRegex.exec(mdxContent)) !== null) {
    const level = markdownMatch[1]?.length ?? 2;
    const rawLabel = markdownMatch[2]?.trim() ?? '';
    if (rawLabel.length === 0) continue;
    const label = plainTextFromMarkdownHeading(rawLabel);
    if (label.length === 0) continue;
    const id = slugifyTocAnchor(label);
    const sortPos = markdownMatch.index ?? 0;
    toc.push({ id, label, level, sortPos });
  }

  const htmlHeadingRegex = /<h([1-3])(?:\s+[^>]*)?>(.*?)<\/h\1>/gim;
  let htmlMatch: RegExpExecArray | null;
  while ((htmlMatch = htmlHeadingRegex.exec(mdxContent)) !== null) {
    const level = Number(htmlMatch[1] ?? 2);
    const rawLabel = htmlMatch[2] ?? '';
    const label = rawLabel.replace(/<[^>]+>/g, '').trim();
    if (label.length === 0) continue;
    const sortPos = htmlMatch.index ?? 0;
    toc.push({ id: slugifyTocAnchor(label), label, level, sortPos });
  }

  toc.sort((a, b) => a.sortPos - b.sortPos);

  const deduped = new Map<string, TocItem>();
  for (const { sortPos: _, ...rest } of toc) {
    if (!deduped.has(rest.id)) deduped.set(rest.id, rest);
  }

  return Array.from(deduped.values());
}
