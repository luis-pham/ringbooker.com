export type TocItem = {
  id: string;
  label: string;
  level: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function extractToc(mdxContent: string): TocItem[] {
  const toc: TocItem[] = [];

  const markdownHeadingRegex = /^(#{1,3})\s+(.+)$/gm;
  let markdownMatch: RegExpExecArray | null;
  while ((markdownMatch = markdownHeadingRegex.exec(mdxContent)) !== null) {
    const level = markdownMatch[1]?.length ?? 2;
    const label = markdownMatch[2]?.trim() ?? '';
    if (label.length === 0) continue;
    toc.push({ id: slugify(label), label, level });
  }

  const htmlHeadingRegex = /<h([1-3])(?:\s+[^>]*)?>(.*?)<\/h\1>/gim;
  let htmlMatch: RegExpExecArray | null;
  while ((htmlMatch = htmlHeadingRegex.exec(mdxContent)) !== null) {
    const level = Number(htmlMatch[1] ?? 2);
    const rawLabel = htmlMatch[2] ?? '';
    const label = rawLabel.replace(/<[^>]+>/g, '').trim();
    if (label.length === 0) continue;
    toc.push({ id: slugify(label), label, level });
  }

  const deduped = new Map<string, TocItem>();
  for (const item of toc) {
    if (!deduped.has(item.id)) deduped.set(item.id, item);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const content = mdxContent.toLowerCase();
    return content.indexOf(a.label.toLowerCase()) - content.indexOf(b.label.toLowerCase());
  });
}
