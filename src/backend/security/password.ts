import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;
const SALT_LEN = 16;
const PREFIX = 'scrypt';

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [prefix, saltHex, hashHex] = encoded.split('$');
  if (prefix !== PREFIX || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
  const actual = scryptSync(password, salt, KEY_LEN);
  return timingSafeEqual(actual, expected);
}
