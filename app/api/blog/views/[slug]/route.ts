import { getPostBySlug, incrementPostViews } from '@/lib/blog';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  await incrementPostViews(slug);
  return Response.json({ ok: true });
}

export async function GET(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  const post = await getPostBySlug(slug);
  return Response.json({ views: post?.views ?? 0 });
}
