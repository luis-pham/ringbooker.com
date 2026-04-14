import { createHmac, timingSafeEqual } from 'node:crypto';

function decodeWhsec(secret: string): Buffer {
  const trimmed = secret.trim();
  if (trimmed.startsWith('whsec_')) {
    return Buffer.from(trimmed.slice('whsec_'.length), 'base64');
  }
  return Buffer.from(trimmed, 'utf8');
}

/** Decode Standard Webhooks symmetric secret (`whsec_` + base64). */
export function decodeOpenAiWebhookSecret(secret: string): Buffer {
  return decodeWhsec(secret);
}

/**
 * Verify OpenAI / Standard Webhooks symmetric signature (v1, HMAC-SHA256).
 * @see https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
 */
export function verifyOpenAiStandardWebhookV1(params: {
  rawBody: string;
  webhookId: string;
  webhookTimestamp: string;
  signatureHeader: string;
  secret: string;
  maxSkewSeconds: number;
  nowUnixSeconds?: number;
}): boolean {
  const id = params.webhookId.trim();
  if (!id || id.includes('.')) return false;

  const ts = Number(params.webhookTimestamp);
  if (!Number.isFinite(ts) || ts < 0) return false;
  const now = params.nowUnixSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > params.maxSkewSeconds) return false;

  const signedContent = `${id}.${params.webhookTimestamp}.${params.rawBody}`;
  let key: Buffer;
  try {
    key = decodeWhsec(params.secret);
  } catch {
    return false;
  }
  if (key.length < 16) return false;

  const mac = createHmac('sha256', key).update(signedContent, 'utf8').digest();

  const chunks = params.signatureHeader.trim().split(/\s+/);
  for (const chunk of chunks) {
    const comma = chunk.indexOf(',');
    if (comma <= 0) continue;
    const version = chunk.slice(0, comma);
    const sigB64 = chunk.slice(comma + 1);
    if (version !== 'v1' || !sigB64) continue;
    try {
      const sig = Buffer.from(sigB64, 'base64');
      if (sig.length === mac.length && timingSafeEqual(sig, mac)) return true;
    } catch {
      continue;
    }
  }
  return false;
}
