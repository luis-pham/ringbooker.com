import { z } from 'zod';

export const postSchema = z.object({
  title: z.string().min(10).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  excerpt: z.string().min(50).max(300),
  content: z.string().min(100),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  categoryIds: z.array(z.string()).min(1),
  tags: z.array(z.string()),
  featured: z.boolean(),
  coverStats: z
    .array(
      z.object({
        num: z.string(),
        label: z.string(),
      }),
    )
    .max(3),
  readTimeMin: z.number().min(1).max(60),
});

export type PostFormData = z.infer<typeof postSchema>;

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

