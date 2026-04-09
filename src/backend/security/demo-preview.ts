import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

type DemoPreviewPayload = JWTPayload & {
  scope: 'demo_preview';
  requestId: string;
  shopId: string;
  callerPhone: string;
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

export async function signDemoPreviewToken(input: {
  requestId: string;
  shopId: string;
  callerPhone: string;
  ttlMinutes?: number;
}) {
  const ttlMinutes = input.ttlMinutes && input.ttlMinutes > 0 ? input.ttlMinutes : 30;
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    scope: 'demo_preview',
    requestId: input.requestId,
    shopId: input.shopId,
    callerPhone: input.callerPhone,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlMinutes * 60)
    .sign(getSigningKey());
}

export async function verifyDemoPreviewToken(token: string): Promise<DemoPreviewPayload | null> {
  try {
    const verified = await jwtVerify(token, getSigningKey(), {
      algorithms: ['HS256'],
    });
    const payload = verified.payload as DemoPreviewPayload;
    if (payload.scope !== 'demo_preview') return null;
    if (typeof payload.requestId !== 'string' || payload.requestId.length === 0) return null;
    if (typeof payload.shopId !== 'string' || payload.shopId.length === 0) return null;
    if (typeof payload.callerPhone !== 'string' || payload.callerPhone.length === 0) return null;
    return payload;
  } catch {
    return null;
  }
}
