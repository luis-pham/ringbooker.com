import { z } from 'zod';

/** Limits chosen so legacy posts (short excerpts, long titles) still load and save in admin. */
export const postSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => /^[-a-z0-9_]+$/.test(value.trim().toLowerCase()), {
      message: 'Slug may only use lowercase letters, digits, hyphens, and underscores',
    }),
  excerpt: z.string().min(1).max(500),
  content: z.string().min(1),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  categoryIds: z.array(z.string()).min(1),
  tags: z.array(z.string()),
  featured: z.boolean(),
  coverImageUrl: z
    .string()
    .max(2000)
    .refine((value) => {
      const v = value.trim();
      if (v === '') return true;
      if (v.startsWith('/') || /^https?:\/\//i.test(v)) return true;
      // Legacy rows sometimes stored "uploads/blog/..." without leading slash
      if (/^uploads\//i.test(v)) return true;
      return false;
    }, {
      message: 'Cover image must be empty, a path starting with / or uploads/, or an http(s) URL',
    }),
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

/** Normalize legacy cover paths for admin form defaultValues (Zod + hidden field). */
export function sanitizeCoverImageInput(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (v.length > 2000) return '';
  if (v.startsWith('/') || /^https?:\/\//i.test(v)) return v;
  if (/^uploads\//i.test(v)) return `/${v}`;
  return '';
}

/** URL slug helper; keeps underscores so legacy slugs are not stripped on edit. */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

