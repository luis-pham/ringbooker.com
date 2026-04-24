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
      className="block overflow-hidden rounded-3xl border border-gray-200 bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,0,0,.08)]"
    >
      <div className="p-5">
        <div className="mb-2.5 flex items-center gap-2 text-[12px] text-gray-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-purple">
            {primaryCategory?.name ?? 'Article'}
          </span>
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        </div>
        <h3 className="mb-2 line-clamp-2 text-[17px] font-bold leading-tight text-gray-900">{post.title}</h3>
        <p className="mb-4 line-clamp-2 text-[13px] leading-6 text-gray-500">{post.excerpt}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-pink-500 text-[10px] font-bold text-white">
              {post.author.initials}
            </span>
            <span className="text-xs font-semibold text-gray-500">{post.readTimeMin} min read</span>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-500">
              <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
