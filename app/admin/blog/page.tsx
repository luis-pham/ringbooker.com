import Link from 'next/link';
import { PostStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { deletePost, publishPost } from '@/app/admin/blog/actions';
import { BLOG_PATH_PREFIX_LABEL, type BlogPathPrefix, postPublicPath } from '@/lib/blog/path-prefixes';
import { prisma } from '@/lib/prisma';

const PAGE_SIZE = 20;

const POST_STATUS_OPTIONS: readonly PostStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

const STATUS_LABEL: Record<PostStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

const statusBadgeClass: Record<PostStatus, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-slate-200 text-slate-700',
};

export const metadata = {
  title: 'Admin Blog',
};

export const dynamic = 'force-dynamic';

function formatDate(date: Date | null) {
  if (!date) return 'Not published';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(date);
}

function clusterLabel(pathPrefix: string): string {
  return BLOG_PATH_PREFIX_LABEL[pathPrefix as BlogPathPrefix] ?? pathPrefix;
}

function buildBlogListHref(opts: { cluster: string; page: number; status?: PostStatus }): string {
  const params = new URLSearchParams();
  if (opts.cluster.trim()) params.set('cluster', opts.cluster.trim());
  if (opts.status) params.set('status', opts.status);
  if (opts.page > 1) params.set('page', String(opts.page));
  const q = params.toString();
  return q ? `/admin/blog?${q}` : '/admin/blog';
}

/** Compact page list with ellipses when there are many pages. */
function buildPageNumbers(totalPages: number, current: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const candidates = [1, totalPages, current, current - 1, current + 1];
  const sorted = [...new Set(candidates)]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) {
      out.push('ellipsis');
    }
    out.push(n);
  }
  return out;
}

type AdminBlogPageProps = {
  searchParams?: Promise<{ cluster?: string; page?: string; status?: string }>;
};

export default async function AdminBlogPage(props: AdminBlogPageProps) {
  const raw = (await props.searchParams) ?? {};
  /** Query `cluster` = Post.pathPrefix (public URL segment before slug). */
  const cluster = typeof raw.cluster === 'string' ? raw.cluster.trim() : '';
  const statusRaw = typeof raw.status === 'string' ? raw.status.trim().toUpperCase() : '';
  const parsedPage = Number.parseInt(String(raw.page ?? '1'), 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const distinctRows = await prisma.post.findMany({
    distinct: ['pathPrefix'],
    select: { pathPrefix: true },
    orderBy: { pathPrefix: 'asc' },
  });

  const clusterOptions = distinctRows.map((r) => r.pathPrefix);
  const clusterRaw = cluster;
  const clusterActive = clusterRaw && clusterOptions.includes(clusterRaw) ? clusterRaw : '';
  const clusterFilterInvalid = Boolean(clusterRaw && !clusterOptions.includes(clusterRaw));
  const statusActive = (POST_STATUS_OPTIONS as readonly string[]).includes(statusRaw)
    ? (statusRaw as PostStatus)
    : undefined;
  const statusFilterInvalid = Boolean(statusRaw && !statusActive);

  const where: Prisma.PostWhereInput = {};
  if (clusterActive) where.pathPrefix = clusterActive;
  if (statusActive) where.status = statusActive;

  const total = await prisma.post.count({ where });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;

  const posts = await prisma.post.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      pathPrefix: true,
      slug: true,
      status: true,
      featured: true,
      publishedAt: true,
      updatedAt: true,
      views: true,
      redirectTo: true,
    },
  });

  const showingFrom = total === 0 ? 0 : skip + 1;
  const showingTo = Math.min(skip + posts.length, total);

  return (
    <main className="mx-auto w-[80%] min-w-0 px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Blog posts</h1>
          <p className="mt-1 text-sm text-slate-600">Manage content, publishing status, and post updates.</p>
        </div>
        <Link href="/admin/blog/new" className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          New post
        </Link>
      </div>

      {clusterFilterInvalid ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No posts use cluster <span className="font-mono font-semibold">{clusterRaw}</span>. Showing all posts in the selected status (if any).{' '}
          <Link
            href={buildBlogListHref({ cluster: '', page: 1, status: statusActive })}
            className="font-semibold text-amber-950 underline"
          >
            Reset cluster filter
          </Link>
        </p>
      ) : null}

      {statusFilterInvalid ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Unknown status <span className="font-mono font-semibold">{statusRaw || '—'}</span>. Ignoring status filter.{' '}
          <Link
            href={buildBlogListHref({ cluster: clusterActive, page: 1 })}
            className="font-semibold text-amber-950 underline"
          >
            Remove from URL
          </Link>
        </p>
      ) : null}

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-blog-cluster" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cluster (path)
          </label>
          <select
            id="admin-blog-cluster"
            name="cluster"
            defaultValue={clusterActive}
            className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="">All clusters</option>
            {clusterOptions.map((p) => (
              <option key={p} value={p}>
                {clusterLabel(p)} ({p})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="admin-blog-status" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </label>
          <select
            id="admin-blog-status"
            name="status"
            defaultValue={statusActive ?? ''}
            className="min-w-[180px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            <option value="">All statuses</option>
            {POST_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100">
          Apply filter
        </button>
        {clusterActive ? (
          <Link
            href={buildBlogListHref({ cluster: '', page: 1, status: statusActive })}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 hover:underline"
          >
            Clear cluster
          </Link>
        ) : null}
        {statusActive ? (
          <Link
            href={buildBlogListHref({ cluster: clusterActive, page: 1 })}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 hover:underline"
          >
            Clear status
          </Link>
        ) : null}
      </form>

      <p className="mb-3 text-sm text-slate-600">
        {total === 0 ? (
          'No posts match this filter.'
        ) : (
          <>
            Showing <span className="font-semibold text-slate-900">{showingFrom}</span>–
            <span className="font-semibold text-slate-900">{showingTo}</span> of{' '}
            <span className="font-semibold text-slate-900">{total}</span>
        {clusterActive ? (
          <>
            {' '}
            · cluster: <span className="font-mono text-xs text-slate-700">{clusterActive}</span>
          </>
        ) : null}
        {statusActive ? (
          <>
            {' '}
            · status: <span className="font-semibold text-slate-800">{STATUS_LABEL[statusActive]}</span>
          </>
        ) : null}
          </>
        )}
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Post</th>
              <th className="px-4 py-3">Cluster</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posts.map((post) => (
              <tr key={post.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{post.title}</p>
                  <p className="font-mono text-xs text-slate-500">{postPublicPath(post.pathPrefix, post.slug)}</p>
                  {post.redirectTo?.trim() ? (
                    <p className="mt-1 font-mono text-xs text-amber-800">
                      → <span className="font-semibold">Redirect</span> to {post.redirectTo.trim()}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">
                    Updated{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(post.updatedAt)}
                  </p>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-slate-700">{post.pathPrefix}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass[post.status]}`}>{post.status}</span>
                  {post.featured ? <p className="mt-1 text-xs font-medium text-violet-700">Featured</p> : null}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{formatDate(post.publishedAt)}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{post.views.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                    {post.status !== 'PUBLISHED' ? (
                      <form action={publishPost.bind(null, post.id)}>
                        <button
                          type="submit"
                          className="rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        >
                          Publish
                        </button>
                      </form>
                    ) : null}
                    <Link
                      href={postPublicPath(post.pathPrefix, post.slug)}
                      target="_blank"
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      View
                    </Link>
                    <form action={deletePost.bind(null, post.id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                  No posts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4" aria-label="Blog list pagination">
          <p className="text-sm text-slate-600">
            Page <span className="font-semibold text-slate-900">{safePage}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {safePage > 1 ? (
              <Link
                href={buildBlogListHref({ cluster: clusterActive, page: safePage - 1, status: statusActive })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400">Previous</span>
            )}
            {buildPageNumbers(totalPages, safePage).map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <span key={item}>
                  {item === safePage ? (
                    <span className="inline-block min-w-[2.25rem] rounded-lg bg-violet-100 px-3 py-2 text-center text-sm font-bold text-violet-900">{item}</span>
                  ) : (
                    <Link
                      href={buildBlogListHref({ cluster: clusterActive, page: item, status: statusActive })}
                      className="inline-block min-w-[2.25rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      {item}
                    </Link>
                  )}
                </span>
              ),
            )}
            {safePage < totalPages ? (
              <Link
                href={buildBlogListHref({ cluster: clusterActive, page: safePage + 1, status: statusActive })}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                Next
              </Link>
            ) : (
              <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-400">Next</span>
            )}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
