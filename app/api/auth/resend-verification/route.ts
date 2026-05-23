import { getBackendRuntime } from '@/src/backend/bootstrap/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = '/api/backend/auth/resend-verification';
  const headers = new Headers(request.headers);
  headers.delete('x-rb-remote-addr');
  const platformIpHeader = process.env.RB_PLATFORM_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (platformIpHeader) {
    const platformIp = request.headers.get(platformIpHeader)?.split(',')[0]?.trim();
    if (platformIp) headers.set('x-rb-remote-addr', platformIp);
  }
  return getBackendRuntime().app.fetch(new Request(url, { method: request.method, headers, body: await request.text() }));
}
