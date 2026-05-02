import test from 'node:test';
import assert from 'node:assert/strict';

import { TelnyxApiError, TelnyxTimeoutError } from '@/src/backend/adapters/telnyx/telnyx-errors';
import { telnyxHttpJson } from '@/src/backend/adapters/telnyx/telnyx-http';

test('telnyxHttpJson returns parsed JSON and duration on 200', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.match(String(input), /\/v2\/messages$/);
    return new Response(JSON.stringify({ data: { id: 'msg_1' } }), { status: 200 });
  };

  const result = await telnyxHttpJson({
    method: 'POST',
    path: 'messages',
    body: { to: '+1', from: '+1', text: 'hi' },
    timeoutMs: 5000,
    operation: 'sms.send',
    apiKey: 'KEY',
    fetchImpl,
    correlation: { shopId: 's1' },
  });

  assert.equal(result.status, 200);
  assert.ok(typeof result.durationMs === 'number');
  assert.equal((result.parsedJson as { data?: { id?: string } })?.data?.id, 'msg_1');
});

test('telnyxHttpJson throws TelnyxApiError on non-OK HTTP', async () => {
  const fetchImpl: typeof fetch = async () => new Response('oops', { status: 503 });

  await assert.rejects(
    () =>
      telnyxHttpJson({
        method: 'GET',
        path: 'available_phone_numbers?limit=1',
        timeoutMs: 5000,
        operation: 'phone_numbers.search',
        apiKey: 'KEY',
        fetchImpl,
      }),
    (err: unknown) => err instanceof TelnyxApiError && err.status === 503,
  );
});

test('telnyxHttpJson aborts and throws TelnyxTimeoutError when fetch stalls', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    await new Promise<void>((resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error('expected AbortSignal'));
        return;
      }
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
    return new Response('{}', { status: 200 });
  };

  await assert.rejects(
    () =>
      telnyxHttpJson({
        method: 'POST',
        path: 'calls',
        body: { connection_id: 'x', to: '+1', from: '+1' },
        timeoutMs: 40,
        operation: 'calls.create',
        apiKey: 'KEY',
        fetchImpl,
      }),
    (err: unknown) => err instanceof TelnyxTimeoutError,
  );
});
