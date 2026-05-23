import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { MARKETING_DEMO_AUDIO_CDN } from '@/lib/marketing/demo-audio-cdn';

const USER_SESSION_COOKIE = 'rb_user_session';
const ADMIN_SESSION_COOKIE = 'rb_admin_session';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // GTM / GA4: https://developers.google.com/tag-platform/security/guides/csp
  [
    "script-src 'self' 'unsafe-inline'",
    'https://challenges.cloudflare.com',
    'https://www.googletagmanager.com',
    'https://tagmanager.google.com',
    'https://www.google-analytics.com',
    'https://cdn.paddle.com',
  ].join(' '),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  `media-src 'self' ${MARKETING_DEMO_AUDIO_CDN}`,
  "font-src 'self' https://fonts.gstatic.com",
  [
    "connect-src 'self'",
    MARKETING_DEMO_AUDIO_CDN,
    'https://*.supabase.co',
    'https://api.telnyx.com',
    'https://api.openai.com',
    'wss://*.telnyx.com',
    'wss://*.openai.com',
    'https://api.resend.com',
    'https://api.paddle.com',
    'https://sandbox-api.paddle.com',
    'https://*.paddle.com',
    'https://challenges.cloudflare.com',
    'https://*.livekit.cloud',
    'wss://*.livekit.cloud',
    'https://*.livekit.io',
    'wss://*.livekit.io',
    'ws://localhost:*',
    'ws://127.0.0.1:*',
    'https://www.google-analytics.com',
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://www.googletagmanager.com',
    'https://*.googletagmanager.com',
    'https://stats.g.doubleclick.net',
  ].join(' '),
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://*.paddle.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.paddle.com",
].join('; ');

function getSigningKey(): Uint8Array | null {
  const secret = process.env.APP_SIGNING_SECRET;
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return new TextEncoder().encode('development-only-insecure-signing-secret-please-override');
  }
  return null;
}

async function hasValidRoleToken(token: string | null, role: 'user' | 'admin'): Promise<boolean> {
  if (!token) return false;
  const key = getSigningKey();
  if (!key) return false;
  try {
    const payload = await verifyHs256Jwt(token, key);
    return payload.role === role && typeof payload.email === 'string' && payload.email.length > 0;
  } catch {
    return false;
  }
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function base64UrlDecodeJson<T>(value: string): T {
  const bytes = base64UrlToUint8Array(value);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

type JwtPayload = {
  role?: unknown;
  email?: unknown;
  exp?: unknown;
};

async function verifyHs256Jwt(token: string, keyBytes: Uint8Array): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('invalid_jwt_format');
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = base64UrlDecodeJson<{ alg?: string }>(headerPart);
  if (header.alg !== 'HS256') {
    throw new Error('invalid_jwt_alg');
  }

  const data = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedSignature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
  const actualSignature = base64UrlToUint8Array(signaturePart);
  if (!timingSafeEqualBytes(actualSignature, expectedSignature)) {
    throw new Error('invalid_jwt_signature');
  }

  const payload = base64UrlDecodeJson<JwtPayload>(payloadPart);
  if (typeof payload.exp === 'number' && payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('jwt_expired');
  }

  return payload;
}

/** CMS `Post.redirectTo` — Next.js `permanentRedirect` only supports 308; middleware issues 301 here. */
async function maybeBlogPostRedirect301(req: NextRequest): Promise<NextResponse | null> {
  if (req.method !== 'GET') return null;
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next')) return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments.length > 3) return null;
  if (segments.length === 3 && segments[0] !== 'industries') return null;

  const checkUrl = new URL('/api/internal/blog-post-redirect', req.nextUrl.origin);
  checkUrl.searchParams.set('path', pathname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(checkUrl, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { redirect?: unknown };
    const target = data.redirect;
    if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return null;
    return NextResponse.redirect(new URL(target, req.url), 301);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function withSecurityHeaders(response: NextResponse, pathname = ''): NextResponse {
  // Client-side navigations keep the first document's Permissions-Policy. If users land on / then
  // `<Link>` to `/demo/*`, microphone would stay disabled unless we allow mic site-wide (except admin).
  const microphonePolicy = pathname.startsWith('/admin') ? 'microphone=()' : 'microphone=(self)';
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', `camera=(), ${microphonePolicy}, geolocation=()`);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  if (response.headers.get('Content-Type')?.includes('text/html')) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const blog301 = await maybeBlogPostRedirect301(req);
  if (blog301) return withSecurityHeaders(blog301, pathname);

  const isUserRoute = pathname.startsWith('/user');
  const isAdminRoute = pathname.startsWith('/admin');
  const isUserLogin = pathname === '/user/login';
  const isUserSignup = pathname === '/user/signup';
  const isUserPasswordRecovery = pathname === '/user/forgot-password' || pathname === '/user/reset-password';
  const isAdminLogin = pathname === '/admin/login';
  const isAdminPasswordRecovery = pathname === '/admin/forgot-password' || pathname === '/admin/reset-password';

  if (!isUserRoute && !isAdminRoute) {
    return withSecurityHeaders(NextResponse.next(), pathname);
  }

  const userToken = req.cookies.get(USER_SESSION_COOKIE)?.value ?? null;
  const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const userSessionValid = await hasValidRoleToken(userToken, 'user');
  const adminSessionValid = await hasValidRoleToken(adminToken, 'admin');

  if (isUserRoute) {
    if (isUserLogin || isUserSignup || isUserPasswordRecovery) {
      if (userSessionValid) {
        return withSecurityHeaders(NextResponse.redirect(new URL('/user', req.url)), pathname);
      }
      return withSecurityHeaders(NextResponse.next(), pathname);
    }
    if (!userSessionValid) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/user/login', req.url)), pathname);
    }
  }

  if (isAdminRoute) {
    if (isAdminLogin || isAdminPasswordRecovery) {
      if (adminSessionValid) {
        return withSecurityHeaders(NextResponse.redirect(new URL('/admin', req.url)), pathname);
      }
      return withSecurityHeaders(NextResponse.next(), pathname);
    }
    if (!adminSessionValid) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/admin/login', req.url)), pathname);
    }
  }

  return withSecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
