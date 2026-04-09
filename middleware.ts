import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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
    const verified = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return verified.payload.role === role && typeof verified.payload.email === 'string' && verified.payload.email.length > 0;
  } catch {
    return false;
  }
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
