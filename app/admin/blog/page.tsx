import Link from 'next/link';
import { PostStatus } from '@prisma/client';

import { deletePost, publishPost } from '@/app/admin/blog/actions';
import { postPublicPath } from '@/lib/blog/path-prefixes';
import { prisma } from '@/lib/prisma';

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

export default async function AdminBlogPage() {
  const posts = await prisma.post.findMany({
    orderBy: [{ updatedAt: 'desc' }],
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
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Blog posts</h1>
          <p className="mt-1 text-sm text-slate-600">Manage content, publishing status, and post updates.</p>
        </div>
        <Link href="/admin/blog/new" className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          New post
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Post</th>
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
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                  No posts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
