import Link from 'next/link';

import { postPublicPath } from '@/lib/blog/path-prefixes';
import type { PostWithRelations } from '@/types/blog';

function formatDate(value: Date | null | undefined): string {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

export function PostCard({ post }: { post: PostWithRelations }) {
  const primaryCategory = post.categories[0]?.category;

  return (
    <Link
      href={postPublicPath(post.pathPrefix, post.slug)}
      className="block overflow-hidden rounded-[var(--mk-radius-card)] border border-[color:var(--mk-border-soft)] bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[var(--mk-shadow-hover)]"
    >
      <div className="p-5">
        <div className="mb-2.5 flex items-center gap-2 text-[12px] text-[color:var(--mk-text-soft)]">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--mk-brand-purple-deep)]">
            {primaryCategory?.name ?? 'Article'}
          </span>
          <span className="h-1 w-1 rounded-full bg-[color:var(--mk-border-strong)]" />
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </div>
        <h3 className="mb-2 line-clamp-2 text-[17px] font-medium leading-tight text-[color:var(--mk-text-strong)]">{post.title}</h3>
        <p className="mb-4 line-clamp-2 text-[13px] leading-6 text-[color:var(--mk-text-muted)]">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-pink-500 text-[10px] font-medium text-white">
              {post.author.initials}
            </span>
            <span className="text-xs font-semibold text-[color:var(--mk-text-muted)]">{post.readTimeMin} min read</span>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--mk-bg-soft)]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-[color:var(--mk-text-muted)]">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
