import test from 'node:test';
import assert from 'node:assert/strict';

import {
  callControlAnswer,
  callControlCreateCall,
  callControlDial,
  postCallControlAction,
} from '@/src/backend/services/calls/call-control-client';

test('postCallControlAction POSTs Telnyx Call Control action URL with bearer key', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ data: {} }), { status: 200 });
  };

  await postCallControlAction(
    'cc_abc',
    'answer',
    { client_state: 'e30=' },
    { fetchImpl, apiKey: 'KEY_TEST' },
  );

  assert.match(capturedUrl, /^https:\/\/api\.telnyx\.com\/v2\/calls\/cc_abc\/actions\/answer$/);
  assert.equal(capturedInit?.method, 'POST');
  const headers = new Headers(capturedInit?.headers as HeadersInit);
  assert.equal(headers.get('Authorization'), 'Bearer KEY_TEST');
  assert.equal(headers.get('Content-Type'), 'application/json');
  assert.equal(capturedInit?.body, JSON.stringify({ client_state: 'e30=' }));
});

test('callControlAnswer delegates to answer action', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.ok(String(input).endsWith('/actions/answer'));
    return new Response('{}', { status: 200 });
  };
  const res = await callControlAnswer('cc_x', {}, { fetchImpl, apiKey: 'k' });
  assert.equal(res.ok, true);
});

test('callControlAnswer can include max_duration_secs in JSON body', async () => {
  let body = '';
  const fetchImpl: typeof fetch = async (_input, init) => {
    body = String(init?.body ?? '');
    return new Response('{}', { status: 200 });
  };
  await callControlAnswer(
    'cc_x',
    { client_state: 'e30=', max_duration_secs: 1800 },
    { fetchImpl, apiKey: 'k' },
  );
  assert.deepEqual(JSON.parse(body), { client_state: 'e30=', max_duration_secs: 1800 });
});

test('callControlCreateCall posts to /v2/calls and extracts call_control_id', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.ok(String(input).endsWith('/v2/calls'));
    return new Response(
      JSON.stringify({ data: { call_control_id: 'cc_new', call_leg_id: 'leg_1', call_session_id: 'sess_1' } }),
      { status: 200 },
    );
  };
  const res = await callControlCreateCall({ to: 'sip:x@y', from: '+1555', connection_id: 'app_1' }, { fetchImpl, apiKey: 'k' });
  assert.equal(res.ok, true);
  assert.equal(res.callControlId, 'cc_new');
  assert.equal(res.callLegId, 'leg_1');
});

test('callControlDial throws unsupported endpoint error', async () => {
  await assert.rejects(
    async () => callControlDial('cc_y', { to: 'sip:x@y' }),
    /Unsupported Telnyx action: \/actions\/dial is not valid; use POST \/v2\/calls/,
  );
});

test('postCallControlAction maps HTTP error to ok false and errorKind http', async () => {
  const fetchImpl: typeof fetch = async () => new Response('bad', { status: 422 });
  const res = await postCallControlAction('cc_z', 'answer', {}, { fetchImpl, apiKey: 'k' });
  assert.equal(res.ok, false);
  assert.equal(res.status, 422);
  assert.equal(res.errorKind, 'http');
  assert.ok(typeof res.durationMs === 'number');
});

test('postCallControlAction maps slow fetch past timeout to errorKind timeout', async () => {
  const prev = process.env.TELNYX_CALL_CONTROL_TIMEOUT_MS;
  try {
    process.env.TELNYX_CALL_CONTROL_TIMEOUT_MS = '60';
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

    const res = await postCallControlAction('cc_t', 'hangup', {}, { fetchImpl, apiKey: 'k' });
    assert.equal(res.ok, false);
    assert.equal(res.errorKind, 'timeout');
  } finally {
    if (prev === undefined) {
      delete process.env.TELNYX_CALL_CONTROL_TIMEOUT_MS;
    } else {
      process.env.TELNYX_CALL_CONTROL_TIMEOUT_MS = prev;
    }
  }
});
