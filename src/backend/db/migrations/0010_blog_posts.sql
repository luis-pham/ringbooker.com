create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content text not null,
  status text not null default 'draft',
  seo_title text,
  seo_description text,
  cover_image_url text,
  tags text[] not null default '{}',
  author_name text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_status_check check (status in ('draft', 'published', 'archived'))
);

create index if not exists idx_blog_posts_status on public.blog_posts(status);
create index if not exists idx_blog_posts_published_at on public.blog_posts(published_at desc);
create index if not exists idx_blog_posts_updated_at on public.blog_posts(updated_at desc);
