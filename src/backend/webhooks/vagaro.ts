import { createHmac, timingSafeEqual } from 'node:crypto';

function timingSafeEqualString(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Verifies the optional `X-Vagaro-Signature` header against the per-shop webhook token
 * (used as the HMAC secret). The webhook ingestion itself lives in `api/app.ts`
 * (`/webhooks/vagaro` + `/webhooks/vagaro/:token`): the per-shop token is the primary
 * auth and this HMAC is enforced only when the signature header is present.
 */
export function verifyVagaroWebhookHmac(params: {
  rawBody: string;
  secret: string;
  signature?: string | null;
}): boolean {
  const signature = params.signature?.trim();
  const secret = params.secret.trim();
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(params.rawBody).digest('hex');
  const normalizedCandidates = [
    signature,
    signature.replace(/^sha256=/i, ''),
    signature.replace(/^hmac-sha256=/i, ''),
  ].map((value) => value.trim().toLowerCase());
  return normalizedCandidates.some((candidate) => /^[a-f0-9]{64}$/.test(candidate) && timingSafeEqualString(candidate, expected));
}
