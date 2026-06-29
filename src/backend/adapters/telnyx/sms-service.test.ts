import test from 'node:test';
import assert from 'node:assert/strict';

import { TelnyxSmsService } from '@/src/backend/adapters/telnyx/sms-service';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({ TELNYX_SMS_SENDER_NUMBER: '+15555550999' });

function smsParams(from: string) {
  return {
    to: '+15555550110',
    from,
    body: 'Hello from RingBooker',
    shopId: 'shop-1',
    countryCode: 'US',
    category: 'booking_confirmation' as const,
    idempotencyKey: 'sms-service-test-key',
  };
}

test('TelnyxSmsService uses params.from when provided', async () => {
  process.env.TELNYX_SMS_SENDER_NUMBER = '+15555550999';
  resetEnvCacheForTests();
  const originalFetch = globalThis.fetch;
  let sentBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_input, init) => {
    sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ data: { id: 'msg-explicit', status: 'queued' } }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await new TelnyxSmsService('test-key').sendSms(smsParams('+15555550123'));
    assert.equal(sentBody?.from, '+15555550123');
    assert.equal(sentBody?.to, '+15555550110');
    assert.equal(result.providerMessageId, 'msg-explicit');
    assert.equal(result.fromNumber, '+15555550123');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TelnyxSmsService falls back to TELNYX_SMS_SENDER_NUMBER only when params.from is empty', async () => {
  process.env.TELNYX_SMS_SENDER_NUMBER = '+15555550999';
  resetEnvCacheForTests();
  const originalFetch = globalThis.fetch;
  let sentBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_input, init) => {
    sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ data: { id: 'msg-fallback', status: 'queued' } }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await new TelnyxSmsService('test-key').sendSms(smsParams(''));
    assert.equal(sentBody?.from, '+15555550999');
    assert.equal(result.providerMessageId, 'msg-fallback');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TelnyxSmsService fails safely when no sender is available', async () => {
  const originalSender = process.env.TELNYX_SMS_SENDER_NUMBER;
  delete process.env.TELNYX_SMS_SENDER_NUMBER;
  resetEnvCacheForTests();
  try {
    await assert.rejects(
      () => new TelnyxSmsService('test-key').sendSms(smsParams('')),
      /Missing SMS from number/,
    );
  } finally {
    if (originalSender === undefined) delete process.env.TELNYX_SMS_SENDER_NUMBER;
    else process.env.TELNYX_SMS_SENDER_NUMBER = originalSender;
    resetEnvCacheForTests();
  }
});
