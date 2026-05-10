import 'server-only';

import { cookies } from 'next/headers';

import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';

function buildCookieHeader(cookieStore: Awaited<ReturnType<typeof cookies>>): string {
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export async function fetchUserBackendJson<T>(path: string): Promise<T | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = buildCookieHeader(cookieStore);
    const response = await getBackendRuntime().app.request(path, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchUserBackendJsonMap<T extends Record<string, string>>(
  paths: T,
): Promise<{ [K in keyof T]: unknown | null }> {
  const entries = await Promise.all(
    Object.entries(paths).map(async ([key, path]) => [key, await fetchUserBackendJson<unknown>(path)] as const),
  );
  return Object.fromEntries(entries) as { [K in keyof T]: unknown | null };
}
