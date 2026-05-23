import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export type SessionRole = 'user' | 'admin';

export type SessionPayload = JWTPayload & {
  role: SessionRole;
  email: string;
  shopId?: string;
  emailVerified?: boolean;
};

function getSigningKey(): Uint8Array {
  const secret = process.env.APP_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return new TextEncoder().encode('development-only-insecure-signing-secret-please-override');
    }
    throw new Error('invalid_signing_secret');
  }
  return new TextEncoder().encode(secret);
}

export const USER_SESSION_COOKIE = 'rb_user_session';
export const ADMIN_SESSION_COOKIE = 'rb_admin_session';

export async function signSessionToken(input: {
  role: SessionRole;
  email: string;
  shopId?: string;
  emailVerified?: boolean;
  ttlHours?: number;
}): Promise<string> {
  const ttlHours = input.ttlHours && input.ttlHours > 0 ? input.ttlHours : 24;
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    role: input.role,
    email: input.email,
    ...(input.shopId ? { shopId: input.shopId } : {}),
    ...(input.emailVerified !== undefined ? { emailVerified: input.emailVerified } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlHours * 3600)
    .sign(getSigningKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, getSigningKey(), {
      algorithms: ['HS256'],
    });
    const payload = verified.payload as SessionPayload;
    if (payload.role !== 'user' && payload.role !== 'admin') return null;
    if (typeof payload.email !== 'string' || payload.email.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}
