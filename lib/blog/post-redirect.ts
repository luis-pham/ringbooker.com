import { postPublicPath } from '@/lib/blog/path-prefixes';

/** Normalize admin input; returns `null` when empty or invalid (open-redirect safe: path only, no `//`). */
export function normalizePostRedirectTo(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (v.length > 2048) return null;
  if (!v.startsWith('/') || v.startsWith('//')) return null;
  if (/[\x00-\x1f\x7f]/.test(v)) return null;
  return v;
}

/**
 * Target path for `permanentRedirect`, or `null` if unset, invalid, or same pathname as this post (no loop).
 */
export function resolvePostRedirectTargetOrNull(
  redirectTo: string | null | undefined,
  pathPrefix: string,
  slug: string,
): string | null {
  const target = normalizePostRedirectTo(redirectTo);
  if (!target) return null;
  let pathname: string;
  try {
    pathname = new URL(target, 'https://placeholder.invalid').pathname;
  } catch {
    return null;
  }
  const selfPath = postPublicPath(pathPrefix, slug.trim().toLowerCase());
  if (pathname === selfPath) return null;
  return target;
}
