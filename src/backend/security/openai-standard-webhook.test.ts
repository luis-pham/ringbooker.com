import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';

import { verifyOpenAiStandardWebhookV1 } from '@/src/backend/security/openai-standard-webhook';

function signV1(params: { rawSecret: Buffer; webhookId: string; webhookTimestamp: string; rawBody: string }): string {
  const signedContent = `${params.webhookId}.${params.webhookTimestamp}.${params.rawBody}`;
  const mac = createHmac('sha256', params.rawSecret).update(signedContent, 'utf8').digest('base64');
  return `v1,${mac}`;
}

test('verifyOpenAiStandardWebhookV1 accepts valid symmetric signature', () => {
  const raw = randomBytes(32);
  const secret = `whsec_${raw.toString('base64')}`;
  const webhookId = 'wh_test_aaaaaaaaaaaaaaaa';
  const webhookTimestamp = '1750287078';
  const rawBody = '{"type":"realtime.call.incoming","data":{"call_id":"c1"}}';
  const sig = signV1({ rawSecret: raw, webhookId, webhookTimestamp, rawBody });
  assert.equal(
    verifyOpenAiStandardWebhookV1({
      rawBody,
      webhookId,
      webhookTimestamp,
      signatureHeader: sig,
      secret,
      maxSkewSeconds: 3600,
      nowUnixSeconds: Number(webhookTimestamp),
    }),
    true,
  );
});

test('verifyOpenAiStandardWebhookV1 rejects wrong signature', () => {
  const raw = randomBytes(32);
  const secret = `whsec_${raw.toString('base64')}`;
  const webhookId = 'wh_test_bbbbbbbbbbbbbbbb';
  const webhookTimestamp = '1750287078';
  const rawBody = '{"type":"realtime.call.incoming"}';
  assert.equal(
    verifyOpenAiStandardWebhookV1({
      rawBody,
      webhookId,
      webhookTimestamp,
      signatureHeader: 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      secret,
      maxSkewSeconds: 3600,
      nowUnixSeconds: Number(webhookTimestamp),
    }),
    false,
  );
});

test('verifyOpenAiStandardWebhookV1 rejects replay outside skew window', () => {
  const raw = randomBytes(32);
  const secret = `whsec_${raw.toString('base64')}`;
  const webhookId = 'wh_test_cccccccccccccccc';
  const webhookTimestamp = '1000000000';
  const rawBody = '{}';
  const sig = signV1({ rawSecret: raw, webhookId, webhookTimestamp, rawBody });
  assert.equal(
    verifyOpenAiStandardWebhookV1({
      rawBody,
      webhookId,
      webhookTimestamp,
      signatureHeader: sig,
      secret,
      maxSkewSeconds: 60,
      nowUnixSeconds: 2000000000,
    }),
    false,
  );
});
