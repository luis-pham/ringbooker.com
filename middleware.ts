import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const USER_SESSION_COOKIE = 'rb_user_session';
const ADMIN_SESSION_COOKIE = 'rb_admin_session';

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

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-site');
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
  const isUserRoute = pathname.startsWith('/user');
  const isAdminRoute = pathname.startsWith('/admin');
  const isUserLogin = pathname === '/user/login';
  const isUserSignup = pathname === '/user/signup';
  const isUserPasswordRecovery = pathname === '/user/forgot-password' || pathname === '/user/reset-password';
  const isAdminLogin = pathname === '/admin/login';
  const isAdminPasswordRecovery = pathname === '/admin/forgot-password' || pathname === '/admin/reset-password';

  if (!isUserRoute && !isAdminRoute) {
    return withSecurityHeaders(NextResponse.next());
  }

  const userToken = req.cookies.get(USER_SESSION_COOKIE)?.value ?? null;
  const adminToken = req.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? null;
  const userSessionValid = await hasValidRoleToken(userToken, 'user');
  const adminSessionValid = await hasValidRoleToken(adminToken, 'admin');

  if (isUserRoute) {
    if (isUserLogin || isUserSignup || isUserPasswordRecovery) {
      if (userSessionValid) {
        return withSecurityHeaders(NextResponse.redirect(new URL('/user', req.url)));
      }
      return withSecurityHeaders(NextResponse.next());
    }
    if (!userSessionValid) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/user/login', req.url)));
    }
  }

  if (isAdminRoute) {
    if (isAdminLogin || isAdminPasswordRecovery) {
      if (adminSessionValid) {
        return withSecurityHeaders(NextResponse.redirect(new URL('/admin', req.url)));
      }
      return withSecurityHeaders(NextResponse.next());
    }
    if (!adminSessionValid) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/admin/login', req.url)));
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
