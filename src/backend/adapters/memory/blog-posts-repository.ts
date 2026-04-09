import { randomUUID } from 'node:crypto';

import type { BlogPost, BlogPostStatus } from '@/src/backend/domain/types';
import type { BlogPostsRepository } from '@/src/backend/ports/repositories';

function normalizeLimit(limit?: number): number {
  if (!limit || limit <= 0) return 50;
  return Math.min(limit, 200);
}

function normalizeSearch(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function matchesQuery(post: BlogPost, query?: string): boolean {
  const normalized = normalizeSearch(query);
  if (!normalized) return true;
  return [post.title, post.excerpt, post.content, post.slug, post.tags.join(' ')]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function sortByUpdatedAtDesc(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

const seedNow = new Date('2026-04-08T00:00:00.000Z').toISOString();

const seededPosts: BlogPost[] = [
  {
    id: 'blog_seed_1',
    slug: 'how-many-calls-does-a-nail-salon-miss-per-day',
    title: 'How Many Calls Does a Nail Salon Miss per Day?',
    excerpt: 'A practical estimate and the KPIs to track so missed calls do not become missed revenue.',
    content:
      'Many beauty businesses underestimate missed-call loss. Start by tracking missed calls by hour, callback success rate, and bookings recovered within 24 hours.',
    status: 'published',
    tags: ['nail-salon', 'operations', 'kpi'],
    authorName: 'RingBooker Team',
    publishedAt: '2026-04-08T00:00:00.000Z',
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: 'blog_seed_2',
    slug: 'ai-receptionist-for-vietnamese-nail-salons',
    title: 'AI Receptionist for Vietnamese Nail Salons',
    excerpt: 'How bilingual English-Vietnamese call handling can protect conversion during peak hours.',
    content:
      'Bilingual salons often lose intent when callers switch language mid-call. A voice agent configured with salon-specific terms can keep flow natural and reduce dropped bookings.',
    status: 'published',
    tags: ['vietnamese', 'bilingual', 'nail-salon'],
    authorName: 'RingBooker Team',
    publishedAt: '2026-04-08T00:00:00.000Z',
    createdAt: seedNow,
    updatedAt: seedNow,
  },
  {
    id: 'blog_seed_3',
    slug: 'truelark-alternatives-for-nail-salons-2026',
    title: 'TrueLark Alternatives for Nail Salons (2026)',
    excerpt: 'A practical comparison framework to evaluate AI receptionist tools for nail operations.',
    content:
      'Compare response quality, booking completion, missed-call recovery, and integration depth. Pricing alone rarely predicts operational fit for high-traffic salons.',
    status: 'published',
    tags: ['comparison', 'truelark-alternative', 'ops'],
    authorName: 'RingBooker Team',
    publishedAt: '2026-04-08T00:00:00.000Z',
    createdAt: seedNow,
    updatedAt: seedNow,
  },
];

export class InMemoryBlogPostsRepository implements BlogPostsRepository {
  private readonly records = new Map<string, BlogPost>(seededPosts.map((post) => [post.id, post]));

  async listPublished(params?: { limit?: number; query?: string }): Promise<BlogPost[]> {
    const limit = normalizeLimit(params?.limit);
    return sortByUpdatedAtDesc(
      [...this.records.values()].filter((post) => post.status === 'published' && matchesQuery(post, params?.query)),
    ).slice(0, limit);
  }

  async listForAdmin(params?: { limit?: number; status?: BlogPostStatus | 'all'; query?: string }): Promise<BlogPost[]> {
    const limit = normalizeLimit(params?.limit);
    const status = params?.status ?? 'all';
    return sortByUpdatedAtDesc(
      [...this.records.values()].filter((post) => {
        if (status !== 'all' && post.status !== status) return false;
        return matchesQuery(post, params?.query);
      }),
    ).slice(0, limit);
  }

  async findBySlug(slug: string, params?: { includeDraft?: boolean }): Promise<BlogPost | null> {
    for (const post of this.records.values()) {
      if (post.slug !== slug) continue;
      if (!params?.includeDraft && post.status !== 'published') return null;
      return post;
    }
    return null;
  }

  async findById(id: string): Promise<BlogPost | null> {
    return this.records.get(id) ?? null;
  }

  async create(params: {
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    status: BlogPostStatus;
    seoTitle?: string | null;
    seoDescription?: string | null;
    coverImageUrl?: string | null;
    tags?: string[];
    authorName?: string | null;
    publishedAt?: string | null;
  }): Promise<BlogPost> {
    const now = new Date().toISOString();
    const id = `blog_${randomUUID()}`;
    const created: BlogPost = {
      id,
      slug: params.slug,
      title: params.title,
      excerpt: params.excerpt,
      content: params.content,
      status: params.status,
      seoTitle: params.seoTitle ?? null,
      seoDescription: params.seoDescription ?? null,
      coverImageUrl: params.coverImageUrl ?? null,
      tags: params.tags ?? [],
      authorName: params.authorName ?? null,
      publishedAt: params.publishedAt ?? (params.status === 'published' ? now : null),
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(created.id, created);
    return created;
  }

  async update(
    id: string,
    patch: Partial<{
      slug: string;
      title: string;
      excerpt: string;
      content: string;
      status: BlogPostStatus;
      seoTitle: string | null;
      seoDescription: string | null;
      coverImageUrl: string | null;
      tags: string[];
      authorName: string | null;
      publishedAt: string | null;
    }>,
  ): Promise<BlogPost | null> {
    const current = this.records.get(id);
    if (!current) return null;
    const updatedStatus = patch.status ?? current.status;
    const now = new Date().toISOString();
    const updated: BlogPost = {
      ...current,
      ...patch,
      tags: patch.tags ?? current.tags,
      publishedAt:
        patch.publishedAt !== undefined
          ? patch.publishedAt
          : updatedStatus === 'published'
            ? current.publishedAt ?? now
            : null,
      updatedAt: now,
    };
    this.records.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}
