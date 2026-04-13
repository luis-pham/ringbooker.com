import { getPostByPathPrefixAndSlug, incrementPostViews } from '@/lib/blog';

type RouteContext = {
  params: Promise<{ prefix: string; slug: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  const { prefix, slug } = await context.params;
  await incrementPostViews(prefix, slug);
  return Response.json({ ok: true });
}

export async function GET(_req: Request, context: RouteContext) {
  const { prefix, slug } = await context.params;
  const post = await getPostByPathPrefixAndSlug(prefix, slug);
  return Response.json({ views: post?.views ?? 0 });
}
