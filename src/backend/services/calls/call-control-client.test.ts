import test from 'node:test';
import assert from 'node:assert/strict';

import {
  callControlAnswer,
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

test('callControlDial delegates to dial action', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.ok(String(input).endsWith('/actions/dial'));
    return new Response('{}', { status: 200 });
  };
  const res = await callControlDial('cc_y', { to: 'sip:x@y' }, { fetchImpl, apiKey: 'k' });
  assert.equal(res.ok, true);
});
