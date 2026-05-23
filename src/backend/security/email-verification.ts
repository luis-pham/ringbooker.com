import { createHash, randomBytes } from 'node:crypto';

export const EMAIL_VERIFICATION_TTL_HOURS = 24;

export function hashEmailVerificationToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateVerificationToken(): { raw: string; hashed: string; expiresAt: Date } {
  const raw = randomBytes(32).toString('hex');
  return {
    raw,
    hashed: hashEmailVerificationToken(raw),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 3600_000),
  };
}
