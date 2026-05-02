/**
 * Prefer API `message` when present; map stable `error` codes for display.
 * Keep this file free of server-only imports so client components can use it.
 */
const RATE_LIMIT_FALLBACK =
  'Too many requests. Please wait a few minutes and try again.';

export function apiUserVisibleMessage(
  body: { message?: string; error?: string } | null | undefined,
  fallback: string,
): string {
  const m = body?.message;
  if (typeof m === 'string' && m.trim()) return m.trim();
  if (body?.error === 'rate_limited') return RATE_LIMIT_FALLBACK;
  const e = body?.error;
  if (typeof e === 'string' && e.trim()) return e.trim();
  return fallback;
}
