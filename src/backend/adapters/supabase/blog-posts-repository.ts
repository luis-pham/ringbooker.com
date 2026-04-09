import type { SupabaseClient } from '@supabase/supabase-js';

import type { BlogPost, BlogPostStatus } from '@/src/backend/domain/types';
import type { BlogPostsRepository } from '@/src/backend/ports/repositories';

type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  status: BlogPostStatus;
  seo_title: string | null;
  seo_description: string | null;
  cover_image_url: string | null;
  tags: string[] | null;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function toBlogPost(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    status: row.status,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    coverImageUrl: row.cover_image_url,
    tags: row.tags ?? [],
    authorName: row.author_name,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLimit(limit?: number): number {
  if (!limit || limit <= 0) return 50;
  return Math.min(limit, 200);
}

function applySearch<T extends { ilike: (field: string, pattern: string) => T }>(query: T, search?: string): T {
  const normalized = search?.trim();
  if (!normalized) return query;
  return query.ilike('title', `%${normalized}%`);
}

export class SupabaseBlogPostsRepository implements BlogPostsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listPublished(params?: { limit?: number; query?: string }): Promise<BlogPost[]> {
    const limit = normalizeLimit(params?.limit);
    let query = this.supabase
      .from('blog_posts')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(limit);
    query = applySearch(query, params?.query);
    const { data, error } = await query.returns<BlogPostRow[]>();
    if (error) {
      throw new Error(`blog_posts_list_published_failed:${error.message}`);
    }
    return (data ?? []).map(toBlogPost);
  }

  async listForAdmin(params?: { limit?: number; status?: BlogPostStatus | 'all'; query?: string }): Promise<BlogPost[]> {
    const limit = normalizeLimit(params?.limit);
    const status = params?.status ?? 'all';
    let query = this.supabase.from('blog_posts').select('*').order('updated_at', { ascending: false }).limit(limit);
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    query = applySearch(query, params?.query);
    const { data, error } = await query.returns<BlogPostRow[]>();
    if (error) {
      throw new Error(`blog_posts_list_for_admin_failed:${error.message}`);
    }
    return (data ?? []).map(toBlogPost);
  }

  async findBySlug(slug: string, params?: { includeDraft?: boolean }): Promise<BlogPost | null> {
    let query = this.supabase.from('blog_posts').select('*').eq('slug', slug);
    if (!params?.includeDraft) {
      query = query.eq('status', 'published');
    }
    const { data, error } = await query.maybeSingle<BlogPostRow>();
    if (error) {
      throw new Error(`blog_posts_find_by_slug_failed:${error.message}`);
    }
    return data ? toBlogPost(data) : null;
  }

  async findById(id: string): Promise<BlogPost | null> {
    const { data, error } = await this.supabase.from('blog_posts').select('*').eq('id', id).maybeSingle<BlogPostRow>();
    if (error) {
      throw new Error(`blog_posts_find_by_id_failed:${error.message}`);
    }
    return data ? toBlogPost(data) : null;
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
    const { data, error } = await this.supabase
      .from('blog_posts')
      .insert({
        slug: params.slug,
        title: params.title,
        excerpt: params.excerpt,
        content: params.content,
        status: params.status,
        seo_title: params.seoTitle ?? null,
        seo_description: params.seoDescription ?? null,
        cover_image_url: params.coverImageUrl ?? null,
        tags: params.tags ?? [],
        author_name: params.authorName ?? null,
        published_at: params.publishedAt ?? (params.status === 'published' ? now : null),
      })
      .select('*')
      .single<BlogPostRow>();
    if (error) {
      throw new Error(`blog_posts_create_failed:${error.message}`);
    }
    return toBlogPost(data);
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
    const current = await this.findById(id);
    if (!current) return null;

    const status = patch.status ?? current.status;
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('blog_posts')
      .update({
        slug: patch.slug ?? current.slug,
        title: patch.title ?? current.title,
        excerpt: patch.excerpt ?? current.excerpt,
        content: patch.content ?? current.content,
        status,
        seo_title: patch.seoTitle !== undefined ? patch.seoTitle : current.seoTitle ?? null,
        seo_description: patch.seoDescription !== undefined ? patch.seoDescription : current.seoDescription ?? null,
        cover_image_url: patch.coverImageUrl !== undefined ? patch.coverImageUrl : current.coverImageUrl ?? null,
        tags: patch.tags ?? current.tags,
        author_name: patch.authorName !== undefined ? patch.authorName : current.authorName ?? null,
        published_at:
          patch.publishedAt !== undefined
            ? patch.publishedAt
            : status === 'published'
              ? current.publishedAt ?? now
              : null,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle<BlogPostRow>();
    if (error) {
      throw new Error(`blog_posts_update_failed:${error.message}`);
    }
    return data ? toBlogPost(data) : null;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase.from('blog_posts').delete().eq('id', id);
    if (error) {
      throw new Error(`blog_posts_delete_failed:${error.message}`);
    }
    return true;
  }
}
