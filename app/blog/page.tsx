import type { Metadata } from 'next';
import { PostStatus } from '@prisma/client';
import Link from 'next/link';

import { CategoryFilter } from '@/components/blog/CategoryFilter';
import { PostCard } from '@/components/blog/PostCard';
import { SearchBar } from '@/components/blog/SearchBar';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { getAllCategories, getAllPosts, getFeaturedPost } from '@/lib/blog';
import type { PostWithRelations } from '@/types/blog';

export const metadata: Metadata = {
  title: 'Blog — RingBooker | Growth Resources',
  description:
    'Practical guides and tips for appointment-based businesses to capture more calls, book more appointments, and increase revenue with AI.',
  openGraph: {
    title: 'Blog — RingBooker | Growth Resources',
    description:
      'Practical guides and tips for appointment-based businesses to capture more calls, book more appointments, and increase revenue with AI.',
    type: 'website',
    url: '/blog',
  },
};

interface BlogPageProps {
  searchParams?: Promise<{
    category?: string;
    search?: string;
    page?: string;
  }>;
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return 'Recently updated';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function buildPageHref({
  page,
  category,
  search,
}: {
  page: number;
  category?: string;
  search?: string;
}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query.length > 0 ? `/blog?${query}` : '/blog';
}

function FeaturedPost({ post }: { post: PostWithRelations }) {
  const category = post.categories[0]?.category;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="mb-14 grid overflow-hidden rounded-3xl border border-gray-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_52px_rgba(0,0,0,.08)] lg:grid-cols-[1.15fr_1fr]"
    >
      <div className="relative flex min-h-[220px] flex-col justify-end bg-gradient-to-br from-[#1a0533] via-[#2d1b69] to-[#4c1d95] p-9 lg:min-h-[340px]">
        <div className="absolute inset-0 overflow-hidden">
          <span className="absolute right-10 top-5 h-60 w-60 rounded-full border border-white/10" />
          <span className="absolute right-20 top-14 h-36 w-36 rounded-full bg-violet-400/20 blur-2xl" />
        </div>
        <span className="relative mb-auto inline-flex w-fit items-center rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          🔥 Featured · {category?.name ?? 'Insights'}
        </span>
        <div className="relative z-10 flex flex-wrap gap-6">
          {(Array.isArray(post.coverStats) ? post.coverStats : []).slice(0, 3).map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const stat = item as { num?: unknown; label?: unknown };
            const num = typeof stat.num === 'string' ? stat.num : `${index + 1}`;
            const label = typeof stat.label === 'string' ? stat.label : 'Metric';
            return (
              <div className="text-center" key={`${num}-${label}-${index}`}>
                <div className="text-3xl font-extrabold leading-none text-white">{num}</div>
                <div className="mt-0.5 text-[10px] text-white/60">{label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col justify-center px-7 py-8 sm:px-11">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-purple">
            {category?.name ?? 'Article'}
          </span>
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
          <span className="h-1 w-1 rounded-full bg-gray-300" />
          <span>{post.readTimeMin} min read</span>
        </div>
        <h2 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-3xl">
          {post.title}
        </h2>
        <p className="mb-6 text-sm leading-7 text-gray-500 sm:text-[15px]">{post.excerpt}</p>
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-pink-500 text-xs font-bold text-white">
            {post.author.initials}
          </span>
          <div>
            <div className="text-sm font-bold text-gray-900">{post.author.name}</div>
            <div className="text-xs text-gray-400">{post.author.role}</div>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white transition hover:scale-[1.03] hover:bg-gray-800">
          Read Article
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white">
            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  category,
  search,
}: {
  page: number;
  totalPages: number;
  category?: string;
  search?: string;
}) {
  if (totalPages <= 1) return null;

  const pageWindow = 2;
  const start = Math.max(1, page - pageWindow);
  const end = Math.min(totalPages, page + pageWindow);
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);

  return (
    <div className="mx-auto mb-24 flex max-w-[1100px] items-center justify-center gap-2 px-6 md:px-12">
      <Link
        href={buildPageHref({ page: Math.max(1, page - 1), category, search })}
        aria-disabled={page <= 1}
        className={[
          'inline-flex h-10 items-center gap-1 rounded-xl border border-gray-200 px-4 text-sm font-semibold',
          page <= 1
            ? 'pointer-events-none bg-gray-50 text-gray-300'
            : 'text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple hover:text-white',
        ].join(' ')}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Prev
      </Link>

      {start > 1 ? (
        <>
          <Link
            href={buildPageHref({ page: 1, category, search })}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple hover:text-white"
          >
            1
          </Link>
          <span className="px-1 text-sm text-gray-400">…</span>
        </>
      ) : null}

      {pages.map((p) => (
        <Link
          key={p}
          href={buildPageHref({ page: p, category, search })}
          className={[
            'flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold',
            p === page
              ? 'border-brand-purple bg-brand-purple text-white'
              : 'border-gray-200 text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple hover:text-white',
          ].join(' ')}
        >
          {p}
        </Link>
      ))}

      {end < totalPages ? (
        <>
          <span className="px-1 text-sm text-gray-400">…</span>
          <Link
            href={buildPageHref({ page: totalPages, category, search })}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple hover:text-white"
          >
            {totalPages}
          </Link>
        </>
      ) : null}

      <Link
        href={buildPageHref({ page: Math.min(totalPages, page + 1), category, search })}
        aria-disabled={page >= totalPages}
        className={[
          'inline-flex h-10 items-center gap-1 rounded-xl border border-gray-200 px-4 text-sm font-semibold',
          page >= totalPages
            ? 'pointer-events-none bg-gray-50 text-gray-300'
            : 'text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple hover:text-white',
        ].join(' ')}
      >
        Next
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </Link>
    </div>
  );
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = (await searchParams) ?? {};
  const page = Number(params.page) > 0 ? Number(params.page) : 1;

  const [{ posts, total, totalPages }, categories, featuredPost] = await Promise.all([
    getAllPosts({
      status: PostStatus.PUBLISHED,
      categorySlug: params.category,
      search: params.search,
      page,
      perPage: 9,
    }),
    getAllCategories(),
    getFeaturedPost(),
  ]);

  const visiblePosts = featuredPost ? posts.filter((post) => post.id !== featuredPost.id) : posts;

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />

      <main className="overflow-x-hidden bg-white">
        <section className="relative overflow-hidden px-6 pb-8 pt-[88px] text-center md:px-12 md:pb-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,#EDE9FE_0%,#FDF4FF_50%,transparent_75%)]" />
          <div className="relative mx-auto max-w-[760px]">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-purple/25 bg-white/90 px-4 py-1.5 text-[14px] font-semibold text-violet-700">
              <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-2 15H8v-2h4v2zm3-4H8v-2h7v2zm0-4H8V7h7v2z" />
              </svg>
              RingBooker Growth Resources
            </span>
            <h1 className="mb-4 text-[clamp(38px,5vw,58px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-gray-900">
              Grow Your Salon with
              <br />
              AI-Powered Insights
            </h1>
            <p className="mx-auto mb-8 max-w-[560px] text-base leading-7 text-gray-500 sm:text-[17px]">
              Practical guides, case studies, and playbooks for appointment-based businesses to capture more calls,
              book more clients, and grow revenue.
            </p>
          </div>

          <SearchBar initialValue={params.search ?? ''} />
          <CategoryFilter categories={categories} />
        </section>

        <div className="mx-auto max-w-[1100px] px-6 md:px-12">
          {featuredPost ? <FeaturedPost post={featuredPost} /> : null}

          <div className="mb-7 flex items-baseline justify-between">
            <h2 className="text-[22px] font-extrabold tracking-tight text-gray-900">Latest Articles</h2>
            <div className="text-sm text-gray-500">
              {total} result{total === 1 ? '' : 's'}
            </div>
          </div>

          {visiblePosts.length > 0 ? (
            <div className="mb-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visiblePosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="mb-14 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              No posts found for this filter. Try another category or search query.
            </div>
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} category={params.category} search={params.search} />

        <section className="px-6 pb-14 md:px-12">
          <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-brand-purple to-violet-400 px-6 py-14 text-center md:px-12">
            <span className="pointer-events-none absolute -right-16 -top-20 h-[300px] w-[300px] rounded-full bg-white/5" />
            <h2 className="mb-2 text-[clamp(26px,3vw,38px)] font-extrabold tracking-tight text-white">
              Ready to stop missing bookings?
            </h2>
            <p className="mb-7 text-[15px] text-white/75">
              Join salon teams using RingBooker to answer every call and fill every chair.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/user/signup"
                className="inline-flex items-center rounded-full bg-white px-7 py-3 text-sm font-bold text-violet-700 transition hover:scale-[1.04]"
              >
                Start 14-Day Free Trial →
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center rounded-full border border-white/30 bg-white/15 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/25"
              >
                📞 Try a Live Demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
