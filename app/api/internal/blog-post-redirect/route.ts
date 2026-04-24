import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { resolveBlogPostPermanentRedirectPath } from '@/lib/blog/resolve-blog-post-redirect-from-pathname';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Internal JSON helper for middleware: `{ redirect: string | null }`.
 * Not a secret surface: only mirrors public CMS `redirectTo` data.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  if (!path || !path.startsWith('/')) {
    return NextResponse.json({ redirect: null });
  }
  try {
    const redirect = await resolveBlogPostPermanentRedirectPath(path);
    return NextResponse.json({ redirect });
  } catch {
    return NextResponse.json({ redirect: null });
  }
}
