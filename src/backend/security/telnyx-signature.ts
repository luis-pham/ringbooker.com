import { createVerify } from 'node:crypto';

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
  try {
    const verifier = createVerify('sha256');
    verifier.update(signedPayload);
    verifier.end();
    return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}
