import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import { verifyTelnyxSignature } from '@/src/backend/security/telnyx-signature';

const body = '{"data":{"id":"1","event_type":"call.initiated"}}';

test('verifyTelnyxSignature accepts Ed25519 PEM public key (production-style)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const sig = sign(null, Buffer.from(`${timestamp}|${body}`, 'utf8'), privateKey).toString('base64');

  assert.equal(
    verifyTelnyxSignature({ body, timestamp, signature: sig, publicKey: pem, maxSkewSeconds: 300 }),
    true,
  );
});

test('verifyTelnyxSignature accepts Mission Control raw Ed25519 public key (base64 of 32 bytes)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const raw32 = der.subarray(-32);
  const rawB64 = raw32.toString('base64');
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const sig = sign(null, Buffer.from(`${timestamp}|${body}`, 'utf8'), privateKey).toString('base64');

  assert.equal(
    verifyTelnyxSignature({ body, timestamp, signature: sig, publicKey: rawB64, maxSkewSeconds: 300 }),
    true,
  );
});

test('verifyTelnyxSignature rejects wrong signature', () => {
  const { publicKey } = generateKeyPairSync('ed25519');
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const { privateKey: otherPriv } = generateKeyPairSync('ed25519');
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const sig = sign(null, Buffer.from(`${timestamp}|${body}`, 'utf8'), otherPriv).toString('base64');

  assert.equal(
    verifyTelnyxSignature({ body, timestamp, signature: sig, publicKey: pem, maxSkewSeconds: 300 }),
    false,
  );
});
