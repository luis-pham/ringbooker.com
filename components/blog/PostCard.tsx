import Link from 'next/link';

import { postPublicPath } from '@/lib/blog/path-prefixes';
import type { PostWithRelations } from '@/types/blog';

const gradientMap: Record<string, string> = {
  'missed-calls': 'from-[#1a0533] to-[#4c1d95]',
  'ai-for-salons': 'from-[#064e3b] to-[#065f46]',
  'revenue-growth': 'from-[#7c2d12] to-[#9a3412]',
  'booking-tips': 'from-[#1e1b4b] to-[#3730a3]',
  'case-studies': 'from-[#134e4a] to-[#0d9488]',
  'vietnamese-owners': 'from-[#4a044e] to-[#7e22ce]',
  default: 'from-[#1a0533] to-[#2d1b69]',
};

const iconMap: Record<string, string> = {
  'missed-calls': '📞',
  'ai-for-salons': '🤖',
  'revenue-growth': '💰',
  'booking-tips': '🛠',
  'case-studies': '⭐',
  'vietnamese-owners': '🇻🇳',
  default: '📘',
};

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
  const categorySlug = primaryCategory?.slug ?? 'default';
  const gradient = gradientMap[categorySlug] ?? gradientMap.default;
  const icon = iconMap[categorySlug] ?? iconMap.default;
  const cover = post.coverImageUrl?.trim() ?? '';

  return (
    <Link
      href={postPublicPath(post.pathPrefix, post.slug)}
      className="block overflow-hidden rounded-3xl border border-gray-200 bg-white transition duration-200 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,0,0,.08)]"
    >
      <div className="relative h-44 overflow-hidden">
        {cover ? (
          <>
            <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          </>
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
            <span className="absolute inset-0 flex items-center justify-center text-[44px] opacity-25">{icon}</span>
          </>
        )}
        <span className="absolute left-3.5 top-3.5 z-10 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
          {primaryCategory?.name ?? 'Article'}
        </span>
      </div>

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
