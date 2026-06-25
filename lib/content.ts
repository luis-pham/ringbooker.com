import fs from 'fs';
import path from 'path';

import matter from 'gray-matter';

export function loadPageContent<TFrontmatter = Record<string, unknown>>(slug: string) {
  const filePath = path.join(process.cwd(), 'content/pages', `${slug}.md`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return { frontmatter: data as TFrontmatter, body: content };
}

export function loadIndustryContent<TFrontmatter = Record<string, unknown>>(slug: string) {
  const filePath = path.join(process.cwd(), 'content/industries', `${slug}.md`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return { frontmatter: data as TFrontmatter, body: content };
}

export function loadHubContent<TFrontmatter = Record<string, unknown>>(slug: string) {
  const filePath = path.join(process.cwd(), 'content/hubs', `${slug}.md`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return { frontmatter: data as TFrontmatter, body: content };
}
