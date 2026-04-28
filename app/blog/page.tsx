import type { Metadata } from 'next';
import { PostStatus } from '@prisma/client';
import Link from 'next/link';

import { CategoryFilter } from '@/components/blog/CategoryFilter';
import { PostCard } from '@/components/blog/PostCard';
import { DemoCtaPhoneIcon } from '@/components/marketing/demo-cta-phone-icon';
import { MarketingFaqAccordion, type MarketingFaqItem } from '@/components/marketing/marketing-faq-accordion';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { getAllCategories, getAllPosts, getFeaturedPost } from '@/lib/blog';
import { getBlogIndexSeoDirectives } from '@/lib/blog/blog-index-seo';
import { BLOG_PATH_PREFIX_LABEL, isBlogPathPrefix, postPublicPath } from '@/lib/blog/path-prefixes';
import { buildMetadata } from '@/lib/site';
import { buildFaqPageJsonLd } from '@/lib/seo/faq-page-jsonld';
import type { PostWithRelations } from '@/types/blog';

const BLOG_INDEX_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: 'What topics does the RingBooker blog cover?',
    a: 'Practical guides for appointment-based businesses: capturing more calls, after-hours and overflow coverage, missed-call follow-up, booking workflows, and revenue protection ideas for salons, spas, and clinics.',
  },
  {
    q: 'How do I find articles for my business type?',
    a: 'Use category filters and search on this page, or browse industry hubs and topic hubs linked from the site navigation.',
  },
  {
    q: 'Are blog articles the same as product documentation?',
    a: 'Blog posts are educational. For setup steps, billing, and account help, use FAQ, contact, or in-app help when you are logged in.',
  },
  {
    q: 'How often is the blog updated?',
    a: 'New guides publish as they are ready. Featured and latest posts appear on this page when available.',
  },
  {
    q: 'Can I try RingBooker without reading every article?',
    a: 'Yes. Start with a live demo call or the pricing page, then come back to the blog for deeper playbooks when you want them.',
  },
];

const blogIndexFaqJsonLd = buildFaqPageJsonLd(BLOG_INDEX_FAQ_ITEMS);

const blogDescription =
  'Practical guides and tips for appointment-based businesses to capture more calls, book more appointments, and increase revenue with AI.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{
    category?: string;
    search?: string;
    page?: string;
    cluster?: string;
  }>;
}): Promise<Metadata> {
  const params = (await searchParams) ?? {};
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const rawCluster = typeof params.cluster === 'string' ? params.cluster.trim() : '';
  const listPathPrefix = isBlogPathPrefix(rawCluster) ? rawCluster : 'blog';
  const clusterQuery = listPathPrefix === 'blog' ? undefined : listPathPrefix;

  const titleStem =
    listPathPrefix === 'blog'
      ? 'Blog | Growth Resources'
      : `${BLOG_PATH_PREFIX_LABEL[listPathPrefix]} | Growth Resources`;
  const title = page > 1 ? `${titleStem} · Page ${page}` : titleStem;

  const baseMetadata = buildMetadata({
    title,
    description: blogDescription,
    path: '/blog',
  });
  const seo = getBlogIndexSeoDirectives(params);
  return {
    ...baseMetadata,
    robots: seo.robots,
    alternates: {
      ...baseMetadata.alternates,
      canonical: seo.canonical,
    },
  };
}

interface BlogPageProps {
  searchParams?: Promise<{
    category?: string;
    search?: string;
    page?: string;
    /** Topic cluster (`Post.pathPrefix`), e.g. `missed-booking-protection`. Default: `blog`. */
    cluster?: string;
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
  cluster,
}: {
  page: number;
  category?: string;
  search?: string;
  /** Omit or `blog` → default growth blog listing (clean URL). */
  cluster?: string;
}) {
  const params = new URLSearchParams();
  const c = cluster?.trim();
  if (c && c !== 'blog') params.set('cluster', c);
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query.length > 0 ? `/blog?${query}` : '/blog';
}

function FeaturedPost({ post }: { post: PostWithRelations }) {
  const category = post.categories[0]?.category;
  const stats = (Array.isArray(post.coverStats) ? post.coverStats : []).slice(0, 3);

  return (
    <Link
      href={postPublicPath(post.pathPrefix, post.slug)}
      className="mb-14 block overflow-hidden rounded-[var(--mk-radius-panel)] border border-[color:var(--mk-border-soft)] bg-white px-7 py-8 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--mk-shadow-hover)] sm:px-11 sm:py-10"
    >
      <span className="mb-5 inline-flex w-fit items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-brand-purple">
        🔥 Featured · {category?.name ?? 'Insights'}
      </span>
      {stats.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-8 border-b border-gray-100 pb-6">
          {stats.map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const stat = item as { num?: unknown; label?: unknown };
            const num = typeof stat.num === 'string' ? stat.num : `${index + 1}`;
            const label = typeof stat.label === 'string' ? stat.label : 'Metric';
            return (
              <div className="text-center" key={`${num}-${label}-${index}`}>
                <div className="text-2xl font-extrabold leading-none text-gray-900 sm:text-3xl">{num}</div>
                <div className="mt-1 text-[11px] font-medium text-gray-400">{label}</div>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-400">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-purple">
          {category?.name ?? 'Article'}
        </span>
        <span className="h-1 w-1 rounded-full bg-gray-300" />
        <span>{formatDate(post.publishedAt ?? post.createdAt)}</span>
        <span className="h-1 w-1 rounded-full bg-gray-300" />
        <span>{post.readTimeMin} min read</span>
      </div>
      <h2 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 md:text-3xl">{post.title}</h2>
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
    </Link>
  );
}

function Pagination({
  page,
  totalPages,
  category,
  search,
  cluster,
}: {
  page: number;
  totalPages: number;
  category?: string;
  search?: string;
  cluster?: string;
}) {
  if (totalPages <= 1) return null;

  const pageWindow = 2;
  const start = Math.max(1, page - pageWindow);
  const end = Math.min(totalPages, page + pageWindow);
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);

  return (
    <div className="mx-auto mb-24 flex max-w-6xl items-center justify-center gap-2 px-6 md:px-12">
      <Link
        href={buildPageHref({ page: Math.max(1, page - 1), category, search, cluster })}
        rel="nofollow"
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
            href={buildPageHref({ page: 1, category, search, cluster })}
            rel="nofollow"
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
          href={buildPageHref({ page: p, category, search, cluster })}
          rel="nofollow"
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
            href={buildPageHref({ page: totalPages, category, search, cluster })}
            rel="nofollow"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple hover:text-white"
          >
            {totalPages}
          </Link>
        </>
      ) : null}

      <Link
        href={buildPageHref({ page: Math.min(totalPages, page + 1), category, search, cluster })}
        rel="nofollow"
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
  const rawCluster = typeof params.cluster === 'string' ? params.cluster.trim() : '';
  const listPathPrefix = isBlogPathPrefix(rawCluster) ? rawCluster : 'blog';
  const clusterQuery = listPathPrefix === 'blog' ? undefined : listPathPrefix;

  const [{ posts, total, totalPages }, categories, featuredPost] = await Promise.all([
    getAllPosts({
      status: PostStatus.PUBLISHED,
      pathPrefix: listPathPrefix,
      categorySlug: params.category,
      search: params.search,
      page,
      perPage: 9,
    }),
    getAllCategories({ pathPrefix: listPathPrefix }),
    getFeaturedPost({ pathPrefix: listPathPrefix }),
  ]);

  const visiblePosts = featuredPost ? posts.filter((post) => post.id !== featuredPost.id) : posts;

  return (
    <>
      <MarketingChromeStyles />
      <MarketingHeader />

      <main className="overflow-x-hidden bg-white">
        <section className="relative overflow-hidden px-6 pb-8 pt-[96px] text-center md:px-12 md:pb-12 md:pt-[88px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_-10%,#EDE9FE_0%,#FDF4FF_50%,transparent_75%)]" />
          <div className="relative mx-auto max-w-6xl">
            <nav aria-label="Breadcrumb" className="mb-4 text-left text-[14px] leading-[1.35] text-[color:var(--mk-text-soft,#94a3b8)]">
              <a href="/" className="font-normal text-[color:var(--mk-text-soft,#94a3b8)] no-underline transition hover:text-violet-600">Home</a>
              <span className="mx-1.5">›</span>
              <span className="font-normal text-[color:var(--mk-text-soft,#94a3b8)]">Blog</span>
            </nav>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--mk-border-brand)] bg-white/90 px-4 py-1.5 text-[14px] font-semibold text-[color:var(--mk-brand-purple-deep)]">
              <svg viewBox="0 0 24 24" className="h-[13px] w-[13px] fill-current">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-2 15H8v-2h4v2zm3-4H8v-2h7v2zm0-4H8V7h7v2z" />
              </svg>
              RingBooker Growth Resources
            </span>
            <h1 className="mb-4 text-[clamp(38px,5vw,58px)] font-extrabold leading-[1.1] tracking-[-0.04em] text-[color:var(--mk-text-strong)]">
              Grow Your Salon with
              <br />
              AI-Powered Insights
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-base leading-7 text-[color:var(--mk-text-muted)] sm:text-[17px]">
              Practical guides, case studies, and playbooks for appointment-based businesses to capture more calls,
              book more clients, and grow revenue.
            </p>
          </div>

          <CategoryFilter categories={categories} />
        </section>

        <div className="mx-auto max-w-6xl px-6 md:px-12">
          {featuredPost ? <FeaturedPost post={featuredPost} /> : null}

          <div className="mb-7 flex flex-col items-start gap-2 sm:flex-row sm:items-baseline sm:justify-between">
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
            <div className="mb-14 rounded-[var(--mk-radius-panel)] border border-dashed border-[color:var(--mk-border-strong)] bg-white p-10 text-center text-[color:var(--mk-text-muted)]">
              No posts found for this filter. Try another category or search query.
            </div>
          )}
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          category={params.category}
          search={params.search}
          cluster={clusterQuery}
        />

        <MarketingFaqAccordion
          items={BLOG_INDEX_FAQ_ITEMS}
          eyebrow="Common Questions"
          title="About this blog"
          subtitle={null}
          embedded
        />

        <section className="px-6 pb-14 md:px-12">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[var(--mk-radius-panel)] bg-gradient-to-r from-violet-700 via-brand-purple to-violet-400 px-6 py-14 text-center shadow-[var(--mk-shadow-soft)] md:px-12">
            <span className="pointer-events-none absolute -right-16 -top-20 h-[300px] w-[300px] rounded-full bg-white/5" />
            <h2 className="mb-2 text-[clamp(26px,3vw,38px)] font-extrabold tracking-tight text-white">
              Ready to stop missing bookings?
            </h2>
            <p className="mb-7 text-[15px] text-white/75">
              Join salon teams using RingBooker to answer every call and fill every chair.
            </p>
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-extrabold text-violet-800 shadow-md shadow-black/15 transition hover:scale-[1.04]"
                data-demo-picker
              >
                <DemoCtaPhoneIcon width={18} height={18} />
                Try a Live Demo
              </Link>
              <Link
                href="/user/signup"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Start 14-Day Free Trial →
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
      {blogIndexFaqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogIndexFaqJsonLd) }} />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://ringbooker.com/' },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://ringbooker.com/blog' },
            ],
          }),
        }}
      />
    </>
  );
}
