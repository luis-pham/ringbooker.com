import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PostStatus } from '@prisma/client';

import { ReadingProgressBar } from '@/components/blog/ReadingProgressBar';
import { ShareButtons } from '@/components/blog/ShareButtons';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { ViewCounter } from '@/components/blog/ViewCounter';
import { MarketingChromeStyles, MarketingFooter, MarketingHeader } from '@/components/marketing/marketing-chrome';
import { extractToc } from '@/lib/extractToc';
import { getAllPosts, getPostBySlug, getRelatedPosts, incrementPostViews } from '@/lib/blog';
import { renderMarkdownToSafeHtml } from '@/lib/blog/markdown';

type RouteParams = { slug: string };
type RouteProps = { params: Promise<RouteParams> };

export const revalidate = 3600;

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

export async function generateStaticParams() {
  if (!hasDatabaseUrl) return [];
  try {
    const { posts } = await getAllPosts({ status: PostStatus.PUBLISHED, perPage: 100 });
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  if (!hasDatabaseUrl) return { title: 'RingBooker Blog' };
  const { slug } = await params;
  const post = await getPostBySlug(slug).catch(() => null);
  if (!post) return { title: 'Post Not Found' };

  return {
    title: `${post.title} — RingBooker Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.author.name],
    },
    twitter: { card: 'summary_large_image' },
  };
}

function formatDate(value: Date | null | undefined): string {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(value);
}

export default async function BlogPostPage({ params }: RouteProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const categoryIds = post.categories.map((c) => c.categoryId);
  const relatedPosts = await getRelatedPosts(post.id, categoryIds, 3);
  const toc = extractToc(post.content);

  void incrementPostViews(slug).catch(() => undefined);

  const primaryCategory = post.categories[0]?.category?.name ?? 'Article';
  const stats = Array.isArray(post.coverStats)
    ? post.coverStats
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const stat = item as { num?: unknown; label?: unknown };
          if (typeof stat.num !== 'string' || typeof stat.label !== 'string') return null;
          return { num: stat.num, label: stat.label };
        })
        .filter((item): item is { num: string; label: string } => Boolean(item))
    : [];

  const safeArticleHtml = renderMarkdownToSafeHtml(post.content);

  return (
    <>
      <ReadingProgressBar />
      <MarketingChromeStyles />
      <MarketingHeader />

      <section className="relative overflow-hidden bg-white px-6 pb-0 pt-[110px] md:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-5%,#EDE9FE_0%,transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-[760px]">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <Link href="/" className="text-[13px] font-medium text-gray-500 transition hover:text-brand-purple">
              Home
            </Link>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-400">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
            <Link href="/blog" className="text-[13px] font-medium text-gray-500 transition hover:text-brand-purple">
              Blog
            </Link>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-400">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
            <span className="text-[13px] text-gray-400">{primaryCategory}</span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {post.categories.map((entry) => (
              <Link
                key={entry.categoryId}
                href={`/blog?category=${encodeURIComponent(entry.category.slug)}`}
                className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700"
              >
                {entry.category.name}
              </Link>
            ))}
          </div>

          <h1 className="mb-4 font-serif text-[clamp(28px,4vw,44px)] font-bold leading-[1.18] tracking-tight text-gray-900">
            {post.title}
          </h1>
          <p className="mb-7 text-[17px] leading-[1.72] text-gray-500">{post.excerpt}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-gray-200 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-pink-500 text-sm font-bold text-white">
                {post.author.initials}
              </span>
              <span>
                <span className="block text-sm font-bold text-gray-900">{post.author.name}</span>
                <span className="block text-[12.5px] text-gray-400">
                  Published {formatDate(post.publishedAt)} · Updated {formatDate(post.updatedAt)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 text-[13px] text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-400">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
                <ViewCounter slug={slug} fallback={post.views} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-gray-400">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
                </svg>
                {post.readTimeMin} min read
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[760px] px-6 pt-9 md:px-12">
        <div className="relative flex h-[360px] items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0533] via-[#2d1b69] to-[#4c1d95]">
          <span className="absolute right-16 top-5 h-[300px] w-[300px] rounded-full border border-white/10" />
          <span className="absolute right-24 top-12 h-[180px] w-[180px] rounded-full bg-violet-400/25 blur-[40px]" />
          <div className="relative z-10 flex gap-10">
            {stats.map((item) => (
              <div key={`${item.num}-${item.label}`} className="text-center">
                <div className="text-[52px] font-extrabold leading-none tracking-[-0.04em] text-white">{item.num}</div>
                <div className="mt-1.5 text-xs text-white/60">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-14 px-6 pb-20 pt-12 md:px-12 lg:grid-cols-[1fr_320px]">
        <article className="article-body font-serif text-[17.5px] leading-[1.82] text-gray-700">
          <div
            className="prose prose-lg max-w-none prose-headings:font-sans prose-headings:font-extrabold prose-headings:tracking-tight prose-h2:mt-11 prose-h2:mb-4 prose-h2:text-[clamp(20px,2.2vw,25px)] prose-h3:mt-8 prose-h3:mb-2 prose-h3:text-[18px] prose-p:mb-6 prose-ul:mb-6 prose-ol:mb-6 prose-li:mb-2 prose-a:text-brand-purple prose-strong:text-gray-900"
            dangerouslySetInnerHTML={{ __html: safeArticleHtml }}
          />

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 pt-8 font-sans">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((entry) => (
                <Link
                  key={entry.tagId}
                  href={`/blog?search=${encodeURIComponent(entry.tag.name)}`}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[12.5px] font-semibold text-gray-500 transition hover:border-brand-purple hover:text-brand-purple"
                >
                  {entry.tag.name}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-gray-500">Share:</span>
              <ShareButtons />
            </div>
          </div>
        </article>

        <aside className="article-sidebar sticky top-[88px] hidden lg:block">
          <div className="mb-5 rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-wider text-gray-900">In This Article</h4>
            <TableOfContents toc={toc} />
          </div>

          <div className="mb-5 rounded-3xl bg-gradient-to-br from-violet-900 to-violet-600 p-5 font-sans text-white">
            <h4 className="mb-2 text-[15px] font-bold">Stop missing bookings</h4>
            <p className="mb-4 text-[12.5px] leading-6 text-white/75">
              RingBooker answers every call 24/7 and books the appointment before they hang up.
            </p>
            <Link
              href="/user/signup"
              className="block rounded-[10px] bg-white px-3 py-2.5 text-center text-sm font-bold text-violet-700 transition hover:opacity-90"
            >
              Start 14-Day Free Trial →
            </Link>
            <Link href="/demo" className="mt-2.5 block text-center text-[12.5px] font-medium text-white/70 transition hover:text-white">
              📞 Try a live demo first
            </Link>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
            <h4 className="mb-3.5 font-sans text-[12.5px] font-bold uppercase tracking-wider text-gray-900">Related Articles</h4>
            <div className="space-y-0">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="flex gap-3 border-b border-gray-200 py-2.5 last:border-b-0 hover:opacity-75"
                >
                  <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg">
                    <span className="absolute inset-0 bg-gradient-to-br from-violet-900 to-violet-700" />
                  </span>
                  <span>
                    <span className="block font-sans text-[12.5px] font-semibold leading-5 text-gray-900">{related.title}</span>
                    <span className="mt-0.5 block font-sans text-[11.5px] text-gray-400">{related.readTimeMin} min read</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <section className="mx-auto max-w-[1100px] px-6 pb-20 md:px-12">
        <h2 className="mb-6 font-sans text-[22px] font-extrabold tracking-tight text-gray-900">Keep Reading</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {relatedPosts.map((related) => (
            <Link
              key={related.id}
              href={`/blog/${related.slug}`}
              className="block overflow-hidden rounded-3xl border border-gray-200 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,.07)]"
            >
              <div className="relative h-36 overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-br from-violet-900 to-violet-700" />
                <span className="absolute inset-0 flex items-center justify-center text-3xl opacity-25">📘</span>
              </div>
              <div className="p-4">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-purple">
                  {related.categories[0]?.category.name ?? 'Article'}
                </div>
                <h3 className="mb-2 text-[14.5px] font-bold leading-6 text-gray-900">{related.title}</h3>
                <div className="text-xs text-gray-400">
                  {formatDate(related.publishedAt ?? related.createdAt)} · {related.readTimeMin} min read
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="px-6 pb-14 md:px-12">
        <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-brand-purple to-violet-400 px-6 py-14 text-center md:px-12">
          <span className="pointer-events-none absolute -right-16 -top-20 h-[300px] w-[300px] rounded-full bg-white/5" />
          <h2 className="mb-2 text-[clamp(24px,3vw,36px)] font-sans font-extrabold tracking-tight text-white">
            Ready to stop missing bookings?
          </h2>
          <p className="mb-7 font-sans text-[15px] text-white/75">
            RingBooker answers every call 24/7 — books appointments, sends confirmations, and fills your calendar while you
            focus on your clients.
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

      <MarketingFooter />
    </>
  );
}
