import { createPublicKey, createVerify, verify as cryptoVerify } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

/**
 * SPKI prefix for a 32-byte Ed25519 raw public key (RFC 8410).
 * Mission Control often shows only the base64 of these 32 bytes — not PEM.
 */
const ED25519_RAW_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function parseTelnyxPublicKey(publicKey: string): KeyObject {
  const trimmed = publicKey.trim();
  if (trimmed.includes('BEGIN')) {
    return createPublicKey(trimmed);
  }
  const der = Buffer.from(trimmed, 'base64');
  if (der.length === 32) {
    return createPublicKey({ key: Buffer.concat([ED25519_RAW_SPKI_PREFIX, der]), format: 'der', type: 'spki' });
  }
  return createPublicKey({ key: der, format: 'der', type: 'spki' });
}

export function verifyTelnyxSignature(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  publicKey: string;
  maxSkewSeconds?: number;
}): boolean {
  const { body, timestamp, signature, publicKey, maxSkewSeconds = 300 } = input;
  if (!timestamp || !signature) return false;
  const rawTs = Number(timestamp);
  if (!Number.isFinite(rawTs)) return false;
  const ts = rawTs > 1_000_000_000_000 ? Math.floor(rawTs / 1000) : rawTs;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > maxSkewSeconds) return false;

  const signedPayload = `${timestamp}|${body}`;
  const message = Buffer.from(signedPayload, 'utf8');
  const sigBuf = Buffer.from(signature, 'base64');

  let key: KeyObject;
  try {
    key = parseTelnyxPublicKey(publicKey);
  } catch {
    return false;
  }

  try {
    if (key.asymmetricKeyType === 'ed25519') {
      return cryptoVerify(null, message, key, sigBuf);
    }
    const verifier = createVerify('sha256');
    verifier.update(signedPayload);
    verifier.end();
    return verifier.verify(key, sigBuf);
  } catch {
    return false;
  }
}
